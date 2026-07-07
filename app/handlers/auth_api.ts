import { Elysia } from 'elysia'
import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import { eq, and, gt } from 'drizzle-orm'
import { login_codes, users } from '../database/schema'
import { botInstance as bot } from '../bot/bot'

const sqlConnect = new SQL(process.env.DATABASE_URL!)
const db = drizzle(sqlConnect)

const JWT_SECRET = process.env.JWT_SECRET || 'change-me'

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

async function signJwt(payload: Record<string, unknown>): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + 86400 }

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const encodedBody = btoa(JSON.stringify(body)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${encodedHeader}.${encodedBody}`)
  )
  const encodedSig = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  return `${encodedHeader}.${encodedBody}.${encodedSig}`
}

export async function verifyJwt(token: string): Promise<Record<string, unknown> | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [encodedHeader, encodedBody, encodedSig] = parts

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  const sigStr = encodedSig.replace(/-/g, '+').replace(/_/g, '/')
  const sigPadded = sigStr + '='.repeat((4 - sigStr.length % 4) % 4)
  const sigBytes = Uint8Array.from(atob(sigPadded), c => c.charCodeAt(0))

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(`${encodedHeader}.${encodedBody}`)
  )
  if (!valid) return null

  const bodyStr = encodedBody.replace(/-/g, '+').replace(/_/g, '/')
  const bodyPadded = bodyStr + '='.repeat((4 - bodyStr.length % 4) % 4)
  const payload = JSON.parse(atob(bodyPadded))

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null

  return payload
}

export const authApi = new Elysia({ prefix: '/api/auth' })
  .post('/login', async ({ body, set }) => {
    const { code } = body as { code: string }

    if (!code || code.length !== 6) {
      set.status = 400
      return { error: 'Invalid code format' }
    }

    const now = new Date().toISOString()
    const [loginCode] = await db.select().from(login_codes)
      .where(and(
        eq(login_codes.code, code),
        eq(login_codes.used, false),
        gt(login_codes.expires_at, now)
      ))
      .limit(1)

    if (!loginCode) {
      set.status = 401
      return { error: 'Invalid or expired code' }
    }

    await db.update(login_codes)
      .set({ used: true })
      .where(eq(login_codes.id, loginCode.id))

    const [user] = await db.select().from(users)
      .where(eq(users.user_id, loginCode.user_id))
      .limit(1)

    if (!user || !user.is_admin) {
      set.status = 403
      return { error: 'Not an admin' }
    }

    const token = await signJwt({
      user_id: user.user_id,
      is_admin: user.is_admin,
      username: user.username,
    })

    try {
      const firstName = user.first_name || 'Admin'
      let message = `🔐 <b>Вход в панель</b>\n`
      message += `━━━━━━━━━━━━━━━━━━━━\n\n`
      message += `Пользователь <b>${firstName}</b> вошёл в веб-панель.\n\n`
      message += `📅 ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`
      await bot.api.sendMessage(Number(user.user_id), message, { parse_mode: 'HTML' })
    } catch (err) {
      // silently ignore notification failures
    }

    return { success: true, token, user: { user_id: user.user_id, username: user.username } }
  })

  .get('/me', async ({ set, request }) => {
    const token = getBearerToken(request)
    if (!token) {
      set.status = 401
      return { error: 'Not authenticated' }
    }

    const payload = await verifyJwt(token)
    if (!payload) {
      set.status = 401
      return { error: 'Invalid token' }
    }

    return { user: { user_id: payload.user_id, username: payload.username, is_admin: payload.is_admin } }
  })

  .post('/logout', () => {
    return { success: true }
  })

export async function generateLoginCode(userId: number): Promise<string> {
  const code = generateCode()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  await db.insert(login_codes).values({
    code,
    user_id: userId,
    expires_at: expiresAt,
  })

  return code
}
