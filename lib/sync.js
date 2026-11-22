// git 同步：仓库里只有密文与元数据，提交信息与审计日志都不含明文。
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const IDENTITY = ['-c', 'user.name=dsh-bws', '-c', 'user.email=dsh-bws@localhost']

async function git (repoDir, args, opts = {}) {
  return run('git', args, {
    cwd: repoDir,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    ...opts
  })
}

export function isRepo (repoDir) {
  return fs.existsSync(path.join(repoDir, '.git'))
}

export async function ensureRepo (repoDir, { branch = 'main' } = {}) {
  fs.mkdirSync(repoDir, { recursive: true, mode: 0o700 })
  if (!isRepo(repoDir)) {
    await git(repoDir, ['init', '-b', branch])
  }
  return { repoDir, branch }
}

export async function remotes (repoDir) {
  try {
    const { stdout } = await git(repoDir, ['remote'])
    return stdout.split('\n').map((s) => s.trim()).filter(Boolean)
  } catch {
    return []
  }
}

export async function setRemote (repoDir, name, url) {
  const existing = await remotes(repoDir)
  if (existing.includes(name)) await git(repoDir, ['remote', 'set-url', name, url])
  else await git(repoDir, ['remote', 'add', name, url])
  return { name, url }
}

export async function commitAll (repoDir, message) {
  await git(repoDir, ['add', '-A'])
  const { stdout: status } = await git(repoDir, ['status', '--porcelain'])
  if (status.trim() === '') return { committed: false }
  await git(repoDir, [...IDENTITY, 'commit', '-m', message])
  const { stdout: sha } = await git(repoDir, ['rev-parse', '--short', 'HEAD'])
  return { committed: true, sha: sha.trim() }
}

export async function currentBranch (repoDir) {
  const { stdout } = await git(repoDir, ['rev-parse', '--abbrev-ref', 'HEAD'])
  return stdout.trim()
}

export async function pushAll (repoDir, names, branch) {
  const results = []
  for (const name of names) {
    try {
      await git(repoDir, ['push', '-u', name, `HEAD:${branch}`])
      results.push({ remote: name, ok: true })
    } catch (err) {
      results.push({ remote: name, ok: false, error: sonify(err) })
    }
  }
  return { branch, results }
}

export async function pullAll (repoDir, names, branch) {
  const results = []
  for (const name of names) {
    try {
      await git(repoDir, ['fetch', name, branch])
      await git(repoDir, [...IDENTITY, 'merge', '--no-edit', `${name}/${branch}`])
      results.push({ remote: name, ok: true, conflict: false })
    } catch (err) {
      const conflict = /CONFLICT|Automatic merge failed|Merge conflict/i.test(`${err.stdout ?? ''}${err.stderr ?? ''}${err.message ?? ''}`)
      if (conflict) {
        try { await git(repoDir, ['merge', '--abort']) } catch {}
      }
      results.push({ remote: name, ok: false, conflict, error: sonify(err) })
    }
  }
  return { branch, results }
}

export async function status (repoDir) {
  if (!isRepo(repoDir)) return { initialized: false, clean: true, remoteList: [] }
  let dirty = []
  let clean = true
  try {
    const { stdout } = await git(repoDir, ['status', '--porcelain'])
    dirty = stdout.split('\n').map((s) => s.trim()).filter(Boolean)
    clean = dirty.length === 0
  } catch {}
  let branch = 'main'
  try { branch = await currentBranch(repoDir) } catch {}
  return { initialized: true, clean, branch, dirtyCount: dirty.length, remoteList: await remotes(repoDir) }
}

function sonify (err) {
  const text = `${err.stderr ?? ''}`.trim() || `${err.message ?? err}`
  return text.replace(/\s+/g, ' ').slice(0, 240)
}
