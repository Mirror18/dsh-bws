// 值加密：scrypt 派生 32 字节密钥，AES-256-GCM 加密。
// 口令永不落盘；盐与 KDF 参数公开（随仓库同步），密钥每次解锁时从口令重算。
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto'

export const KDF_DEFAULTS = { N: 32768, r: 8, p: 1 }

const KEY_LEN = 32
const NONCE_LEN = 12
const TAG_LEN = 16
const BLOB_VERSION = 1

export function deriveKey (passphrase, salt, params = KDF_DEFAULTS) {
  if (typeof passphrase !== 'string' || passphrase.length === 0) throw new Error('口令不能为空')
  const p = {
    N: params.N ?? KDF_DEFAULTS.N,
    r: params.r ?? KDF_DEFAULTS.r,
    p: params.p ?? KDF_DEFAULTS.p
  }
  return scryptSync(Buffer.from(passphrase, 'utf8'), Buffer.from(salt), KEY_LEN, {
    N: p.N,
    r: p.r,
    p: p.p,
    maxmem: 512 * 1024 * 1024
  })
}

export function newSalt () {
  return randomBytes(16)
}

export function seal (key, plaintext) {
  const nonce = randomBytes(NONCE_LEN)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  const ct = Buffer.concat([cipher.update(Buffer.from(String(plaintext), 'utf8')), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([Buffer.from([BLOB_VERSION]), nonce, tag, ct])
}

export function open (key, blob) {
  const buf = Buffer.from(blob)
  if (buf.length < 1 + NONCE_LEN + TAG_LEN) throw new Error('密文长度不足')
  if (buf[0] !== BLOB_VERSION) throw new Error(`不支持的密文版本 ${buf[0]}`)
  const nonce = buf.subarray(1, 1 + NONCE_LEN)
  const tag = buf.subarray(1 + NONCE_LEN, 1 + NONCE_LEN + TAG_LEN)
  const ct = buf.subarray(1 + NONCE_LEN + TAG_LEN)
  const decipher = createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

export function canDecrypt (key, blob) {
  try {
    open(key, blob)
    return true
  } catch {
    return false
  }
}
