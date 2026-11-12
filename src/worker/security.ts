import type { Context } from 'hono'
import type { Env } from './env'

const SESSION_TTL_SECONDS = 60 * 60 * 12
const PRODUCTION_COOKIE = '__Host-networking_bingo_admin'
const LOCAL_COOKIE = 'networking_bingo_admin'
const encoder = new TextEncoder()

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null
  try {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
    const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4))
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    return null
  }
}

async function hmacKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usage)
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index]! ^ right[index]!
  return difference === 0
}

/** Verifies the versioned PBKDF2-SHA-256 format emitted by scripts/hash-admin-password.mjs. */
export async function verifyAdminPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, iterationText, saltText, hashText, extra] = storedHash.split('$')
  if (extra !== undefined || algorithm !== 'pbkdf2-sha256' || iterationText !== '600000') return false
  const salt = base64UrlToBytes(saltText ?? '')
  const expected = base64UrlToBytes(hashText ?? '')
  if (!salt || salt.length !== 16 || !expected || expected.length !== 32) return false

  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const saltBuffer = new Uint8Array(new ArrayBuffer(salt.length))
  saltBuffer.set(salt)
  const result = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBuffer, iterations: 600_000 }, key, 256))
  return equalBytes(result, expected)
}

function isSecureRequest(c: Context<{ Bindings: Env }>): boolean {
  return new URL(c.req.url).protocol === 'https:'
}

function cookieName(c: Context<{ Bindings: Env }>): string {
  return isSecureRequest(c) ? PRODUCTION_COOKIE : LOCAL_COOKIE
}

function readCookie(c: Context<{ Bindings: Env }>, name: string): string | null {
  const cookies = c.req.header('Cookie') ?? ''
  for (const part of cookies.split(';')) {
    const separator = part.indexOf('=')
    if (separator >= 0 && part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim()
  }
  return null
}

async function sessionIdHash(id: string): Promise<string> {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(id))))
}

async function signature(payload: string, secret: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret, ['sign']), encoder.encode(payload)))
}

function setSessionCookie(c: Context<{ Bindings: Env }>, value: string, maxAge: number): void {
  const secure = isSecureRequest(c)
  const cookie = `${cookieName(c)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
  c.header('Set-Cookie', cookie, { append: true })
}

export async function createAdminSession(c: Context<{ Bindings: Env }>): Promise<void> {
  const secret = c.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET is not configured')

  const random = crypto.getRandomValues(new Uint8Array(32))
  const sessionId = bytesToBase64Url(random)
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const payload = 'v1.' + expiresAt + '.' + sessionId
  const token = bytesToBase64Url(encoder.encode(payload)) + '.' + bytesToBase64Url(await signature(payload, secret))

  await c.env.bingotasks.prepare('INSERT INTO admin_sessions (id, expires_at) VALUES (?, ?)')
    .bind(await sessionIdHash(sessionId), expiresAt)
    .run()
  setSessionCookie(c, token, SESSION_TTL_SECONDS)
}

async function decodeSession(token: string, secret: string): Promise<{ id: string; expiresAt: number } | null> {
  const [payloadPart, signaturePart, extra] = token.split('.')
  if (extra !== undefined || !payloadPart || !signaturePart) return null
  const payloadBytes = base64UrlToBytes(payloadPart)
  const actualSignature = base64UrlToBytes(signaturePart)
  if (!payloadBytes || !actualSignature) return null

  let payload: string
  try {
    payload = new TextDecoder('utf-8', { fatal: true }).decode(payloadBytes)
  } catch {
    return null
  }
  const [version, expiresText, id, extraField] = payload.split('.')
  if (extraField !== undefined || version !== 'v1' || !id || !/^\d+$/u.test(expiresText ?? '')) return null
  if (!equalBytes(await signature(payload, secret), actualSignature)) return null

  const expiresAt = Number(expiresText)
  const now = Math.floor(Date.now() / 1000)
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + SESSION_TTL_SECONDS) return null
  return { id, expiresAt }
}

export async function getAdminSession(c: Context<{ Bindings: Env }>): Promise<boolean> {
  const secret = c.env.SESSION_SECRET
  if (!secret || secret.length < 32) return false
  const token = readCookie(c, cookieName(c))
  if (!token) return false
  const session = await decodeSession(token, secret)
  if (!session) return false
  const stored = await c.env.bingotasks.prepare('SELECT 1 AS active FROM admin_sessions WHERE id = ? AND expires_at > ?')
    .bind(await sessionIdHash(session.id), Math.floor(Date.now() / 1000))
    .first<{ active: number }>()
  return Boolean(stored)
}

export async function revokeAdminSession(c: Context<{ Bindings: Env }>): Promise<void> {
  const secret = c.env.SESSION_SECRET
  const token = readCookie(c, cookieName(c))
  if (secret && secret.length >= 32 && token) {
    const session = await decodeSession(token, secret)
    if (session) {
      await c.env.bingotasks.prepare('DELETE FROM admin_sessions WHERE id = ?')
        .bind(await sessionIdHash(session.id))
        .run()
    }
  }
  setSessionCookie(c, '', 0)
}

export async function consumeRateLimit(
  c: Context<{ Bindings: Env }>,
  scope: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<Response | null> {
  const now = Math.floor(Date.now() / 1000)
  const resetAt = now + windowSeconds
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'local'
  const identity = bytesToBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(ip))))
  const key = scope + ':' + identity

  await c.env.bingotasks.prepare('DELETE FROM admin_rate_limits WHERE reset_at <= ?').bind(now - 86_400).run()
  const row = await c.env.bingotasks.prepare(`
    INSERT INTO admin_rate_limits (key, count, reset_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
      reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END
    RETURNING count, reset_at
  `).bind(key, resetAt, now, now, resetAt).first<{ count: number; reset_at: number }>()

  if (!row || row.count <= maxAttempts) return null
  return c.json({ error: 'Too many requests. Try again later.' }, 429, { 'Retry-After': String(Math.max(1, row.reset_at - now)) })
}
