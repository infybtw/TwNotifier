import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { admin_keys, AdminKey, Channel, channels, NewChannel, NewUser, NewUserSettings, User, UserFollow, users, users_follows, users_settings, UserSettings } from "./schema";
import { and, count, eq } from "drizzle-orm";
import logger from "../logger";

const sqlConnect = new SQL(process.env.DATABASE_URL!)
const db = drizzle(sqlConnect)

const log = logger.getSubLogger({ name: "db" });

export async function getUserByUserId(user_id: number): Promise<User> {
  const [user] = await db.select().from(users).where(eq(users.user_id, user_id)).limit(1)
  return user
}

export async function getSettingsStateByUserId(user_id: number): Promise<UserSettings>{
  const [userSettings] = await db.select().from(users_settings).where(eq(users_settings.user_id, user_id)).limit(1)
  return userSettings
}

export async function getChannelByChannelId(channel_id: number): Promise<Channel> {
  const [channel] = await db.select().from(channels).where(eq(channels.channel_id, channel_id)).limit(1)
  return channel
}

export async function getFollowByUserIdAndChannelId(user_id: number, channel_id: number): Promise<UserFollow>{
  const [follow] = await db.select().from(users_follows).where(and(eq(users_follows.user_id,user_id), eq(users_follows.channel_id, channel_id))).limit(1)
  return follow
}

export async function getFollowsByUserId(user_id: number): Promise<UserFollow[]>{
  const follows = db.select().from(users_follows).where(eq(users_follows.user_id, user_id))
  return follows
}

export async function getChannelFollowersByChannelId(channel_id: number): Promise<UserFollow[]>{
  const follows = await db.select().from(users_follows).where(eq(users_follows.channel_id, channel_id))
  return follows
}

export async function getChannels(): Promise<Channel[]>{
  const res = await db.select().from(channels)
  return res
}

export async function getUsers(): Promise<User[]>{
  const res = await db.select().from(users)
  return res
}

export async function getAdmins(): Promise<User[]>{
  const res = await db.select().from(users).where(eq(users.is_admin, true))
  return res
}

export async function getFollowCount(): Promise<Number>{
  const [{count: followCount}] = await db.select({ count: count() }).from(users_follows);
  return followCount
}

async function addUser(user_id: number, username: string, first_name: string): Promise<User> {
  try {
    const result = await db.transaction(async (tx) => {
      const [newUser] = await tx.insert(users)
        .values({ user_id: user_id, username: username, first_name: first_name, created: new Date().toISOString() })
        .onConflictDoNothing({ target: users.user_id })
        .returning()
      const [newUserSettings] = await tx.insert(users_settings)
        .values({ user_id: user_id })
        .onConflictDoNothing({target: users_settings.user_id})
        .returning()

      if (!newUser || !newUserSettings) {
        tx.rollback()
      }
      return newUser
    })

    return result
  } catch (err) {
    throw new Error(`Failed to add user ${user_id}. ${err}`)
  }
}

async function addChannel(channel_id: number, channel_name: string): Promise<Channel>{
  const [newChannel] = await db.insert(channels).values({ channel_id: channel_id, channel_name: channel_name }).returning()
  if (!newChannel) {
    throw new Error(`Failed to add channel ${channel_id}`)
  }
  return newChannel
}

async function addFollow(user_id: number, channel_id: number): Promise<UserFollow>{
  const [userFollow] = await db.insert(users_follows).values({ user_id: user_id, channel_id: channel_id, created: new Date().toISOString() }).returning()
  if (!userFollow) {
    throw new Error(`Failed to create follow ${user_id}-${channel_id}`)
  }
  return userFollow
}

export async function addAdminKey(user_id: number, key: string): Promise<AdminKey>{
  const [adminKey] = await db.insert(admin_keys).values({ issued_by: user_id, key, issue_date: new Date().toISOString() }).returning()
  return adminKey
}

export async function getAdminKeyByKey(key: string): Promise<AdminKey> {
  const [res] = await db.select().from(admin_keys).where(eq(admin_keys.key, key)).limit(1)
  return res
}

export async function removeFollowByUserIdAndChannelId(user_id: number, channel_id: number): Promise<UserFollow>{
  const [follow] = await db.delete(users_follows)
    .where(and(eq(users_follows.user_id, user_id), eq(users_follows.channel_id, channel_id)))
    .returning()
  return follow
}

export async function checkOrCreateUser(user_id: number, username: string, first_name: string): Promise<{ user: User, isNew: boolean } | undefined> {
  const [exist] = await db.select().from(users).where(eq(users.user_id, user_id)).limit(1)
  if (exist) {
    return { user: exist, isNew: false }
  }
  try {
    const user = await addUser(user_id, username, first_name)
    return { user, isNew: true }
  } catch (err) {
    log.error("Failed to add user.", err)
    return undefined
  }
}

export async function checkOrCreateChannel(channel_id: number, channel_name: string): Promise<{ channel: Channel, isNew: boolean }>{
  const [exist] = await db.select().from(channels).where(eq(channels.channel_id, channel_id)).limit(1)
  if (exist) {
    return {channel: exist, isNew: false}
  }
  const channel = await addChannel(channel_id, channel_name)
  return {channel, isNew: true}
}

export async function checkOrCreateFollow(user_id: number, channel_id: number): Promise<{follow: UserFollow, isNew: boolean}> {
  const [exist] = await db.select().from(users_follows).where(and(eq(users_follows.user_id, user_id),eq(users_follows.channel_id, channel_id))).limit(1)
  if (exist) {
    return {follow: exist, isNew: false}
  }
  const userFollow = await addFollow(user_id, channel_id)
  return {follow: userFollow , isNew: true}
}

export async function makeUserAdmin(user_id: number, key: string): Promise<User | undefined> {
  try {
    const result = await db.transaction(async (tx) => {
      const adminKey = await getAdminKeyByKey(key)
      if (!adminKey || adminKey.used) {
        return undefined
      }
      await setAdminKeyUsedById(adminKey.id, user_id)
      const user = await setUserAdmin(user_id, true)
      return user
    })
    return result
  } catch (err) {
    throw new Error(`Failed to make user admin ${user_id} ${key}. ${err}`)
  }
}

export async function setOnlineNotificationStateByUserId(user_id: number, state: number): Promise<NewUserSettings> {
  const [newUserSettings] = await db.update(users_settings).set({ online_notification: state }).where(eq(users_settings.user_id, user_id)).returning()
  return newUserSettings
}

export async function setOfflineNotificationStateByUserId(user_id: number, state: number): Promise<NewUserSettings> {
  const [newUserSettings] = await db.update(users_settings).set({ offline_notification: state }).where(eq(users_settings.user_id, user_id)).returning()
  return newUserSettings
}

async function setAdminKeyUsedById(id: number, used_by: number): Promise<AdminKey>{
  const [adminKey] = await db.update(admin_keys).set({ used: true, used_date: new Date().toISOString(), used_by}).where(eq(admin_keys.id, id)).returning()
  return adminKey
}

async function setUserAdmin(user_id: number, is_admin: boolean): Promise<User>{
  const [user] = await db.update(users).set({is_admin}).where(eq(users.user_id, user_id)).returning()
  return user
}
