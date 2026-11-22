// 本地金库：SQLite 存元数据 + 密文；仓库目录存一份可 git 同步的按条导出。
// 明文只存在于进程内存（unlock 后持有的 key）与一次调用的返回值里。
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { seal, open as openBlob } from './crypto.js'

export const KEY_RE = /^[A-Z][A-Z0-9_]*$/
export const LEVELS = ['none', 'read', 'write']

const VERIFIER_TEXT = 'dsh-bws-vault-v1'

export function nowIso () {
  return new Date().toISOString()
}

export function normalizeLevel (level) {
  return LEVELS.includes(level) ? level : 'none'
}

export function assertKey (key) {
  if (typeof key !== 'string' || !KEY_RE.test(key)) {
    throw new Error(`键名不合法：${JSON.stringify(key)}（需 ^[A-Z][A-Z0-9_]*$）`)
  }
  return key
}

function ensureDir (dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
}

/** SQLite 的 -wal / -shm 不受建库时的 mode 控制，打开后统一收紧；目录本身已是 0700。 */
function hardenDbFiles (dbPath) {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.chmodSync(dbPath + suffix, 0o600)
    } catch {
      // 文件可能还没被创建（例如 -shm 在只读连接下不存在），忽略。
    }
  }
}

/** 打开（必要时创建）一个金库。dbPath 为 SQLite 文件路径。 */
export function openStore (dbPath) {
  ensureDir(path.dirname(dbPath))
  const db = new DatabaseSync(dbPath)
  hardenDbFiles(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  hardenDbFiles(dbPath)
  db.exec('PRAGMA synchronous = FULL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS kdf (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      salt BLOB NOT NULL, n INTEGER NOT NULL, r INTEGER NOT NULL, p INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, tier TEXT NOT NULL, ord INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS secrets (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      group_id TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      blob BLOB,
      value_len INTEGER NOT NULL DEFAULT 0,
      revision INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS secrets_group_idx ON secrets(group_id);
    CREATE TABLE IF NOT EXISTS grants (
      workspace TEXT NOT NULL, group_id TEXT NOT NULL, level TEXT NOT NULL,
      PRIMARY KEY (workspace, group_id)
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL,
      action TEXT NOT NULL, secret_key TEXT, detail TEXT
    );
  `)

  let key = null // unlock 后持有 Buffer

  const api = {
    dbPath,
    close () { try { db.close() } catch {} },
    isLocked () { return key === null },
    /** 解锁后导出当前密钥的副本（用于生成 0600 的 key 文件，让服务免口令启动）。 */
    keySnapshot () { return key ? Buffer.from(key) : null },
    unlock (keyBuf) { key = Buffer.from(keyBuf) },
    lock () { key = null },

    // ---- KDF ----
    kdf () {
      const row = db.prepare('SELECT salt, n, r, p, created_at FROM kdf WHERE id = 1').get()
      if (!row) return null
      return {
        salt: Buffer.from(row.salt),
        params: { N: row.n, r: row.r, p: row.p },
        createdAt: row.created_at
      }
    },
    seekdf (salt, params) {
      db.prepare('INSERT OR REPLACE INTO kdf (id, salt, n, r, p, created_at) VALUES (1, ?, ?, ?, ?, ?)')
        .run(Buffer.from(salt), params.N, params.r, params.p, nowIso())
    },

    /** 口令验证锚：与条目无关，空金库也能区分对口令/错口令。 */
    setVerifier () {
      if (!key) throw new Error('金库未解锁')
      db.prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)')
        .run('verifier', seal(key, VERIFIER_TEXT).toString('base64'))
      return true
    },
    verifierBlob () {
      const v = api.meta('verifier')
      return v ? Buffer.from(v, 'base64') : null
    },
    /** true=口令对，false=不对，null=没有锚（旧库，退回按密文探测）。 */
    checkKey (candidate) {
      const blob = api.verifierBlob()
      if (!blob) return null
      try { return openBlob(candidate, blob).toString() === VERIFIER_TEXT } catch { return false }
    },

    // ---- meta ----
    meta (k) {
      const row = db.prepare('SELECT v FROM meta WHERE k = ?').get(String(k))
      return row ? row.v : null
    },
    setMeta (k, v) {
      db.prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)').run(String(k), String(v))
    },

    // ---- 分组 / 授权 ----
    groups () {
      return db.prepare('SELECT id, title, tier, ord FROM groups ORDER BY ord, id').all()
        .map((r) => ({ id: r.id, title: r.title, tier: r.tier, order: r.ord }))
    },
    saveGroups (list) {
      db.prepare('DELETE FROM groups').run()
      const ins = db.prepare('INSERT INTO groups (id, title, tier, ord) VALUES (?, ?, ?, ?)')
      list.forEach((g, i) => {
        ins.run(String(g.id), String(g.title ?? g.id), g.tier === 'shared' ? 'shared' : 'project',
          Number.isFinite(g.order) ? g.order : i)
      })
    },
    grants () {
      return db.prepare('SELECT workspace, group_id, level FROM grants ORDER BY workspace, group_id').all()
        .map((r) => ({ workspace: r.workspace, group: r.group_id, level: r.level }))
    },
    saveGrants (list) {
      db.prepare('DELETE FROM grants').run()
      const ins = db.prepare('INSERT INTO grants (workspace, group_id, level) VALUES (?, ?, ?)')
      for (const g of list) {
        const level = normalizeLevel(g.level)
        if (level === 'none' || !g.workspace || !g.group) continue
        ins.run(String(g.workspace), String(g.group), level)
      }
    },

    // ---- 凭证 ----
    list ({ includeDeleted = false } = {}) {
      const sql = includeDeleted
        ? 'SELECT id, key, group_id, note, value_len, revision, created_at, updated_at, deleted, deleted_at FROM secrets ORDER BY key'
        : 'SELECT id, key, group_id, note, value_len, revision, created_at, updated_at, deleted, deleted_at FROM secrets WHERE deleted = 0 ORDER BY key'
      return db.prepare(sql).all().map((r) => ({
        id: r.id,
        key: r.key,
        group: r.group_id,
        note: r.note,
        valueLength: r.value_len,
        revision: r.revision,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        deleted: r.deleted === 1,
        deletedAt: r.deleted_at
      }))
    },
    get (keyName) {
      const r = db.prepare('SELECT * FROM secrets WHERE key = ?').get(String(keyName))
      if (!r) return null
      return {
        id: r.id,
        key: r.key,
        group: r.group_id,
        note: r.note,
        valueLength: r.value_len,
        revision: r.revision,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        deleted: r.deleted === 1,
        deletedAt: r.deleted_at
      }
    },
    blobOf (keyName) {
      const r = db.prepare('SELECT blob FROM secrets WHERE key = ? AND deleted = 0').get(String(keyName))
      return r ? r.blob : null
    },
    /**
     * 换口令时只做一件事：把每条密文用新密钥重新封装一遍。
     * 调用方负责新盐/新参数与落盘、提交；这里保证原子（失败回滚）。
     */
    rotate (newKey, newSalt, params) {
      if (!key) throw new Error('金库未解锁')
      const rows = db.prepare('SELECT id, blob FROM secrets WHERE blob IS NOT NULL').all()
      const update = db.prepare('UPDATE secrets SET blob = ? WHERE id = ?')
      db.exec('BEGIN')
      try {
        for (const row of rows) {
          const plain = openBlob(key, Buffer.from(row.blob))
          update.run(seal(newKey, plain), row.id)
        }
        if (newSalt && params) {
          db.prepare('INSERT OR REPLACE INTO kdf (id, salt, n, r, p, created_at) VALUES (1, ?, ?, ?, ?, ?)')
            .run(Buffer.from(newSalt), params.N, params.r, params.p, nowIso())
        }
        db.exec('COMMIT')
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
      key = Buffer.from(newKey)
      api.setVerifier()
      api.logEvent('rotate', null, `${rows.length} 条密文已换钥`)
      return rows.length
    },

    reveal (keyName) {
      if (!key) throw new Error('金库未解锁')
      const blob = api.blobOf(keyName)
      if (!blob) throw new Error(`凭证不存在：${keyName}`)
      return openBlob(key, blob)
    },
    put ({ key: keyName, value, group, note }) {
      if (!key) throw new Error('金库未解锁')
      assertKey(keyName)
      const groupId = String(group ?? 'common')
      const ts = nowIso()
      const existing = api.get(keyName)
      if (existing) {
        const revision = existing.revision + 1
        db.prepare('UPDATE secrets SET group_id = ?, note = ?, blob = ?, value_len = ?, revision = ?, updated_at = ?, deleted = 0, deleted_at = NULL WHERE key = ?')
          .run(groupId, String(note ?? existing.note ?? ''), seal(key, value), Buffer.byteLength(String(value)), revision, ts, keyName)
        api.logEvent('update', keyName, `group=${groupId} rev=${revision}`)
        return api.get(keyName)
      }
      db.prepare(`INSERT INTO secrets (id, key, group_id, note, blob, value_len, revision, created_at, updated_at, deleted, deleted_at)
                  VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 0, NULL)`)
        .run(randomUUID(), keyName, groupId, String(note ?? ''), seal(key, value), Buffer.byteLength(String(value)), ts, ts)
      api.logEvent('create', keyName, `group=${groupId}`)
      return api.get(keyName)
    },
    update (keyName, patch = {}) {
      if (!key) throw new Error('金库未解锁')
      const existing = api.get(keyName)
      if (!existing) throw new Error(`凭证不存在：${keyName}`)
      const nextKey = patch.newKey ? assertKey(patch.newKey) : keyName
      if (nextKey !== keyName && api.get(nextKey)) throw new Error(`键名已存在：${nextKey}`)
      const ts = nowIso()
      const revision = existing.revision + 1
      let blob = db.prepare('SELECT blob FROM secrets WHERE key = ?').get(keyName).blob
      let valueLen = existing.valueLength
      if (patch.value !== undefined) {
        blob = seal(key, patch.value)
        valueLen = Buffer.byteLength(String(patch.value))
      }
      db.prepare('UPDATE secrets SET key = ?, group_id = ?, note = ?, blob = ?, value_len = ?, revision = ?, updated_at = ? WHERE key = ?')
        .run(nextKey, patch.group ?? existing.group, patch.note ?? existing.note, blob, valueLen, revision, ts, keyName)
      api.logEvent('update', nextKey, `rev=${revision}${nextKey !== keyName ? ` renamed-from=${keyName}` : ''}`)
      return api.get(nextKey)
    },
    remove (keyName) {
      const existing = api.get(keyName)
      if (!existing) throw new Error(`凭证不存在：${keyName}`)
      const ts = nowIso()
      db.prepare('UPDATE secrets SET deleted = 1, deleted_at = ?, revision = revision + 1, blob = NULL, value_len = 0, updated_at = ? WHERE key = ?')
        .run(ts, ts, keyName)
      api.logEvent('delete', keyName, '')
      return api.get(keyName)
    },

    // ---- 事件 ----
    logEvent (action, secretKey, detail) {
      db.prepare('INSERT INTO events (at, action, secret_key, detail) VALUES (?, ?, ?, ?)')
        .run(nowIso(), String(action), secretKey ? String(secretKey) : null, detail ? String(detail) : null)
    },
    events (limit = 100) {
      return db.prepare('SELECT id, at, action, secret_key, detail FROM events ORDER BY id DESC LIMIT ?').all(Number(limit) || 100)
        .map((r) => ({ id: r.id, at: r.at, action: r.action, key: r.secret_key, detail: r.detail }))
    },

    // ---- 仓库导出 / 导入 ----
    exportTo (repoDir) {
      const metaDir = path.join(repoDir, 'meta')
      const secretsDir = path.join(repoDir, 'secrets')
      ensureDir(metaDir)
      ensureDir(secretsDir)

      const kdfInfo = api.kdf()
      if (kdfInfo) {
        fs.writeFileSync(path.join(metaDir, 'kdf.json'), JSON.stringify({
          version: 1,
          algo: 'scrypt+aes-256-gcm',
          salt: kdfInfo.salt.toString('base64'),
          N: kdfInfo.params.N,
          r: kdfInfo.params.r,
          p: kdfInfo.params.p,
          createdAt: kdfInfo.createdAt,
          verifier: api.meta('verifier') || null
        }, null, 2) + '\n')
      }
      fs.writeFileSync(path.join(metaDir, 'groups.json'), JSON.stringify(api.groups(), null, 2) + '\n')
      fs.writeFileSync(path.join(metaDir, 'grants.json'), JSON.stringify(api.grants(), null, 2) + '\n')

      const rows = api.list({ includeDeleted: true })
      const index = {}
      const written = []
      const removed = []
      const live = new Set()
      for (const row of rows) {
        index[row.key] = {
          id: row.id,
          group: row.group,
          note: row.note,
          revision: row.revision,
          updatedAt: row.updatedAt,
          valueLength: row.valueLength,
          deleted: row.deleted
        }
        const dir = path.join(secretsDir, row.group)
        const file = path.join(dir, `${row.key}.enc`)
        if (row.deleted) {
          if (fs.existsSync(file)) { fs.unlinkSync(file); removed.push(file) }
          continue
        }
        ensureDir(dir)
        const blob = api.blobOf(row.key)
        if (!blob) continue
        fs.writeFileSync(file, Buffer.from(blob), { mode: 0o600 })
        written.push(file)
        live.add(`${row.group}/${row.key}`)
      }
      for (const g of fs.readdirSync(secretsDir, { withFileTypes: true })) {
        if (!g.isDirectory()) continue
        for (const f of fs.readdirSync(path.join(secretsDir, g.name))) {
          if (!f.endsWith('.enc')) continue
          const rel = `${g.name}/${f.slice(0, -4)}`
          if (!live.has(rel)) {
            fs.unlinkSync(path.join(secretsDir, g.name, f))
            removed.push(`${rel}.enc`)
          }
        }
      }
      fs.writeFileSync(path.join(metaDir, 'index.json'), JSON.stringify(index, null, 2) + '\n')
      return { written, removed, count: rows.length }
    },

    importFrom (repoDir) {
      const metaDir = path.join(repoDir, 'meta')
      const readJson = (p, fallback) => {
        try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fallback }
      }
      const kdfFile = readJson(path.join(metaDir, 'kdf.json'), null)
      let saltAdopted = false
      if (kdfFile) {
        const local = api.kdf()
        const remoteSalt = Buffer.from(String(kdfFile.salt), 'base64')
        if (!local) {
          api.seekdf(remoteSalt, { N: kdfFile.N, r: kdfFile.r, p: kdfFile.p })
          saltAdopted = true
        } else if (local.salt.toString('base64') !== remoteSalt.toString('base64')) {
          // 新机器先建了空金库、再拉远端：本地没有任何条目时直接改用远端的盐，
          // 这样同一口令在两边派生同一把密钥。已有条目则说明是两个不同的金库，拒绝合并。
          const localCount = api.list({ includeDeleted: true }).length
          if (localCount > 0) {
            throw new Error(`仓库与本地金库的盐不一致：这看起来是另一个金库（本地已有 ${localCount} 条）。先清空本地金库再拉取。`)
          }
          api.seekdf(remoteSalt, { N: kdfFile.N, r: kdfFile.r, p: kdfFile.p })
          saltAdopted = true
        }
        if (kdfFile.verifier && !api.meta('verifier')) api.setMeta('verifier', String(kdfFile.verifier))
      }
      const groups = readJson(path.join(metaDir, 'groups.json'), null)
      if (Array.isArray(groups) && api.groups().length === 0) api.saveGroups(groups)

      const index = readJson(path.join(metaDir, 'index.json'), {})
      let added = 0
      let updated = 0
      let deleted = 0
      let skipped = 0
      for (const [keyName, entry] of Object.entries(index)) {
        if (!entry || typeof entry !== 'object') continue
        const local = api.get(keyName)
        const remoteRev = Number(entry.revision) || 0
        if (local && remoteRev <= local.revision) { skipped += 1; continue }
        if (entry.deleted) {
          db.prepare(`INSERT INTO secrets (id, key, group_id, note, blob, value_len, revision, created_at, updated_at, deleted, deleted_at)
                      VALUES (?, ?, ?, ?, NULL, 0, ?, ?, ?, 1, ?)
                      ON CONFLICT(key) DO UPDATE SET deleted = 1, blob = NULL, value_len = 0, revision = excluded.revision, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`)
            .run(entry.id || randomUUID(), keyName, entry.group || 'common', entry.note || '',
              remoteRev, entry.updatedAt || nowIso(), entry.updatedAt || nowIso(), entry.updatedAt || nowIso())
          deleted += 1
          continue
        }
        const file = path.join(repoDir, 'secrets', entry.group || 'common', `${keyName}.enc`)
        if (!fs.existsSync(file)) { skipped += 1; continue }
        const blob = fs.readFileSync(file)
        const len = Number(entry.valueLength) || 0
        if (local) {
          db.prepare('UPDATE secrets SET group_id = ?, note = ?, blob = ?, value_len = ?, revision = ?, updated_at = ?, deleted = 0, deleted_at = NULL WHERE key = ?')
            .run(entry.group || 'common', entry.note || '', blob, len, remoteRev, entry.updatedAt || nowIso(), keyName)
          updated += 1
        } else {
          db.prepare(`INSERT INTO secrets (id, key, group_id, note, blob, value_len, revision, created_at, updated_at, deleted, deleted_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`)
            .run(entry.id || randomUUID(), keyName, entry.group || 'common', entry.note || '', blob, len,
              remoteRev, entry.updatedAt || nowIso(), entry.updatedAt || nowIso())
          added += 1
        }
      }
      const remoteGrants = readJson(path.join(metaDir, 'grants.json'), null)
      if (Array.isArray(remoteGrants) && api.grants().length === 0) api.saveGrants(remoteGrants)
      return { added, updated, deleted, skipped, total: Object.keys(index).length, saltAdopted }
    }
  }

  return api
}
