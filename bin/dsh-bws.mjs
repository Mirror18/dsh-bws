#!/usr/bin/env node
// dsh-bws 命令行：给脚本和 systemd 服务取用本地金库里的凭证。
// 明文只出现在子进程环境变量与 stdout 里，不写文件、不进日志。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { openStore, KEY_RE } from '../lib/store.js'
import { deriveKey, open as openBlob, newSalt, KDF_DEFAULTS } from '../lib/crypto.js'

const { mkdir, writeFile, chmod } = fs.promises
const { tmpdir } = os
const { join, dirname, resolve } = path
const unlinkSync = fs.unlinkSync

/** `~/x` 展开到家目录；其余按当前目录解析。 */
function resolveHome (input) {
  if (input.startsWith('~/')) return join(process.env.HOME || os.homedir(), input.slice(2))
  return resolve(input)
}

const USAGE = `dsh-bws — 本地加密凭证金库

用法：
  dsh-bws list [--group <分组>] [--json]        列出键名（不含值）
  dsh-bws groups [--json]                       列出分组
  dsh-bws has <KEY>                             存在则退出码 0
  dsh-bws get <KEY> [--raw]                     打印一条值
  dsh-bws run [--group <分组>] [--key <KEY>]... [--file KEY[=路径]]... -- <命令> [参数...]
      把选中的密钥注入环境变量后执行命令（systemd 自启动用这个）。
      --file KEY 会把该密钥写成 0600 文件，并在环境里给出 DSH_BWS_FILE_<KEY> 路径。
                                                注入环境变量后执行命令
  dsh-bws passwd                                改主口令（写回本机口令文件）
  dsh-bws check                                 校验口令能否解开

数据目录（按优先级）：--data-dir <目录> → $DSH_BWS_DATA_DIR → $DSH_HOME/dsh-bws → ~/.dsh/dsh-bws

钥匙来源（按优先级）：
  key path                   打印本机钥匙文件位置
  key export [--out 文件]    导出可搬运的钥匙文件（交给另一台机器用）
  key import <文件>          导入钥匙文件（先 clone 仓库、装好插件）
  --key-file <文件>          直接用本机密钥文件（~/.config/dsh-bws/key，建库时自动写）
  --passphrase-file <文件>   从文件读口令（建议 0600；用于 systemd）
  DSH_BWS_PASSPHRASE         环境变量
  --passphrase-stdin         从 stdin 读一行
  --passphrase-cred [名字]    用 systemd-creds 解 <名字>.cred（默认 ~/.config/dsh-bws/pass.cred）
  都没有时在 TTY 上提示输入

退出码：0 成功 · 2 用法错误 · 3 未解锁/口令错误 · 4 凭证不存在 · 5 金库未初始化
`

function dataDir (options = {}) {
  const override = options.dataDir || process.env.DSH_BWS_DATA_DIR
  if (override && override.trim()) return path.resolve(override.trim())
  const home = process.env.DSH_HOME && process.env.DSH_HOME.trim()
    ? process.env.DSH_HOME.trim()
    : path.join(os.homedir(), '.dsh')
  return path.join(home, 'dsh-bws')
}

function fail (code, message) {
  process.stderr.write('dsh-bws: ' + message + '\n')
  process.exit(code)
}

function parseArgs (argv) {
  const options = { groups: [], keys: [], files: [], requires: [], rest: [], json: false, raw: false, check: false, quiet: false, keepFiles: false }
  const positional = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--') { options.rest = argv.slice(i + 1); break }
    if (arg === '--json') { options.json = true; continue }
    if (arg === '--raw') { options.raw = true; continue }
    if (arg === '--group') { options.groups.push(argv[++i] ?? ''); continue }
    if (arg === '--key') { options.keys.push(argv[++i] ?? ''); continue }
    if (arg === '--file') { options.files.push(argv[++i] ?? ''); continue }
    if (arg === '--require') { options.requires.push(argv[++i] ?? ''); continue }
    if (arg === '--runtime-dir') { options.runtimeDir = argv[++i] ?? ''; continue }
    if (arg === '--data-dir') { options.dataDir = argv[++i] ?? ''; continue }
    if (arg === '--key-file') { options.keyFile = argv[++i] ?? ''; continue }
    if (arg === '--out') { options.out = argv[++i] ?? ''; continue }
    if (arg === '--quiet') { options.quiet = true; continue }
    if (arg === '--keep-files') { options.keepFiles = true; continue }
    if (arg === '--passphrase-file') { options.passphraseFile = argv[++i] ?? ''; continue }
    if (arg === '--passphrase' ) { options.passphrase = argv[++i] ?? ''; continue }
    if (arg === '--passphrase-stdin') { options.passphraseStdin = true; continue }
    if (arg === '--new-passphrase') { options.newPassphrase = argv[++i] ?? ''; continue }
    if (arg === '--passphrase-cred') { options.passphraseCred = argv[++i] ?? 'dsh-bws'; continue }
    if (arg === '--passphrase-cred-file') { options.passphraseCredFile = argv[++i] ?? ''; continue }
    if (arg === '-h' || arg === '--help') { options.help = true; continue }
    positional.push(arg)
  }
  options.positional = positional
  return options
}

/** 用 systemd-creds 解开一个 cred 文件，得到口令（无 TPM 时由主机密钥保护）。 */
function defaultKeyFile () {
  return process.env.DSH_BWS_KEY_FILE
    ? path.resolve(process.env.DSH_BWS_KEY_FILE)
    : path.join(os.homedir(), '.config', 'dsh-bws', 'key')
}

/** 读本机 key 文件（base64 的 32 字节）；没有或不合法返回 null。 */
function readKeyFile (options = {}) {
  const file = options.keyFile ? path.resolve(resolveHome(options.keyFile)) : defaultKeyFile()
  try {
    const raw = fs.readFileSync(file, 'utf8').trim()
    const key = Buffer.from(raw, 'base64')
    return key.length === 32 ? key : null
  } catch { return null }
}

function defaultPassphraseFile () {
  return process.env.DSH_BWS_PASSPHRASE_FILE
    ? path.resolve(process.env.DSH_BWS_PASSPHRASE_FILE)
    : path.join(os.homedir(), '.config', 'dsh-bws', 'passphrase')
}

function readPassphraseCred (name, file) {
  const target = file || join(process.env.HOME || os.homedir(), '.config', 'dsh-bws', `${name}.cred`)
  const out = spawnSync('systemd-creds', ['decrypt', '--user', '--name', name, target, '-'], { encoding: 'utf8' })
  if (out.status !== 0) fail(3, `systemd-creds 解不开 ${target}：${(out.stderr || '').trim().split('\n')[0] || '未知错误'}`)
  return out.stdout.replace(/\r?\n$/, '')
}

function readHidden (prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    const stdout = process.stderr
    if (!stdin.isTTY) { reject(new Error('不是交互终端，请改用 --passphrase-file 或 DSH_BWS_PASSPHRASE')); return }
    stdout.write(prompt)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    let buffer = ''
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.removeListener('data', onData)
          stdout.write('\n')
          resolve(buffer)
          return
        }
        if (char === '\u0003') { stdin.setRawMode(false); stdout.write('\n'); process.exit(130) }
        if (char === '\u007f' || char === '\b') { buffer = buffer.slice(0, -1); continue }
        buffer += char
      }
    }
    stdin.on('data', onData)
  })
}

async function readPassphrase (options) {
  if (options.passphrase) return options.passphrase
  if (options.passphraseCred) return readPassphraseCred(options.passphraseCred, options.passphraseCredFile)
  if (options.passphraseFile) {
    const file = path.resolve(options.passphraseFile)
    try {
      const stat = fs.statSync(file)
      if (stat.mode & 0o077) {
        process.stderr.write(`dsh-bws: 警告：${file} 权限过宽（建议 chmod 600）\n`)
      }
      return fs.readFileSync(file, 'utf8').replace(/\r?\n$/, '')
    } catch (err) {
      fail(2, `读不到口令文件 ${file}：${err.message}`)
    }
  }
  if (process.env.DSH_BWS_PASSPHRASE) return process.env.DSH_BWS_PASSPHRASE
  const auto = defaultPassphraseFile()
  if (fs.existsSync(auto)) return fs.readFileSync(auto, 'utf8').replace(/\r?\n$/, '')
  if (options.passphraseStdin) {
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '')
  }
  return readHidden('主口令: ')
}

/** 打开并解锁；口令错就以 3 退出。 */
async function openUnlocked (options) {
  const dir = dataDir(options)
  const dbPath = path.join(dir, 'vault.db')
  if (!fs.existsSync(dbPath)) fail(5, `金库未初始化（${dbPath} 不存在）。先在 DSH 设置里创建。`)
  const store = openStore(dbPath)
  const kdf = store.kdf()
  if (!kdf) fail(5, '金库尚未初始化（缺少 KDF 参数）。')
  const key = readKeyFile(options) ?? deriveKey(await readPassphrase(options), kdf.salt, kdf.params)
  const verified = store.checkKey(key)
  if (verified === false) fail(3, '口令不正确')
  if (verified === null) {
    const probe = store.list({ includeDeleted: true })[0]
    const blob = probe ? store.blobOf(probe.key) : null
    if (blob) {
      try { openBlob(key, blob) } catch { fail(3, '口令不正确') }
    }
  }
  store.unlock(key)
  return store
}

function selectSecrets (store, options) {
  const all = store.list()
  if (options.keys.length > 0) {
    for (const key of options.keys) {
      if (!KEY_RE.test(key)) fail(2, `键名不合法：${key}`)
      if (!all.some((item) => item.key === key)) fail(4, `凭证不存在：${key}`)
    }
    return all.filter((item) => options.keys.includes(item.key))
  }
  const groups = options.groups.filter((group) => group && group !== 'all')
  if (options.groups.includes('all') || groups.length === 0) return all
  return all.filter((item) => groups.includes(item.group))
}

const [command = '', ...argv] = process.argv.slice(2)
const options = parseArgs(argv)

if (!command || options.help || command === 'help') {
  process.stdout.write(USAGE)
  process.exit(command ? 0 : 2)
}

if (command === 'passwd' || command === 'passphrase') {
  const dir = dataDir(options)
  const dbPath = path.join(dir, 'vault.db')
  if (!fs.existsSync(dbPath)) fail(5, `金库未初始化（${dbPath} 不存在）。先在 DSH 设置里创建。`)
  const store = openStore(dbPath)
  const kdf = store.kdf()
  if (!kdf) fail(5, '金库尚未初始化（缺少 KDF 参数）。')
  const oldKey = readKeyFile(options) ?? deriveKey(await readPassphrase(options), kdf.salt, kdf.params)
  const verified = store.checkKey(oldKey)
  if (verified === false) fail(3, '当前口令不正确')
  if (verified === null) {
    const probe = store.list({ includeDeleted: true })[0]
    const probeBlob = probe ? store.blobOf(probe.key) : null
    if (probeBlob) {
      try { openBlob(oldKey, probeBlob) } catch { fail(3, '当前口令不正确') }
    }
  }
  const next = options.newPassphrase ?? await readHidden('新主口令: ')
  if (next.length < 8) fail(2, '新口令至少 8 个字符')
  if (!options.newPassphrase) {
    const again = await readHidden('再输一次: ')
    if (next !== again) fail(2, '两次输入不一致')
  }
  store.unlock(oldKey)
  const salt = newSalt()
  const rotated = store.rotate(deriveKey(next, salt), salt, KDF_DEFAULTS)
  const file = defaultPassphraseFile()
  fs.mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  fs.writeFileSync(file, next + '\n', { mode: 0o600 })
  try { fs.writeFileSync(defaultKeyFile(), store.keySnapshot().toString('base64') + '\n', { mode: 0o600 }) } catch {}
  process.stdout.write(`已换钥：${rotated} 条密文重新加密；口令已写入 ${file}\n`)
  process.stdout.write('记得在面板「同步」里推送，让其它机器拿到新密文。\n')
  store.close()
  process.exit(0)
}

if (command === 'key') {
  // 甲方案：钥匙文件就是"可搬运的解锁凭据"，用 scp/U 盘搬到另一台机器即可零输入使用。
  const sub = argv[0] || 'path'
  const dir = dataDir(options)
  const dbPath = path.join(dir, 'vault.db')
  if (sub === 'path') { process.stdout.write(defaultKeyFile() + '\n'); process.exit(0) }
  if (sub === 'export') {
    const key = readKeyFile(options)
    if (!key) fail(3, `本机没有可用的钥匙文件：${defaultKeyFile()}。先在面板里解锁并「保存到本机」。`)
    const out = options.out ? path.resolve(resolveHome(options.out)) : path.join(process.cwd(), `dsh-bws-key-${os.hostname()}`)
    fs.writeFileSync(out, key.toString('base64') + '\n', { mode: 0o600 })
    process.stdout.write(`已导出钥匙文件：${out}（0600，Unix 换行）\n`)
    process.stdout.write('搬到另一台机器后执行：dsh-bws key import <该文件>\n')
    process.exit(0)
  }
  if (sub === 'import') {
    const file = argv[1]
    if (!file) fail(2, '用法：dsh-bws key import <文件>')
    let key
    try { key = Buffer.from(fs.readFileSync(path.resolve(resolveHome(file)), 'utf8').trim(), 'base64') } catch (err) { fail(4, `读不到 ${file}：${err.message}`) }
    if (!key || key.length !== 32) fail(4, '钥匙文件格式不对（应为 base64 的 32 字节）')
    if (!fs.existsSync(dbPath)) fail(5, `金库未初始化（${dbPath} 不存在）。先 clone 仓库并安装插件。`)
    const store = openStore(dbPath)
    const verdict = store.checkKey(key)
    if (verdict === false) fail(3, '这把钥匙打不开这台机器的金库：口令/钥匙不是同一个金库的。')
    fs.mkdirSync(path.dirname(defaultKeyFile()), { recursive: true, mode: 0o700 })
    fs.writeFileSync(defaultKeyFile(), key.toString('base64') + '\n', { mode: 0o600 })
    process.stdout.write(`已导入钥匙：${defaultKeyFile()}（0600）\n`)
    if (verdict === null) process.stdout.write('注意：这个金库还没有验证锚，所以只做了文件写入，第一次取值时会校验。\n')
    process.exit(0)
  }
  fail(2, `未知的 key 子命令：${sub}（可用 path / export / import）`)
}

if (command === 'version' || command === '--version') {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  process.stdout.write(pkg.version + '\n')
  process.exit(0)
}

if (command === 'list') {
  const store = await openUnlocked(options)
  const items = selectSecrets(store, options)
  if (options.json) {
    process.stdout.write(JSON.stringify(items.map(({ id, key, group, note, valueLength, revision, updatedAt }) =>
      ({ key, group, note, valueLength, revision, updatedAt })), null, 2) + '\n')
  } else {
    const width = items.reduce((max, item) => Math.max(max, item.key.length), 0)
    for (const item of items) {
      process.stdout.write(item.key.padEnd(width) + '  ' + item.group.padEnd(14) + '  ' + (item.note || '').split('\n')[0].slice(0, 70) + '\n')
    }
  }
  store.close()
  process.exit(0)
}

if (command === 'groups') {
  const store = await openUnlocked(options)
  const groups = store.groups()
  const counts = Object.fromEntries(groups.map((group) => [group.id, 0]))
  for (const item of store.list()) counts[item.group] = (counts[item.group] ?? 0) + 1
  if (options.json) {
    process.stdout.write(JSON.stringify(groups.map((group) => ({ ...group, count: counts[group.id] ?? 0 })), null, 2) + '\n')
  } else {
    for (const group of groups) {
      process.stdout.write(group.id.padEnd(16) + '  ' + (group.tier === 'shared' ? '通用层' : '项目层') + '  ' + (counts[group.id] ?? 0) + ' 条  ' + group.title + '\n')
    }
  }
  store.close()
  process.exit(0)
}

if (command === 'has') {
  const key = options.positional[0]
  if (!key) fail(2, '用法：dsh-bws has <KEY>')
  const store = await openUnlocked(options)
  const found = Boolean(store.get(key)) && !store.get(key).deleted
  store.close()
  process.exit(found ? 0 : 4)
}

if (command === 'get') {
  const key = options.positional[0]
  if (!key) fail(2, '用法：dsh-bws get <KEY> [--raw]')
  if (!KEY_RE.test(key)) fail(2, `键名不合法：${key}`)
  const store = await openUnlocked(options)
  let value
  try {
    value = store.reveal(key)
  } catch {
    fail(4, `凭证不存在：${key}`)
  }
  process.stdout.write(options.raw ? value : value + (value.endsWith('\n') ? '' : '\n'))
  store.close()
  process.exit(0)
}

if (command === 'check') {
  const store = await openUnlocked(options)
  store.close()
  process.stdout.write('口令正确，金库可解。\n')
  process.exit(0)
}

if (command === 'run' || command === 'exec') {
  const cmd = options.rest
  if (cmd.length === 0) fail(2, '用法：dsh-bws run [--group <分组>] [--key <KEY>]... [--file KEY[=路径]]... -- <命令> [参数...]')
  const store = await openUnlocked(options)
  const items = selectSecrets(store, options)
  const present = new Set(items.map((item) => item.key))
  const missing = options.requires.filter((key) => !present.has(key))
  if (missing.length > 0) { store.close(); fail(4, `缺少必填密钥：${missing.join(', ')}`) }

  const env = { ...process.env }
  const injected = []
  for (const item of items) {
    env[item.key] = store.reveal(item.key)
    injected.push(item.key)
  }

  // --file：把密钥写成 0600 文件（供 ssh -i、PGPASSFILE 这类只认路径的消费者）。
  const materialized = []
  if (options.files.length > 0) {
    const runtimeDir = options.runtimeDir || join(process.env.XDG_RUNTIME_DIR || tmpdir(), 'dsh-bws')
    await mkdir(runtimeDir, { recursive: true, mode: 0o700 })
    await chmod(runtimeDir, 0o700).catch(() => {})
    for (const spec of options.files) {
      const eq = spec.indexOf('=')
      const key = eq === -1 ? spec : spec.slice(0, eq)
      if (!key) fail(2, '--file 用法：--file KEY 或 --file KEY=/某个/路径')
      if (!present.has(key)) { store.close(); fail(4, `--file 指定的密钥不存在或未被选中：${key}`) }
      const target = eq === -1 ? join(runtimeDir, key.toLowerCase()) : resolveHome(spec.slice(eq + 1))
      await mkdir(dirname(target), { recursive: true, mode: 0o700 })
      const value = store.reveal(key)
      await writeFile(target, value, { mode: 0o600 })
      await chmod(target, 0o600)
      env['DSH_BWS_FILE_' + key] = target
      materialized.push(target)
    }
  }
  store.close()

  const cleanup = () => { if (options.keepFiles) return; for (const file of materialized) { try { unlinkSync(file) } catch {} } }
  const note = [
    `注入 ${injected.length} 个变量：${injected.slice(0, 10).join(', ')}${injected.length > 10 ? ' …' : ''}`,
    materialized.length > 0 ? `物化 ${materialized.length} 个文件：${materialized.join(', ')}` : ''
  ].filter(Boolean).join('；')
  if (!options.quiet) process.stderr.write('dsh-bws: ' + note + '\n')

  const child = spawn(cmd[0], cmd.slice(1), { stdio: 'inherit', env })
  const forward = (signal) => { try { child.kill(signal) } catch {} }
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, () => forward(signal))
  child.on('error', (err) => { cleanup(); fail(2, `无法执行 ${cmd[0]}：${err.message}`) })
  child.on('exit', (code, signal) => { cleanup(); process.exit(signal ? 128 : (code ?? 1)) })
} else {
  fail(2, `未知命令：${command}\n\n${USAGE}`)
}
