import { Elysia } from 'elysia'
import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import { eq, and, count, sql } from 'drizzle-orm'
import {
  users, channels, users_follows, users_settings, admin_keys, stream_logs
} from '../database/schema'
import { verifyJwt, getBearerToken } from './auth_api'

const sqlConnect = new SQL(process.env.DATABASE_URL!)
const db = drizzle(sqlConnect)

async function checkAuth(request: Request, set: any): Promise<boolean> {
  const token = getBearerToken(request)
  if (!token) { set.status = 401; return false }
  const payload = await verifyJwt(token)
  if (!payload) { set.status = 401; return false }
  return true
}

export const adminApi = new Elysia({ prefix: '/api/admin' })
  .get('/stats', async ({ request, set }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    const [userCount] = await db.select({ count: count() }).from(users)
    const [channelCount] = await db.select({ count: count() }).from(channels)
    const [followCount] = await db.select({ count: count() }).from(users_follows)
    const [streamLogCount] = await db.select({ count: count() }).from(stream_logs)
    return { users: userCount.count, channels: channelCount.count, follows: followCount.count, streamLogs: streamLogCount.count }
  })

  .get('/users', async ({ request, set }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    return await db.select().from(users)
  })
  .post('/users', async ({ body, set, request }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    const data = body as { user_id: number; username?: string; first_name?: string; is_admin?: boolean }
    const [user] = await db.insert(users).values({
      user_id: data.user_id, username: data.username ?? null, first_name: data.first_name ?? null,
      created: new Date().toISOString(), is_admin: data.is_admin ?? false,
    }).returning()
    set.status = 201
    return user
  })
  .get('/users/:id', async ({ params, set, request }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    const [user] = await db.select().from(users).where(eq(users.user_id, Number(params.id))).limit(1)
    if (!user) { set.status = 404; return { error: 'User not found' } }
    return user
  })
  .put('/users/:id', async ({ params, body, set, request }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    const data = body as Partial<{ username: string; first_name: string; is_admin: boolean }>
    const [user] = await db.update(users).set(data).where(eq(users.user_id, Number(params.id))).returning()
    if (!user) { set.status = 404; return { error: 'User not found' } }
    return user
  })
  .delete('/users/:id', async ({ params, set, request }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    const [user] = await db.delete(users).where(eq(users.user_id, Number(params.id))).returning()
    if (!user) { set.status = 404; return { error: 'User not found' } }
    return user
  })

  .get('/channels', async ({ request, set }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    return await db.select().from(channels)
  })
  .post('/channels', async ({ body, set, request }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    const data = body as { channel_id: number; channel_name: string; platform: string }
    const [channel] = await db.insert(channels).values({
      channel_id: data.channel_id, channel_name: data.channel_name, platform: data.platform,
    }).returning()
    set.status = 201
    return channel
  })
  .get('/channels/:id', async ({ params, set, request }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    const [channel] = await db.select().from(channels).where(eq(channels.channel_id, Number(params.id))).limit(1)
    if (!channel) { set.status = 404; return { error: 'Channel not found' } }
    return channel
  })
  .put('/channels/:id', async ({ params, body, set, request }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    const data = body as Partial<{ channel_name: string; platform: string }>
    const [channel] = await db.update(channels).set(data).where(eq(channels.channel_id, Number(params.id))).returning()
    if (!channel) { set.status = 404; return { error: 'Channel not found' } }
    return channel
  })
  .delete('/channels/:id', async ({ params, set, request }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    const [channel] = await db.delete(channels).where(eq(channels.channel_id, Number(params.id))).returning()
    if (!channel) { set.status = 404; return { error: 'Channel not found' } }
    return channel
  })

  .get('/follows', async ({ request, set }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    return await db.select({
      user_id: users_follows.user_id, username: users.username, first_name: users.first_name,
      channel_id: users_follows.channel_id, channel_name: channels.channel_name,
      platform: users_follows.platform, created: users_follows.created,
    })
      .from(users_follows)
      .innerJoin(users, eq(users_follows.user_id, users.user_id))
      .innerJoin(channels, eq(users_follows.channel_id, channels.channel_id))
  })
  .post('/follows', async ({ body, set, request }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    const data = body as { user_id: number; channel_id: number; platform: string }
    const [follow] = await db.insert(users_follows).values({
      user_id: data.user_id, channel_id: data.channel_id, platform: data.platform, created: new Date().toISOString(),
    }).returning()
    set.status = 201
    return follow
  })
  .delete('/follows/:userId/:channelId', async ({ params, set, request }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    const [follow] = await db.delete(users_follows)
      .where(and(eq(users_follows.user_id, Number(params.userId)), eq(users_follows.channel_id, Number(params.channelId))))
      .returning()
    if (!follow) { set.status = 404; return { error: 'Follow not found' } }
    return follow
  })

  .get('/admin-keys', async ({ request, set }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    return await db.select({
      id: admin_keys.id, key: admin_keys.key, issue_date: admin_keys.issue_date,
      issued_by: admin_keys.issued_by, issued_by_name: users.first_name, issued_by_username: users.username,
      used: admin_keys.used, used_date: admin_keys.used_date, used_by: admin_keys.used_by,
    }).from(admin_keys).leftJoin(users, eq(admin_keys.issued_by, users.user_id))
  })
  .post('/admin-keys', async ({ body, set, request }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    const data = body as { key: string; issued_by?: number }
    const [adminKey] = await db.insert(admin_keys).values({
      key: data.key, issue_date: new Date().toISOString(), issued_by: data.issued_by ?? null,
    }).returning()
    set.status = 201
    return adminKey
  })
  .put('/admin-keys/:id', async ({ params, body, set, request }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    const data = body as Partial<{ used: boolean; used_by: number }>
    const updateData: Record<string, unknown> = { ...data }
    if (data.used) updateData.used_date = new Date().toISOString()
    const [adminKey] = await db.update(admin_keys).set(updateData).where(eq(admin_keys.id, Number(params.id))).returning()
    if (!adminKey) { set.status = 404; return { error: 'Admin key not found' } }
    return adminKey
  })
  .delete('/admin-keys/:id', async ({ params, set, request }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    const [adminKey] = await db.delete(admin_keys).where(eq(admin_keys.id, Number(params.id))).returning()
    if (!adminKey) { set.status = 404; return { error: 'Admin key not found' } }
    return adminKey
  })

  .get('/stream-logs', async ({ request, set }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    return await db.select({
      id: stream_logs.id, channel_id: stream_logs.channel_id, channel_name: channels.channel_name,
      platform: stream_logs.platform, event: stream_logs.event, created: stream_logs.created,
    })
      .from(stream_logs)
      .leftJoin(channels, eq(stream_logs.channel_id, channels.channel_id))
      .orderBy(sql`${stream_logs.id} DESC`)
      .limit(100)
  })

  .get('/users/:id/settings', async ({ params, set, request }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    const [settings] = await db.select().from(users_settings)
      .where(eq(users_settings.user_id, Number(params.id))).limit(1)
    if (!settings) { set.status = 404; return { error: 'Settings not found' } }
    return settings
  })
  .put('/users/:id/settings', async ({ params, body, set, request }) => {
    if (!await checkAuth(request, set)) return { error: 'Not authenticated' }
    const data = body as Partial<{ online_notification: number; offline_notification: number }>
    const [settings] = await db.update(users_settings).set(data)
      .where(eq(users_settings.user_id, Number(params.id))).returning()
    if (!settings) { set.status = 404; return { error: 'Settings not found' } }
    return settings
  })
