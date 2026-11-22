/**
 * Host half of dsh-bws (v2) — 本地优先的凭证金库，git 双远同步。
 *
 * 设计契约（与用户确认）：
 * - 明文只在「解锁后的进程内存」里存在；落盘一律是 AES-256-GCM 密文。
 * - 密钥由口令 scrypt 派生，口令不落盘，只在 setup/unlock 的那一次请求里经过内存。
 * - 仓库里只有密文与元数据，可安全推到 GitHub / Gitee 私有库。
 * - bws 只在一次性迁移时读取，迁移完成后不再是运行时依赖。
 *
 * @module dsh-bws
 */
import { execFile } from 'node:child_process'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { openStore, normalizeLevel, KEY_RE, nowIso } from './lib/store.js'
import { deriveKey, newSalt, KDF_DEFAULTS, open as openBlobForCheck } from './lib/crypto.js'
import * as git from './lib/sync.js'
import { registerTools } from './lib/tools.js'
import { SKILL_TEXT } from './lib/skill.js'

/** Cordis plugin name. */
export const name = 'dsh-bws'

/** Services consumed from the host. */
export const inject = ['webServer', 'workspaceRegistry', 'tools']

const ROUTE_PREFIX = '/bws'
const CONFIG_VERSION = 1

const CONNECT_FAILURE = /tls handshake|client error \(Connect\)|error sending request|dns error|connection refused|network is unreachable/i
const AMBIGUOUS_FAILURE = /timed out|reset by peer|broken pipe|unexpected eof|connection closed/i
const RETRY_DELAYS_MS = [250, 700, 1600]

let mountedInProcess = false

// ---------------------------------------------------------------- 路径与小工具

/** 把凭证规范写成 `$DSH_HOME/skills/dsh-bws/SKILL.md`（内容变了才写，skill provider 会热加载）。 */
async function installSkill () {
  try {
    const dir = dshHomePath('skills', 'dsh-bws')
    const file = join(dir, 'SKILL.md')
    await mkdir(dir, { recursive: true })
    const current = await readFile(file, 'utf8').catch(() => null)
    if (current === SKILL_TEXT) return
    await writeFile(file, SKILL_TEXT, { mode: 0o644 })
    console.log('[dsh-bws] 已安装凭证规范 skill: ' + file)
  } catch (err) {
    console.warn('[dsh-bws] 安装 skill 失败：' + describeFailure(err))
  }
}

function dshHomePath (...segments) {
  const home = process.env.DSH_HOME ? resolve(process.env.DSH_HOME) : join(homedir(), '.dsh')
  return join(home, ...segments)
}

function expandHome (p) {
  if (typeof p !== 'string') return p
  if (p === '~') return homedir()
  if (p.startsWith('~/')) return join(homedir(), p.slice(2))
  return p
}

function dataDir () {
  return process.env.DSH_BWS_DATA_DIR
    ? resolve(process.env.DSH_BWS_DATA_DIR)
    : dshHomePath('dsh-bws')
}

function configPath () { return join(dataDir(), 'config.json') }
function dbPath () { return join(dataDir(), 'vault.db') }
function defaultRepoPath () { return join(dataDir(), 'repo') }

/**
 * 本机口令文件：装了插件、建了金库就写到这，服务/CLI 默认从这里取口令。
 * 权限 0600、目录 0700；口令变了覆盖写。
 */
function passphraseFile () {
  return process.env.DSH_BWS_PASSPHRASE_FILE
    ? resolve(expandHome(process.env.DSH_BWS_PASSPHRASE_FILE))
    : join(homedir(), '.config', 'dsh-bws', 'passphrase')
}

async function savePassphraseFile (passphrase) {
  const file = passphraseFile()
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  await writeFile(file, `${passphrase}\n`, { mode: 0o600 })
  return file
}

/** 本机密钥文件：与口令文件等价的一把钥匙，但生成时不需要知道口令（解锁后直接写出）。 */
function keyFile () {
  return process.env.DSH_BWS_KEY_FILE
    ? resolve(expandHome(process.env.DSH_BWS_KEY_FILE))
    : join(homedir(), '.config', 'dsh-bws', 'key')
}

async function saveKeyFile (keyBuf) {
  const file = keyFile()
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  await writeFile(file, `${Buffer.from(keyBuf).toString('base64')}\n`, { mode: 0o600 })
  return file
}

/** 读本机 key 文件（base64 的 32 字节）；缺失/损坏返回 null。 */
async function readKeyFile () {
  try {
    const raw = (await readFile(keyFile(), 'utf8')).trim()
    const buf = Buffer.from(raw, 'base64')
    return buf.length === 32 ? buf : null
  } catch { return null }
}

async function hasKeyFile () {
  try { const st = await stat(keyFile()); return st.isFile() } catch { return false }
}

async function readPassphraseFile () {
  try { return (await readFile(passphraseFile(), 'utf8')).replace(/\r?\n$/, '') } catch { return null }
}

function describeFailure (err) {
  const text = `${err?.stderr ?? ''}`.trim() || `${err?.message ?? err}`
  return text
    .replace(/^Command failed:[^:]*:/, '')
    .replace(/^Error:\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/Location:.*$/i, '')
    .slice(0, 200)
    .trim() || '未知错误'
}

function sleep (ms) { return new Promise((r) => setTimeout(r, ms)) }

function sendJson (res, code, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body)
  })
  res.end(body)
}

function hostIsLoopback (req) {
  const host = String(req.headers.host ?? '')
  const hostname = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.replace(/:\d+$/, '')
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === ''
}

async function readJsonBody (req, limit = 8 * 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error('请求体过大')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return {}
  return JSON.parse(text)
}

/** 写操作必须带自定义头（浏览器跨站无法伪造）且是 JSON。 */
function guardWrite (req, res) {
  if (req.headers['x-dsh-bws'] !== '1') { sendJson(res, 403, { ok: false, error: 'missing x-dsh-bws header' }); return false }
  if (!String(req.headers['content-type'] ?? '').includes('application/json')) { sendJson(res, 415, { ok: false, error: 'content-type must be application/json' }); return false }
  return true
}

// ---------------------------------------------------------------- 状态

const state = {
  store: null,
  unlockedAt: null,
  config: null,
  lastSync: null,
  lastError: null
}

function getStore () {
  if (!state.store) {
    state.store = openStore(dbPath())
    if (!state.store.kdf()) {
      // 未初始化：不自动建盐，等 setup
    }
  }
  return state.store
}

async function loadConfig () {
  try {
    const raw = JSON.parse(await readFile(configPath(), 'utf8'))
    state.config = { version: CONFIG_VERSION, repoDir: defaultRepoPath(), branch: 'main', remotes: [], autoSync: true, autoLockMinutes: 15, ...raw }
  } catch {
    state.config = { version: CONFIG_VERSION, repoDir: defaultRepoPath(), branch: 'main', remotes: [], autoSync: true, autoLockMinutes: 15 }
  }
  if (!state.lastSync && state.config.lastSync) state.lastSync = state.config.lastSync
  return state.config
}

async function saveConfig (patch = {}) {
  const next = { ...(state.config ?? await loadConfig()), ...patch }
  state.config = next
  await mkdir(dirname(configPath()), { recursive: true, mode: 0o700 })
  await writeFile(configPath(), JSON.stringify(next, null, 2) + '\n', { mode: 0o600 })
  return next
}

// ---------------------------------------------------------------- 空闲自动锁定
/** 最近一次访问时间；置 0 表示当前没有解锁会话，不需要计时。 */
let lastActivityAt = 0

function touchActivity () {
  lastActivityAt = Date.now()
}

/** 每 30 秒检查一次：超过 autoLockMinutes 没有访问就锁定（0 = 关闭）。 */
function startAutoLockTimer () {
  const timer = setInterval(() => {
    const store = state.store
    if (!store || store.isLocked() || lastActivityAt === 0) return
    const minutes = Number(state.config?.autoLockMinutes ?? 15)
    if (!(minutes > 0)) return
    if (Date.now() - lastActivityAt < minutes * 60_000) return
    store.lock()
    lastActivityAt = 0
    state.unlockedAt = null
    console.log('[dsh-bws] 空闲超过 ' + minutes + ' 分钟，已自动锁定')
  }, 30_000)
  timer.unref?.()   // 不因为这个定时器把宿主进程挂住
  return () => clearInterval(timer)
}

// ---------------------------------------------------------------- 仓库读写

async function exportRepo () {
  const cfg = state.config ?? await loadConfig()
  await mkdir(cfg.repoDir, { recursive: true, mode: 0o700 })
  const store = getStore()
  const result = store.exportTo(cfg.repoDir)
  return result
}

async function commitRepo (message) {
  const cfg = state.config ?? await loadConfig()
  await git.ensureRepo(cfg.repoDir, { branch: cfg.branch })
  return git.commitAll(cfg.repoDir, message)
}

async function syncPush () {
  const cfg = state.config ?? await loadConfig()
  await exportRepo()
  const commit = await commitRepo(`chore: sync ${new Date().toISOString()}`)
  const names = (cfg.remotes ?? []).map((r) => r.name)
  if (names.length === 0) return { ok: true, commit, push: { results: [] }, remotes: [] }
  const push = await git.pushAll(cfg.repoDir, names, cfg.branch)
  state.lastSync = { at: nowIso(), push }
  return { ok: push.results.every((r) => r.ok), commit, push }
}

async function syncPull () {
  const cfg = state.config ?? await loadConfig()
  await git.ensureRepo(cfg.repoDir, { branch: cfg.branch })
  const names = (cfg.remotes ?? []).map((r) => r.name)
  if (names.length === 0) return { ok: false, error: '还没有配置远端仓库' }
  const pull = await git.pullAll(cfg.repoDir, names, cfg.branch)
  const imported = getStore().importFrom(cfg.repoDir)
  // 新机器用远端的盐重设了 KDF：内存里那把密钥已经对不上，必须重新解锁。
  if (imported.saltAdopted) getStore().lock()
  state.lastSync = { at: nowIso(), pull, imported }
  return { ok: pull.results.every((r) => r.ok), pull, imported, relock: Boolean(imported.saltAdopted) }
}

// ---------------------------------------------------------------- bws 迁移（一次性）

function bwsTokenPath () { return join(homedir(), '.config', 'bws', 'access-token') }

async function bwsEnv () {
  if (process.env.BWS_ACCESS_TOKEN) return { ...process.env }
  try {
    const token = (await readFile(bwsTokenPath(), 'utf8')).trim()
    if (token) return { ...process.env, BWS_ACCESS_TOKEN: token }
  } catch {}
  return { ...process.env }
}

function execBws (args, env, { retry = 3 } = {}) {
  return new Promise((resolvePromise, reject) => {
    const attempt = (left) => {
      execFile('bws', args, { env, timeout: 30000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (!err) return resolvePromise({ stdout, stderr })
        const text = `${stderr ?? ''}${err.message ?? ''}`
        const transient = CONNECT_FAILURE.test(text) || AMBIGUOUS_FAILURE.test(text)
        if (retry > 0 && transient && left > 1) {
          setTimeout(() => attempt(left - 1), RETRY_DELAYS_MS[Math.min(RETRY_DELAYS_MS.length - 1, 3 - left)])
          return
        }
        reject(Object.assign(new Error(describeFailure({ stderr, message: err.message })), { stdout, stderr }))
      })
    }
    attempt(retry)
  })
}

async function readBwsSecrets () {
  const env = await bwsEnv()
  const { stdout } = await execBws(['secret', 'list', '-o', 'json'], env)
  const parsed = JSON.parse(stdout)
  if (!Array.isArray(parsed)) throw new Error('bws 返回的不是数组')
  return parsed.map((s) => ({
    key: String(s.key),
    value: String(s.value ?? ''),
    note: String(s.note ?? '')
  }))
}

function inferGroup (key) {
  if (/^SSH_/.test(key) || /^GEMINI_VM_SSH_KEY/.test(key) || key === 'GITHUB_TOKEN' || key === 'TENCENT_CITYWALK_PEM') return 'common'
  if (key === 'GEMINI_LITELLM_ENV' || key === 'GEMINI_VERTEX_SA') return 'litellm'
  if (key.startsWith('GEMINI_')) return 'gemini-gateway'
  if (key.startsWith('CITYWALK_')) return 'citywalk'
  if (key.startsWith('WXCLOUD_')) return 'wxcloud'
  return 'common'
}

async function importFromBws (defaultGroup = '') {
  const store = getStore()
  if (store.isLocked()) throw new Error('金库未解锁')
  const secrets = await readBwsSecrets()
  const groups = store.groups()
  if (groups.length === 0) {
    throw new Error('还没有分组：请先在「授权」页新建至少一个分组，再迁移')
  }
  const known = new Set(groups.map((g) => g.id))
  const fallback = known.has(defaultGroup) ? defaultGroup : groups[0].id
  let created = 0
  let updated = 0
  let skipped = 0
  for (const item of secrets) {
    if (!KEY_RE.test(item.key)) { skipped += 1; continue }
    const inferred = inferGroup(item.key)
    const group = known.has(inferred) ? inferred : fallback
    const existing = store.get(item.key)
    if (existing && !existing.deleted) {
      if (existing.valueLength === Buffer.byteLength(item.value)) { skipped += 1; continue }
      store.update(item.key, { value: item.value, group, note: item.note || existing.note })
      updated += 1
    } else {
      store.put({ key: item.key, value: item.value, group, note: item.note })
      created += 1
    }
  }
  await exportRepo()
  return { total: secrets.length, created, updated, skipped }
}

// ---------------------------------------------------------------- 访问控制

function levelRank (level) {
  return ({ none: 0, read: 1, write: 2 })[normalizeLevel(level)] ?? 0
}

function groupById (id) { return getStore().groups().find((g) => g.id === id) ?? null }

/** 工作区对某分组的最终权限：shared 默认全员可读写；project 默认只有被授权者。 */
function canAccess (workspace, group, want = 'read') {
  if (!group) return false
  const store = getStore()
  const grant = store.grants().find((g) => g.workspace === workspace && g.group === group.id)
  let level = grant ? grant.level : (group.tier === 'shared' ? 'write' : 'none')
  if (group.tier === 'shared' && grant) level = grant.level
  return levelRank(level) >= levelRank(want)
}

/**
 * 从工具调用上下文解析调用方工作区 id（解析不出来就是空串：只能看通用层）。
 * `resolveByPath` 是 async 且只做 realpath 精确匹配，所以再补一层「最长路径前缀」兜底，
 * 让在子目录里启动的会话也能归到它的工作区。
 */
async function workspaceOf (exec) {
  try {
    const cwd = exec?.agent?.session?.header?.cwd
    if (!cwd) return ''
    const registry = ctxRef?.get?.('workspaceRegistry')
    let found = null
    try { found = await registry?.resolveByPath?.(cwd) } catch { found = null }
    if (found?.id) return found.id
    const list = registry?.list?.() ?? []
    let best = null
    for (const w of list) {
      const path = String(w?.path ?? '')
      if (!path) continue
      if (cwd === path) { best = w; break }
      if (cwd.startsWith(path + '/') && (!best || path.length > String(best.path).length)) best = w
    }
    return best?.id ?? ''
  } catch {
    return ''
  }
}

/** 把凭证注入子进程后执行一条命令。 */
function execWithEnv (command, env, { timeoutMs = 30000 } = {}) {
  return new Promise((resolvePromise) => {
    execFile('bash', ['-c', command], {
      env: { ...process.env, ...env },
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024
    }, (err, stdout, stderr) => {
      resolvePromise({
        exitCode: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
        stdout: String(stdout ?? '').slice(0, 100000),
        stderr: String(stderr ?? '').slice(0, 100000)
      })
    })
  })
}

// ---------------------------------------------------------------- 路由

function workspaceList () {
  try {
    const registry = ctxRef?.get?.('workspaceRegistry')
    const list = registry?.list?.() ?? []
    return list.map((w) => ({ id: w.id, title: w.title ?? w.name ?? w.id, path: w.path ?? w.cwd ?? '' }))
  } catch {
    return []
  }
}

/**
 * 把一个「工作区路径或 id」解析成工作区记录；省略则取当前会话的工作区。
 * @param {string|undefined} input
 * @param {object} exec
 * @returns {Promise<{id:string,title:string,path:string}|null>}
 */
async function resolveWorkspace (input, exec) {
  const registry = ctxRef?.get?.('workspaceRegistry')
  const list = registry?.list?.() ?? []
  const shape = (w, fallbackPath) => ({ id: w.id, title: w.title ?? w.name ?? w.id, path: w.path ?? fallbackPath ?? '' })
  if (!input) {
    const id = await workspaceOf(exec)
    if (!id) return null
    const hit = list.find((w) => w.id === id)
    return hit ? shape(hit) : { id, title: id, path: '' }
  }
  if (!registry) return null
  const byId = list.find((w) => w.id === input)
  if (byId) return shape(byId)
  const abs = path.resolve(input)
  try {
    const exact = await registry.resolveByPath?.(abs)
    if (exact) return shape(exact, abs)
  } catch { /* 继续按前缀匹配 */ }
  const prefix = list
    .filter((w) => abs === w.path || abs.startsWith(String(w.path ?? '\u0000') + '/'))
    .sort((a, b) => String(b.path ?? '').length - String(a.path ?? '').length)[0]
  return prefix ? shape(prefix) : null
}

let ctxRef = null

function buildVaultPayload () {
  const store = getStore()
  const groups = store.groups()
  const counts = Object.fromEntries(groups.map((g) => [g.id, 0]))
  const secrets = store.list().map((s) => {
    counts[s.group] = (counts[s.group] ?? 0) + 1
    return {
      id: s.id,
      key: s.key,
      group: s.group,
      note: s.note,
      valueLength: s.valueLength,
      revision: s.revision,
      updatedAt: s.updatedAt
    }
  })
  return { groups, secrets, counts, total: secrets.length }
}

async function handle (req, res) {
  if (!hostIsLoopback(req)) { sendJson(res, 403, { ok: false, error: 'loopback only' }); return }
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const path = url.pathname
  const method = req.method ?? 'GET'

  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') { sendJson(res, 405, { ok: false, error: 'method not allowed' }); return }

  touchActivity()

  try {
    if (path === `${ROUTE_PREFIX}/status` && method === 'GET') {
      const store = getStore()
      const initialized = Boolean(store.kdf())
      const payload = buildVaultPayload()
      const cfg = state.config ?? await loadConfig()
      sendJson(res, 200, {
        ok: true,
        initialized,
        locked: store.isLocked(),
        groups: payload.groups.length,
        secrets: payload.total,
        counts: payload.counts,
        remotes: (cfg.remotes ?? []).map((r) => ({ name: r.name, url: r.url })),
        lastSync: state.lastSync,
        lastError: state.lastError,
        autoLockMinutes: Number(cfg.autoLockMinutes ?? 15),
        passphraseFile: (await readPassphraseFile()) ? passphraseFile() : null,
        keyFile: (await hasKeyFile()) ? keyFile() : null,
        version: 2
      })
      return
    }

    if (path === `${ROUTE_PREFIX}/config/save` && method === 'POST') {
      if (!guardWrite(req, res)) return
      const body = await readJsonBody(req)
      const patch = {}
      if (body.autoLockMinutes !== undefined) {
        const minutes = Number(body.autoLockMinutes)
        if (!Number.isFinite(minutes) || minutes < 0 || minutes > 240) {
          sendJson(res, 400, { ok: false, error: '空闲锁定时间要在 0–240 分钟之间（0 表示关闭）' })
          return
        }
        patch.autoLockMinutes = Math.round(minutes)
      }
      const cfg = await saveConfig(patch)
      sendJson(res, 200, { ok: true, autoLockMinutes: Number(cfg.autoLockMinutes ?? 15) })
      return
    }

    if (path === `${ROUTE_PREFIX}/setup` && method === 'POST') {
      if (!guardWrite(req, res)) return
      const body = await readJsonBody(req)
      const passphrase = String(body.passphrase ?? '')
      if (passphrase.length < 8) { sendJson(res, 400, { ok: false, error: '口令至少 8 个字符' }); return }
      const store = getStore()
      if (store.kdf()) { sendJson(res, 409, { ok: false, error: '金库已初始化' }); return }
      const salt = newSalt()
      store.seekdf(salt, KDF_DEFAULTS)
      store.unlock(deriveKey(passphrase, salt))
      store.setVerifier()
      store.setMeta('createdAt', nowIso())
      const savedTo = await savePassphraseFile(passphrase)
      await saveKeyFile(store.keySnapshot())
      await exportRepo()
      await commitRepo('chore: 初始化金库')
      state.unlockedAt = nowIso()
      sendJson(res, 200, { ok: true, initialized: true, locked: false, passphraseFile: savedTo })
      return
    }

    // 检查本机保存的钥匙/口令是否真的能打开这个金库（文件存在 ≠ 有效）
    if (path === `${ROUTE_PREFIX}/credential/check` && method === 'POST') {
      if (!guardWrite(req, res)) return
      const store = getStore()
      const out = { keyFileValid: false, passphraseFileValid: false }
      const rawKey = await readKeyFile()
      if (rawKey) out.keyFileValid = store.checkKey(rawKey) === true
      const pp = await readPassphraseFile()
      if (pp) {
        const kdf = store.kdf()
        try { out.passphraseFileValid = store.checkKey(deriveKey(pp, kdf.salt, kdf.params)) === true } catch { out.passphraseFileValid = false }
      }
      sendJson(res, 200, { ok: true, ...out })
      return
    }

    // 解锁后一键把密钥写到本机（不需要重新输入口令）
    if (path === `${ROUTE_PREFIX}/keyfile/save` && method === 'POST') {
      if (!guardWrite(req, res)) return
      const store = getStore()
      const snapshot = store.keySnapshot()
      if (!snapshot) { sendJson(res, 423, { ok: false, error: '金库已锁定：先解锁再保存' }); return }
      const savedTo = await saveKeyFile(snapshot)
      sendJson(res, 200, { ok: true, keyFile: savedTo })
      return
    }

    // 已经建过库的机器：把主口令补写到本机（面板解锁后可一键调用）
    if (path === `${ROUTE_PREFIX}/passphrase/save` && method === 'POST') {
      if (!guardWrite(req, res)) return
      const body = await readJsonBody(req)
      const store = getStore()
      const kdf = store.kdf()
      if (!kdf) { sendJson(res, 409, { ok: false, error: '金库尚未初始化' }); return }
      const passphrase = String(body.passphrase ?? '')
      if (!passphrase) { sendJson(res, 400, { ok: false, error: '缺少口令' }); return }
      const candidate = deriveKey(passphrase, kdf.salt, kdf.params)
      const verified = store.checkKey(candidate)
      if (verified === false) { sendJson(res, 401, { ok: false, error: body.useKeyFile ? '本机的钥匙文件打不开这个金库' : '口令不正确' }); return }
      if (verified === null) {
        const probe = store.list({ includeDeleted: true })[0]
        const probeBlob = probe ? store.blobOf(probe.key) : null
        if (probeBlob) {
          try { openBlobForCheck(candidate, probeBlob) } catch { sendJson(res, 401, { ok: false, error: '口令不正确' }); return }
        }
      }
      const savedTo = await savePassphraseFile(passphrase)
      await saveKeyFile(store.keySnapshot())
      sendJson(res, 200, { ok: true, passphraseFile: savedTo })
      return
    }

    if (path === `${ROUTE_PREFIX}/passwd` && method === 'POST') {
      if (!guardWrite(req, res)) return
      const body = await readJsonBody(req)
      const store = getStore()
      const kdf = store.kdf()
      if (!kdf) { sendJson(res, 409, { ok: false, error: '金库尚未初始化' }); return }
      const current = String(body.current ?? '')
      const next = String(body.next ?? '')
      if (next.length < 8) { sendJson(res, 400, { ok: false, error: '新口令至少 8 个字符' }); return }
      const oldKey = deriveKey(current, kdf.salt, kdf.params)
      const verified = store.checkKey(oldKey)
      const probe = verified === null ? store.list({ includeDeleted: true })[0] : null
      const probeBlob = probe ? store.blobOf(probe.key) : null
      if (verified === false || (probeBlob && (() => { try { openBlobForCheck(oldKey, probeBlob); return false } catch { return true } })())) {
        sendJson(res, 401, { ok: false, error: '当前口令不正确' }); return
      }
      const salt = newSalt()
      const nextKey = deriveKey(next, salt)
      const rotated = store.rotate(nextKey, salt, KDF_DEFAULTS)
      const savedTo = await savePassphraseFile(next)
      await saveKeyFile(store.keySnapshot())
      await exportRepo()
      await commitRepo('chore: 修改主口令')
      state.unlockedAt = nowIso()
      sendJson(res, 200, { ok: true, rotated, passphraseFile: savedTo })
      return
    }

    if (path === `${ROUTE_PREFIX}/unlock` && method === 'POST') {
      if (!guardWrite(req, res)) return
      const body = await readJsonBody(req)
      const store = getStore()
      const kdf = store.kdf()
      if (!kdf) { sendJson(res, 409, { ok: false, error: '金库尚未初始化' }); return }
      const key = body.useKeyFile
        ? await readKeyFile()
        : deriveKey(String(body.passphrase ?? ''), kdf.salt, kdf.params)
      if (!key) { sendJson(res, 401, { ok: false, error: '本机没有可用的钥匙文件' }); return }
      const verified = store.checkKey(key)
      if (verified === false) { sendJson(res, 401, { ok: false, error: body.useKeyFile ? '本机的钥匙文件打不开这个金库' : '口令不正确' }); return }
      if (verified === null) {
        // 旧库没有验证锚：退回用一条真实密文探测
        const probe = store.list({ includeDeleted: true })[0]
        const blob = probe ? store.blobOf(probe.key) : null
        if (blob) {
          try { openBlobForCheck(key, blob) } catch { sendJson(res, 401, { ok: false, error: '口令不正确' }); return }
        }
      }
      store.unlock(key)
      state.unlockedAt = nowIso()
      state.lastError = null
      sendJson(res, 200, { ok: true, locked: false })
      return
    }

    if (path === `${ROUTE_PREFIX}/lock` && method === 'POST') {
      if (!guardWrite(req, res)) return
      getStore().lock()
      state.unlockedAt = null
      sendJson(res, 200, { ok: true, locked: true })
      return
    }

    if (path === `${ROUTE_PREFIX}/vault` && method === 'GET') {
      const payload = buildVaultPayload()
      const store = getStore()
      sendJson(res, 200, { ok: true, source: 'local', locked: store.isLocked(), ...payload })
      return
    }

    if (path === `${ROUTE_PREFIX}/groups` && method === 'GET') {
      const store = getStore()
      const payload = buildVaultPayload()
      sendJson(res, 200, {
        ok: true,
        groups: payload.groups,
        grants: store.grants(),
        counts: payload.counts,
        total: payload.total,
        workspaces: workspaceList()
      })
      return
    }

    if (path === `${ROUTE_PREFIX}/groups/save` && method === 'POST') {
      if (!guardWrite(req, res)) return
      const body = await readJsonBody(req)
      const store = getStore()
      if (Array.isArray(body.groups)) {
        // 删除一个分组前先确认没有凭证还挂在里面，否则会出现「分组不存在」的孤儿条目。
        const nextIds = new Set(body.groups.filter((g) => g && typeof g.id === 'string').map((g) => g.id))
        const orphans = new Map()
        for (const item of store.list()) {
          if (!nextIds.has(item.group)) orphans.set(item.group, (orphans.get(item.group) ?? 0) + 1)
        }
        if (orphans.size > 0) {
          const detail = [...orphans.entries()].map(([id, n]) => `${id}（${n} 条）`).join('、')
          sendJson(res, 400, { ok: false, error: `这些分组里还有凭证，先把它们改到别的分组再删：${detail}` })
          return
        }
        const next = body.groups
          .filter((g) => g && typeof g.id === 'string' && g.id.length > 0 && g.id.length <= 64)
          .map((g, i) => ({
            id: g.id,
            title: String(g.title ?? g.id).slice(0, 80),
            tier: g.tier === 'shared' ? 'shared' : 'project',
            order: Number.isFinite(g.order) ? g.order : i
          }))
        store.saveGroups(next)
      }
      if (Array.isArray(body.grants)) {
        const ids = new Set(store.groups().map((g) => g.id))
        const grants = body.grants
          .filter((g) => g && ids.has(g.group) && ['read', 'write'].includes(g.level))
          .map((g) => ({ workspace: String(g.workspace), group: String(g.group), level: g.level }))
        store.saveGrants(grants)
      }
      await exportRepo()
      sendJson(res, 200, { ok: true, groups: store.groups(), grants: store.grants() })
      return
    }

    const revealMatch = path.match(/^\/bws\/secret\/([A-Z][A-Z0-9_]*)\/reveal$/)
    if (revealMatch && method === 'POST') {
      if (!guardWrite(req, res)) return
      const store = getStore()
      if (store.isLocked()) { sendJson(res, 423, { ok: false, error: '金库已锁定，请先解锁' }); return }
      const value = store.reveal(revealMatch[1])
      sendJson(res, 200, { ok: true, key: revealMatch[1], value, length: Buffer.byteLength(value) })
      return
    }

    if (path === `${ROUTE_PREFIX}/secrets` && method === 'POST') {
      if (!guardWrite(req, res)) return
      const body = await readJsonBody(req)
      const store = getStore()
      if (store.isLocked()) { sendJson(res, 423, { ok: false, error: '金库已锁定，请先解锁' }); return }
      const key = String(body.key ?? '')
      if (!KEY_RE.test(key)) { sendJson(res, 400, { ok: false, error: '键名需匹配 ^[A-Z][A-Z0-9_]*$' }); return }
      if (store.get(key)) { sendJson(res, 409, { ok: false, error: `键名已存在：${key}` }); return }
      const known = store.groups()
      if (known.length === 0) { sendJson(res, 400, { ok: false, error: '还没有分组：请先在「授权」页新建一个分组' }); return }
      const wanted = String(body.group ?? '')
      if (wanted && !known.some((g) => g.id === wanted)) { sendJson(res, 400, { ok: false, error: `没有这个分组：${wanted}` }); return }
      const group = wanted || known[0].id
      const item = store.put({ key, value: String(body.value ?? ''), group, note: String(body.note ?? '') })
      await exportRepo()
      await commitRepo(`feat: add ${key}`)
      sendJson(res, 200, { ok: true, secret: item })
      return
    }

    const secretMatch = path.match(/^\/bws\/secret\/([A-Z][A-Z0-9_]*)$/)
    if (secretMatch && method === 'POST') {
      if (!guardWrite(req, res)) return
      const body = await readJsonBody(req)
      const store = getStore()
      if (store.isLocked()) { sendJson(res, 423, { ok: false, error: '金库已锁定，请先解锁' }); return }
      const patch = {}
      if (body.value !== undefined) patch.value = String(body.value)
      if (body.note !== undefined) patch.note = String(body.note)
      if (body.group !== undefined) {
        if (!store.groups().some((g) => g.id === body.group)) { sendJson(res, 400, { ok: false, error: `没有这个分组：${body.group}` }); return }
        patch.group = String(body.group)
      }
      if (body.newKey !== undefined && body.newKey !== '') patch.newKey = String(body.newKey)
      const item = store.update(secretMatch[1], patch)
      await exportRepo()
      await commitRepo(`feat: update ${item.key}`)
      sendJson(res, 200, { ok: true, secret: item })
      return
    }

    const deleteMatch = path.match(/^\/bws\/secret\/([A-Z][A-Z0-9_]*)\/delete$/)
    if (deleteMatch && method === 'POST') {
      if (!guardWrite(req, res)) return
      const store = getStore()
      if (store.isLocked()) { sendJson(res, 423, { ok: false, error: '金库已锁定，请先解锁' }); return }
      const item = store.remove(deleteMatch[1])
      await exportRepo()
      await commitRepo(`feat: delete ${deleteMatch[1]}`)
      sendJson(res, 200, { ok: true, secret: item })
      return
    }

    if (path === `${ROUTE_PREFIX}/run` && method === 'POST') {
      if (!guardWrite(req, res)) return
      const body = await readJsonBody(req)
      const store = getStore()
      if (store.isLocked()) { sendJson(res, 423, { ok: false, error: '金库已锁定，请先解锁' }); return }
      const groupIds = Array.isArray(body.groups) && body.groups.length > 0
        ? body.groups.map(String)
        : (body.group ? [String(body.group)] : null)
      const wanted = Array.isArray(body.keys) && body.keys.length > 0 ? new Set(body.keys.map(String)) : null
      const injected = {}
      for (const item of store.list()) {
        if (wanted) {
          if (!wanted.has(item.key)) continue
        } else if (groupIds && !groupIds.includes(item.group)) {
          continue
        }
        injected[item.key] = store.reveal(item.key)
      }
      const command = String(body.command ?? '').trim()
      if (!command) { sendJson(res, 400, { ok: false, error: 'command 不能为空' }); return }
      const useShell = body.shell !== false
      const started = Date.now()
      const result = await new Promise((resolvePromise) => {
        execFile(useShell ? 'bash' : command.split(/\s+/)[0], useShell ? ['-c', command] : command.split(/\s+/).slice(1), {
          env: { ...process.env, ...injected },
          timeout: 120000,
          maxBuffer: 4 * 1024 * 1024
        }, (err, stdout, stderr) => {
          resolvePromise({
            ok: !err,
            exitCode: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
            stdout: String(stdout ?? '').slice(0, 100000),
            stderr: String(stderr ?? '').slice(0, 100000),
            error: err && err.killed ? 'timed out' : (err ? describeFailure(err) : null)
          })
        })
      })
      sendJson(res, 200, { ok: true, success: result.ok, ...result, durationMs: Date.now() - started, injected: Object.keys(injected) })
      return
    }

    if (path === `${ROUTE_PREFIX}/sync` && method === 'POST') {
      if (!guardWrite(req, res)) return
      const body = await readJsonBody(req)
      const direction = String(body.direction ?? 'push')
      const result = direction === 'pull' ? await syncPull() : await syncPush()
      sendJson(res, 200, { ok: true, success: result.ok !== false, direction, ...result })
      return
    }

    if (path === `${ROUTE_PREFIX}/remotes/save` && method === 'POST') {
      if (!guardWrite(req, res)) return
      const body = await readJsonBody(req)
      const list = Array.isArray(body.remotes) ? body.remotes : []
      const remotes = list
        .filter((r) => r && typeof r.url === 'string' && /^(https?:\/\/|git@|ssh:\/\/|file:\/\/|\/)/.test(r.url))
        .map((r, i) => ({ name: String(r.name ?? (i === 0 ? 'origin' : `remote${i}`)), url: r.url }))
      await saveConfig({ remotes })
      const cfg = state.config
      await git.ensureRepo(cfg.repoDir, { branch: cfg.branch })
      for (const r of remotes) await git.setRemote(cfg.repoDir, r.name, r.url)
      sendJson(res, 200, { ok: true, remotes })
      return
    }

    if (path === `${ROUTE_PREFIX}/import-bws` && method === 'POST') {
      if (!guardWrite(req, res)) return
      const store = getStore()
      if (store.isLocked()) { sendJson(res, 423, { ok: false, error: '金库已锁定，请先解锁' }); return }
      const body = await readJsonBody(req).catch(() => ({}))
      const result = await importFromBws(String(body?.group ?? ''))
      await commitRepo('chore: 从 bws 迁移')
      sendJson(res, 200, { ok: true, ...result })
      return
    }

    if (path === `${ROUTE_PREFIX}/events` && method === 'GET') {
      sendJson(res, 200, { ok: true, events: getStore().events(100) })
      return
    }

    sendJson(res, 404, { ok: false, error: `no route: ${method} ${path}` })
  } catch (err) {
    state.lastError = describeFailure(err)
    sendJson(res, 400, { ok: false, error: describeFailure(err) })
  }
}

/** 首次 apply 时把 /bws 挂到宿主 webServer；重复 apply 直接跳过。 */
export function apply (ctx, config = {}) {
  ctxRef = ctx
  if (mountedInProcess) {
    console.warn('[dsh-bws] /bws 路由已在本进程注册过，跳过重复注册')
    return undefined
  }
  mountedInProcess = true
  getStore()
  loadConfig().catch(() => {})

  let disposeTools = null
  try {
    disposeTools = registerTools(ctx, {
      store: getStore,
      groups: () => getStore().groups(),
      canAccess,
      workspaceOf,
      resolveWorkspace,
      exec: execWithEnv
    })
    console.log('[dsh-bws] agent 工具已注册: bws_list, bws_run, bws_grant')
  } catch (err) {
    console.warn('[dsh-bws] agent 工具注册失败：' + describeFailure(err))
  }

  void installSkill()

  const stopAutoLock = startAutoLockTimer()

  try {
    const dispose = ctx.webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler: handle })
    return () => {
      mountedInProcess = false
      try { stopAutoLock?.() } catch {}
      try { disposeTools?.() } catch {}
      disposeTools = null
      state.store?.close?.()
      state.store = null
      if (typeof dispose === 'function') dispose()
    }
  } catch (err) {
    if (/duplicate .* route/i.test(String(err?.message ?? err))) {
      console.warn('[dsh-bws] /bws 已被占用，跳过重复注册')
      try { stopAutoLock?.() } catch {}
      mountedInProcess = false
      return undefined
    }
    mountedInProcess = false
    throw err
  }
}
