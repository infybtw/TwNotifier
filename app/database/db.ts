import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { DATABASE_URL } from "../config";
import { admin_keys, AdminKey, admin_settings, AdminSettings, Channel, channels, NewAdminSettings, NewUserSettings, Platform, StreamCategory, StreamLog, stream_categories, stream_logs, stream_sessions, User, UserFollow, users, users_follows, users_settings, UserSettings, WebSession, web_sessions } from "./schema";
import { and, asc, count, desc, eq, inArray, isNull, like, lt, or, sql } from "drizzle-orm";
import logger from "../logger";

const sqlConnect = new SQL(DATABASE_URL)
const db = drizzle(sqlConnect)

const log = logger.getSubLogger({ name: "db" });

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Повторная доставка Kick-вебхука приходит в течение секунд,
// а payload без валидного started_at не даёт отличить дубликат от нового стрима
// надёжнее, чем по свежести сессии.
const KICK_DUPLICATE_WINDOW_MS = 60_000;
// Разумный предел давности начала стрима: значения дальше считаем мусорными.
const KICK_MAX_STREAM_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function getUserByUserId(user_id: number): Promise<User> {
  const [user] = await db.select().from(users).where(eq(users.user_id, user_id)).limit(1)
  return user
}

export async function getSettingsStateByUserId(user_id: number): Promise<UserSettings>{
  const [userSettings] = await db.select().from(users_settings).where(eq(users_settings.user_id, user_id)).limit(1)
  return userSettings
}

export async function getAdminSettings(user_id: number): Promise<AdminSettings | undefined> {
  const [settings] = await db.select().from(admin_settings).where(eq(admin_settings.user_id, user_id)).limit(1)
  return settings || undefined
}

export async function setAdminTimezoneOffset(user_id: number, utc_offset: number): Promise<AdminSettings> {
  const [settings] = await db.insert(admin_settings)
    .values({ user_id, utc_offset })
    .onConflictDoUpdate({ target: admin_settings.user_id, set: { utc_offset } })
    .returning()
  return settings
}

export async function getChannelByChannelIdAndPlatform(channel_id: number, platform: Platform): Promise<Channel | undefined> {
  const [channel] = await db.select().from(channels)
    .where(and(eq(channels.channel_id, channel_id), eq(channels.platform, platform))).limit(1)
  return channel
}

export async function getFollowByUserIdChannelIdAndPlatform(user_id: number, channel_id: number, platform: Platform): Promise<UserFollow | undefined>{
  const [follow] = await db.select().from(users_follows).where(and(eq(users_follows.user_id,user_id), eq(users_follows.channel_id, channel_id), eq(users_follows.platform, platform))).limit(1)
  return follow
}

export async function getFollowsByUserId(user_id: number): Promise<UserFollow[]>{
  const follows = await db.select().from(users_follows)
    .where(eq(users_follows.user_id, user_id))
    .orderBy(asc(users_follows.created), asc(users_follows.platform), asc(users_follows.channel_id))
  return follows
}

export async function getFollowsByPlatform(platform: Platform): Promise<UserFollow[]>{
  const res = await db.select().from(users_follows).where(eq(users_follows.platform, platform))
  return res
}

export async function getFollowsByUserIdAndPlatform(user_id: number, platform: Platform): Promise<UserFollow[]>{
  const follows = await db.select().from(users_follows).where(and(eq(users_follows.user_id, user_id), eq(users_follows.platform, platform)))
  return follows
}

export async function getChannelFollowersByChannelIdAndPlatform(channel_id: number, platform: Platform): Promise<UserFollow[]>{
  const follows = await db.select().from(users_follows).where(and(eq(users_follows.channel_id, channel_id), eq(users_follows.platform, platform)))
  return follows
}

export async function getChannels(): Promise<Channel[]>{
  const res = await db.select().from(channels)
  return res
}

export async function getChannelsWithFollowersByPlatform(platform: Platform): Promise<Channel[]>{
  const res = await db.selectDistinct({
    channel_id: channels.channel_id,
    channel_name: channels.channel_name,
    channel_login: channels.channel_login,
    platform: channels.platform,
  })
    .from(channels)
    .innerJoin(users_follows, and(
      eq(channels.channel_id, users_follows.channel_id),
      eq(channels.platform, users_follows.platform),
    ))
    .where(eq(channels.platform, platform))
  return res
}

/**
 * Finds known channels by canonical login. Falls back to the display name so
 * that data written before the `channel_login` backfill keeps working.
 */
export async function getChannelsByLogin(login: string): Promise<Channel[]> {
  const normalized = login.toLowerCase();
  const res = await db.select().from(channels)
    .where(or(eq(channels.channel_login, normalized), eq(channels.channel_name, normalized)))
  return res
}

export async function getChannelsByPlatform(platform: Platform): Promise<Channel[]>{
  const res = await db.select().from(channels).where(eq(channels.platform, platform))
  return res
}

export async function getUsers(): Promise<User[]>{
  const res = await db.select().from(users)
  return res
}

export async function getUsersWithNotificationStatus(): Promise<(User & Pick<UserSettings, "is_bot_blocked">)[]> {
  return db.select({
    user_id: users.user_id,
    username: users.username,
    first_name: users.first_name,
    created: users.created,
    is_admin: users.is_admin,
    is_bot_blocked: users_settings.is_bot_blocked,
  })
    .from(users)
    .innerJoin(users_settings, eq(users.user_id, users_settings.user_id))
}

export async function getUsersForNotifications(): Promise<User[]> {
  return db.select({
    user_id: users.user_id,
    username: users.username,
    first_name: users.first_name,
    created: users.created,
    is_admin: users.is_admin,
  })
    .from(users)
    .innerJoin(users_settings, eq(users.user_id, users_settings.user_id))
    .where(eq(users_settings.is_bot_blocked, 0))
}

export async function getAdmins(): Promise<User[]>{
  const res = await db.select().from(users).where(eq(users.is_admin, true))
  return res
}

export async function getFollowCount(): Promise<Number>{
  const [{count: followCount}] = await db.select({ count: count() }).from(users_follows);
  return followCount
}

export async function getAllFollowsWithDetails() {
  const result = await db
    .select({
      user_id: users_follows.user_id,
      username: users.username,
      first_name: users.first_name,
      channel_id: users_follows.channel_id,
      channel_name: channels.channel_name,
      platform: users_follows.platform,
      created: users_follows.created,
    })
    .from(users_follows)
    .innerJoin(users, eq(users_follows.user_id, users.user_id))
    .innerJoin(channels, and(
      eq(users_follows.channel_id, channels.channel_id),
      eq(users_follows.platform, channels.platform),
    ));
  return result;
}

export async function getFollowsWithChannelByUserId(user_id: number) {
  const result = await db
    .select({
      user_id: users_follows.user_id,
      channel_id: users_follows.channel_id,
      channel_name: channels.channel_name,
      channel_login: channels.channel_login,
      platform: users_follows.platform,
      created: users_follows.created,
    })
    .from(users_follows)
    .innerJoin(channels, and(
      eq(users_follows.channel_id, channels.channel_id),
      eq(users_follows.platform, channels.platform),
    ))
    .where(eq(users_follows.user_id, user_id))
    .orderBy(asc(users_follows.created), asc(users_follows.platform), asc(users_follows.channel_id));
  return result;
}

async function addUser(user_id: number, username: string, first_name: string): Promise<User> {
  try {
    const result = await db.transaction(async (tx) => {
      // Concurrency-safe registration: an existing row is refreshed with the
      // latest verified name without touching saved preferences.
      const [newUser] = await tx.insert(users)
        .values({ user_id: user_id, username: username, first_name: first_name, created: new Date().toISOString() })
        .onConflictDoUpdate({
          target: users.user_id,
          set: { username: username, first_name: first_name },
        })
        .returning()
      await tx.insert(users_settings)
        .values({ user_id: user_id })
        .onConflictDoNothing({ target: users_settings.user_id })
      return newUser
    })

    return result
  } catch (err) {
    throw new Error(`Failed to add user ${user_id}. ${err}`)
  }
}

async function addChannel(channel_id: number, channel_name: string, channel_login: string, platform: Platform): Promise<Channel>{
  const [newChannel] = await db.insert(channels)
    .values({ channel_id: channel_id, channel_name: channel_name, channel_login: channel_login, platform: platform })
    .onConflictDoUpdate({
      target: [channels.platform, channels.channel_id],
      set: { channel_name: channel_name, channel_login: channel_login },
    })
    .returning()
  if (!newChannel) {
    throw new Error(`Failed to add channel ${platform}:${channel_id}`)
  }
  return newChannel
}

async function addFollow(user_id: number, channel_id: number, platform: Platform): Promise<UserFollow>{
  const [userFollow] = await db.insert(users_follows)
    .values({ user_id: user_id, channel_id: channel_id, created: new Date().toISOString(), platform: platform })
    .onConflictDoNothing({ target: [users_follows.user_id, users_follows.platform, users_follows.channel_id] })
    .returning()
  if (!userFollow) {
    // The follow already existed (or was created concurrently); return it.
    const existing = await getFollowByUserIdChannelIdAndPlatform(user_id, channel_id, platform)
    if (!existing) {
      throw new Error(`Failed to create follow ${user_id}-${platform}:${channel_id}`)
    }
    return existing
  }
  return userFollow
}

export async function addAdminKey(user_id: number, key: string): Promise<AdminKey>{
  const [adminKey] = await db.insert(admin_keys).values({ issued_by: user_id, key, issue_date: new Date().toISOString() }).returning()
  return adminKey
}

export async function getAllAdminKeys() {
  const result = await db
    .select({
      id: admin_keys.id,
      key: admin_keys.key,
      issue_date: admin_keys.issue_date,
      issued_by: admin_keys.issued_by,
      issued_by_name: users.first_name,
      issued_by_username: users.username,
      used: admin_keys.used,
      used_date: admin_keys.used_date,
      used_by: admin_keys.used_by,
    })
    .from(admin_keys)
    .leftJoin(users, eq(admin_keys.issued_by, users.user_id));
  return result;
}

export async function revokeAdminKey(id: number): Promise<AdminKey | undefined> {
  const [deleted] = await db.delete(admin_keys).where(eq(admin_keys.id, id)).returning()
  return deleted
}

export async function getAdminKeyByKey(key: string): Promise<AdminKey> {
  const [res] = await db.select().from(admin_keys).where(eq(admin_keys.key, key)).limit(1)
  return res
}

export async function removeFollowByUserIdChannelIdAndPlatfrom(user_id: number, channel_id: number, platform: Platform): Promise<UserFollow | undefined>{
  const [follow] = await db.delete(users_follows)
    .where(and(eq(users_follows.user_id, user_id), eq(users_follows.channel_id, channel_id), eq(users_follows.platform, platform)))
    .returning()
  return follow
}

export async function checkOrCreateUser(user_id: number, username: string, first_name: string): Promise<{ user: User, isNew: boolean } | undefined> {
  try {
    const user = await addUser(user_id, username, first_name)
    // `created` is written on insert only; treat a very recent value as new.
    const isNew = Date.now() - new Date(user.created).getTime() < 60_000
    return { user, isNew }
  } catch (err) {
    log.error("Failed to add user.", err)
    return undefined
  }
}

export async function checkOrCreateChannel(channel_id: number, channel_name: string, channel_login: string, platform: Platform): Promise<{ channel: Channel, isNew: boolean }>{
  const [exist] = await db.select().from(channels).where(and(eq(channels.channel_id, channel_id), eq(channels.platform, platform))).limit(1)
  const channel = await addChannel(channel_id, channel_name, channel_login, platform)
  return { channel, isNew: !exist }
}

export async function checkOrCreateFollow(user_id: number, channel_id: number, platform: Platform): Promise<{follow: UserFollow, isNew: boolean}> {
  const [exist] = await db.select().from(users_follows).where(and(eq(users_follows.user_id, user_id),eq(users_follows.channel_id, channel_id), eq(users_follows.platform, platform))).limit(1)
  const userFollow = await addFollow(user_id, channel_id, platform)
  return { follow: userFollow, isNew: !exist }
}

export async function makeUserAdmin(user_id: number, key: string): Promise<User | undefined> {
  try {
    const result = await db.transaction(async (tx) => {
      const adminKey = await tx.select().from(admin_keys).where(eq(admin_keys.key, key)).limit(1).then(r => r[0])
      if (!adminKey || adminKey.used) {
        return undefined
      }
      await tx.update(admin_keys).set({ used: true, used_date: new Date().toISOString(), used_by: user_id }).where(eq(admin_keys.id, adminKey.id))
      const [user] = await tx.update(users).set({ is_admin: true }).where(eq(users.user_id, user_id)).returning()
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

export async function setTitleNotificationStateByUserId(user_id: number, state: number): Promise<NewUserSettings> {
  const [newUserSettings] = await db.update(users_settings).set({ title_change_notification: state }).where(eq(users_settings.user_id, user_id)).returning()
  return newUserSettings
}

export async function setCategoryNotificationStateByUserId(user_id: number, state: number): Promise<NewUserSettings> {
  const [newUserSettings] = await db.update(users_settings).set({ category_change_notification: state }).where(eq(users_settings.user_id, user_id)).returning()
  return newUserSettings
}

export async function setStreamMetadataStateByUserId(user_id: number, state: number): Promise<NewUserSettings> {
  const [newUserSettings] = await db.update(users_settings).set({ stream_metadata: state }).where(eq(users_settings.user_id, user_id)).returning()
  return newUserSettings
}

export async function setLinkPreviewStateByUserId(user_id: number, state: number): Promise<NewUserSettings> {
  const [newUserSettings] = await db.update(users_settings).set({ link_preview: state }).where(eq(users_settings.user_id, user_id)).returning()
  return newUserSettings
}

export async function setLanguageByUserId(user_id: number, language: string): Promise<NewUserSettings> {
  const [newUserSettings] = await db.update(users_settings).set({ language }).where(eq(users_settings.user_id, user_id)).returning()
  return newUserSettings
}

export async function setBotBlockedStateByUserId(user_id: number, is_bot_blocked: number): Promise<NewUserSettings> {
  const [newUserSettings] = await db.update(users_settings).set({ is_bot_blocked }).where(eq(users_settings.user_id, user_id)).returning()
  return newUserSettings
}

export type UserSettingsPatch = Partial<{
  online_notification: number;
  offline_notification: number;
  title_change_notification: number;
  category_change_notification: number;
  stream_metadata: number;
  link_preview: number;
  language: string;
}>;

/** Atomically applies only the supplied settings fields. */
export async function updateUserSettingsByUserId(user_id: number, patch: UserSettingsPatch): Promise<UserSettings | undefined> {
  if (Object.keys(patch).length === 0) {
    return getSettingsStateByUserId(user_id)
  }
  const [row] = await db.update(users_settings).set(patch).where(eq(users_settings.user_id, user_id)).returning()
  return row
}

export async function setChatDeliveryByUserId(user_id: number, chat_delivery: number | null): Promise<UserSettings | undefined> {
  const [row] = await db.update(users_settings).set({ chat_delivery }).where(eq(users_settings.user_id, user_id)).returning()
  return row
}

/** Ensures a settings row exists even for users created concurrently. */
export async function ensureUserSettings(user_id: number): Promise<UserSettings | undefined> {
  const [row] = await db.insert(users_settings)
    .values({ user_id })
    .onConflictDoNothing({ target: users_settings.user_id })
    .returning()
  if (row) return row
  return getSettingsStateByUserId(user_id)
}

export async function createWebSession(tokenHash: string, userId: number, createdAt: string, expiresAt: string): Promise<WebSession> {
  const [row] = await db.insert(web_sessions)
    .values({ token_hash: tokenHash, user_id: userId, created_at: createdAt, expires_at: expiresAt })
    .returning()
  return row
}

export async function getWebSessionByTokenHash(tokenHash: string): Promise<WebSession | undefined> {
  const [row] = await db.select().from(web_sessions).where(eq(web_sessions.token_hash, tokenHash)).limit(1)
  return row
}

export async function deleteWebSessionByTokenHash(tokenHash: string): Promise<void> {
  await db.delete(web_sessions).where(eq(web_sessions.token_hash, tokenHash))
}

export async function deleteExpiredWebSessions(nowIso: string): Promise<void> {
  await db.delete(web_sessions).where(lt(web_sessions.expires_at, nowIso))
}

export interface FollowWithChannel {
  user_id: number;
  channel_id: number;
  channel_name: string;
  channel_login: string;
  platform: Platform;
  created: string;
}

/** Paginated, searchable follows for the user-facing API. */
export async function getFollowsWithChannelPage(
  user_id: number,
  opts: { platform?: Platform; search?: string; limit: number; offset: number },
): Promise<FollowWithChannel[]> {
  const conditions = [eq(users_follows.user_id, user_id)];
  if (opts.platform) {
    conditions.push(eq(users_follows.platform, opts.platform));
  }
  if (opts.search) {
    const term = opts.search.trim().toLowerCase();
    if (term.length > 0) {
      conditions.push(or(
        like(sql`lower(${channels.channel_login})`, `%${term}%`),
        like(sql`lower(${channels.channel_name})`, `%${term}%`),
      )!);
    }
  }
  const rows = await db
    .select({
      user_id: users_follows.user_id,
      channel_id: users_follows.channel_id,
      channel_name: channels.channel_name,
      channel_login: channels.channel_login,
      platform: users_follows.platform,
      created: users_follows.created,
    })
    .from(users_follows)
    .innerJoin(channels, and(
      eq(users_follows.channel_id, channels.channel_id),
      eq(users_follows.platform, channels.platform),
    ))
    .where(and(...conditions))
    .orderBy(asc(users_follows.created), asc(users_follows.platform), asc(users_follows.channel_id))
    .limit(opts.limit)
    .offset(opts.offset);
  return rows;
}

async function setAdminKeyUsedById(id: number, used_by: number): Promise<AdminKey>{
  const [adminKey] = await db.update(admin_keys).set({ used: true, used_date: new Date().toISOString(), used_by}).where(eq(admin_keys.id, id)).returning()
  return adminKey
}

async function setUserAdmin(user_id: number, is_admin: boolean): Promise<User>{
  const [user] = await db.update(users).set({is_admin}).where(eq(users.user_id, user_id)).returning()
  return user
}

export async function insertStreamLog(channel_id: number, platform: Platform, event: string): Promise<void> {
  await db.insert(stream_logs).values({
    channel_id,
    platform,
    event,
    created: new Date().toISOString(),
  })
}

export interface StreamSummary {
  durationMs: number;
  categories: StreamCategory[];
}

type ActiveSessionResolution = "duplicate" | "adopted" | "replaced" | "outdated" | "none";

async function resolveActiveStreamSession(tx: Tx, channelId: number, streamId: string, startedAt: string): Promise<ActiveSessionResolution> {
  const [activeStream] = await tx.select().from(stream_sessions)
    .where(and(eq(stream_sessions.channel_id, channelId), eq(stream_sessions.platform, "twitch"), isNull(stream_sessions.ended_at)))
    .orderBy(desc(stream_sessions.id)).limit(1);

  if (!activeStream) return "none";

  // Повторная доставка события для текущего стрима
  if (activeStream.stream_id === streamId) {
    log.info("duplicate stream.online ignored", { channel_id: channelId, stream_id: streamId });
    return "duplicate";
  }

  // Сессия была восстановлена через channel.update — по started_at понятно, что это тот же стрим
  if (activeStream.stream_id === null && activeStream.started_at === startedAt) {
    await tx.update(stream_sessions).set({ stream_id: streamId }).where(eq(stream_sessions.id, activeStream.id));
    log.info("backfilled stream session adopted", { channel_id: channelId, stream_id: streamId });
    return "adopted";
  }

  // Запоздавший retry события СТАРОГО стрима: активная сессия новее входящей —
  // не даём ей закрыть и подменить текущий стрим (in-memory dedup после
  // рестарта уже не спасает)
  if (new Date(startedAt).getTime() <= new Date(activeStream.started_at).getTime()) {
    log.warn("outdated stream.online ignored", {
      channel_id: channelId,
      active_session_id: activeStream.id,
      active_started_at: activeStream.started_at,
      incoming_stream_id: streamId,
      incoming_started_at: startedAt,
    });
    return "outdated";
  }

  // Незакрытая сессия предыдущего стрима (stream.offline был пропущен) —
  // закрываем молча, границей станет старт нового стрима
  log.warn("closing stale stream session", {
    channel_id: channelId,
    stale_session_id: activeStream.id,
    stale_stream_id: activeStream.stream_id,
    new_stream_id: streamId,
  });
  await tx.update(stream_sessions).set({ ended_at: startedAt }).where(eq(stream_sessions.id, activeStream.id));
  await tx.update(stream_categories).set({ ended_at: startedAt })
    .where(and(eq(stream_categories.stream_session_id, activeStream.id), isNull(stream_categories.ended_at)));
  return "replaced";
}

async function insertStreamSession(tx: Tx, channelId: number, streamId: string, title: string, sessionStartedAt: string, categoryName: string, categoryStartedAt: string): Promise<boolean> {
  // Partial unique index гарантирует одну активную сессию на канал:
  // при гонке параллельных stream.online конфликтующий INSERT просто
  // ничего не вставит (ON CONFLICT DO NOTHING не ломает транзакцию,
  // в отличие от пойманного 23505, после которого tx остаётся в aborted state).
  const [stream] = await tx.insert(stream_sessions).values({
    channel_id: channelId,
    platform: "twitch",
    stream_id: streamId,
    title,
    started_at: sessionStartedAt,
  }).onConflictDoNothing().returning();

  if (!stream) {
    log.warn("active stream session already exists", { channel_id: channelId, stream_id: streamId });
    return false;
  }

  await tx.insert(stream_categories).values({
    stream_session_id: stream.id,
    category_name: categoryName,
    started_at: categoryStartedAt,
  });
  return true;
}

export type StartStreamResult = ActiveSessionResolution | "created";

export async function startTwitchStream(channelId: number, streamId: string, title: string, categoryName: string, startedAt: string): Promise<StartStreamResult> {
  return db.transaction(async (tx) => {
    const state = await resolveActiveStreamSession(tx, channelId, streamId, startedAt);
    if (state !== "none" && state !== "replaced") return state;
    const inserted = await insertStreamSession(tx, channelId, streamId, title, startedAt, categoryName, startedAt);
    if (!inserted) return "duplicate";
    return state === "replaced" ? "replaced" : "created";
  });
}

export async function backfillTwitchStream(channelId: number, streamId: string, title: string, categoryName: string, streamStartedAt: string): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    const state = await resolveActiveStreamSession(tx, channelId, streamId, streamStartedAt);
    if (state !== "none" && state !== "replaced") return;
    // Историю категорий до moment восстановления мы не знаем: стрим мог идти часами
    // в другой категории. Текущая категория достоверно известна только с этого события.
    await insertStreamSession(tx, channelId, streamId, title, streamStartedAt, categoryName, now);
  });
}
export async function updateTwitchStream(channelId: number, title: string, categoryName: string): Promise<{ titleChanged: boolean; categoryChanged: boolean; hadActiveSession: boolean }> {
  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    const [stream] = await tx.select().from(stream_sessions)
      .where(and(eq(stream_sessions.channel_id, channelId), eq(stream_sessions.platform, "twitch"), isNull(stream_sessions.ended_at)))
      .orderBy(desc(stream_sessions.id)).limit(1)
      .for("update");
    if (!stream) return { titleChanged: false, categoryChanged: false, hadActiveSession: false };

    const titleChanged = stream.title !== title;
    if (titleChanged) {
      await tx.update(stream_sessions).set({ title }).where(eq(stream_sessions.id, stream.id));
    }

    const [category] = await tx.select().from(stream_categories)
      .where(and(eq(stream_categories.stream_session_id, stream.id), isNull(stream_categories.ended_at)))
      .orderBy(desc(stream_categories.id)).limit(1);
    const categoryChanged = category?.category_name !== categoryName;
    if (categoryChanged) {
      if (category) {
        await tx.update(stream_categories).set({ ended_at: now }).where(eq(stream_categories.id, category.id));
      }
      await tx.insert(stream_categories).values({
        stream_session_id: stream.id,
        category_name: categoryName,
        started_at: now,
      });
    }
    return { titleChanged, categoryChanged, hadActiveSession: true };
  });
}

export type FinishStreamResult =
  | { outcome: "closed"; summary: StreamSummary }
  | { outcome: "no_session" }
  | { outcome: "stream_mismatch" };

export async function finishTwitchStream(channelId: number, streamId?: string): Promise<FinishStreamResult> {
  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    // Закрываем все незакрытые сессии канала: если накопились zombie-сессии
    // (например, созданные до unique-инварианта), они тоже будут закрыты.
    const activeSessions = await tx.select().from(stream_sessions)
      .where(and(eq(stream_sessions.channel_id, channelId), eq(stream_sessions.platform, "twitch"), isNull(stream_sessions.ended_at)))
      .orderBy(desc(stream_sessions.id))
      .for("update");
    if (activeSessions.length === 0) return { outcome: "no_session" };

    const latest = activeSessions[0];

    // stream.offline содержит id стрима: если он не совпадает с активной сессией,
    // это запоздавший offline предыдущего стрима — текущий не трогаем
    if (streamId && latest.stream_id && latest.stream_id !== streamId) {
      log.warn("stream.offline for a different stream ignored", {
        channel_id: channelId,
        active_session_id: latest.id,
        active_stream_id: latest.stream_id,
        event_stream_id: streamId,
      });
      return { outcome: "stream_mismatch" };
    }

    const activeIds = activeSessions.map((session) => session.id);

    await tx.update(stream_sessions).set({ ended_at: now }).where(inArray(stream_sessions.id, activeIds));
    await tx.update(stream_categories).set({ ended_at: now })
      .where(and(inArray(stream_categories.stream_session_id, activeIds), isNull(stream_categories.ended_at)));
    const categories = await tx.select().from(stream_categories)
      .where(eq(stream_categories.stream_session_id, latest.id)).orderBy(stream_categories.id);
    if (activeSessions.length > 1) {
      log.warn("closed multiple active stream sessions", { channel_id: channelId, count: activeSessions.length });
    }
    return {
      outcome: "closed",
      summary: { durationMs: new Date(now).getTime() - new Date(latest.started_at).getTime(), categories },
    };
  });
}

export async function startKickStream(channelId: number, title: string, startedAt?: string): Promise<boolean> {
  const now = new Date();
  // Kick присылает started_at в payload — тогда это реальное начало стрима.
  // Если поля нет или оно мусорное, началом считаем момент получения вебхука.
  const payloadStart = startedAt ? new Date(startedAt) : null;
  const payloadStartValid = payloadStart !== null
    && !isNaN(payloadStart.getTime())
    && now.getTime() - payloadStart.getTime() <= KICK_MAX_STREAM_AGE_MS
    && payloadStart.getTime() - now.getTime() <= KICK_DUPLICATE_WINDOW_MS;
  const effectiveStart = payloadStartValid ? payloadStart!.toISOString() : now.toISOString();

  return db.transaction(async (tx) => {
    const [activeStream] = await tx.select().from(stream_sessions)
      .where(and(eq(stream_sessions.channel_id, channelId), eq(stream_sessions.platform, "kick"), isNull(stream_sessions.ended_at)))
      .orderBy(desc(stream_sessions.id)).limit(1)
      .for("update");

    if (activeStream) {
      // Тот же стрим: status.updated приходит и при обновлении метаданных
      // (title и др.), и при повторной доставке — обновляем title, сессию не трогаем
      if (activeStream.started_at === effectiveStart) {
        if (title && activeStream.title !== title) {
          await tx.update(stream_sessions).set({ title }).where(eq(stream_sessions.id, activeStream.id));
        }
        log.info("kick stream session already active", { channel_id: channelId });
        return false;
      }

      // Запоздавший is_live=true СТАРОГО стрима: входящее начало не новее
      // активной сессии — не даём ему закрыть и подменить текущий стрим
      if (new Date(effectiveStart).getTime() <= new Date(activeStream.started_at).getTime()) {
        log.warn("outdated kick stream.online ignored", {
          channel_id: channelId,
          active_session_id: activeStream.id,
          active_started_at: activeStream.started_at,
          incoming_started_at: effectiveStart,
        });
        return false;
      }

      const activeAgeMs = now.getTime() - new Date(activeStream.started_at).getTime();
      if (activeAgeMs < KICK_DUPLICATE_WINDOW_MS) {
        log.info("duplicate kick stream.online ignored", { channel_id: channelId });
        return false;
      }
      // Незакрытая сессия предыдущего стрима (offline был пропущен) — закрываем молча
      log.warn("closing stale kick stream session", { channel_id: channelId, stale_session_id: activeStream.id });
      await tx.update(stream_sessions).set({ ended_at: effectiveStart }).where(eq(stream_sessions.id, activeStream.id));
    }

    const [inserted] = await tx.insert(stream_sessions).values({
      channel_id: channelId,
      platform: "kick",
      title,
      started_at: effectiveStart,
    }).onConflictDoNothing().returning();

    if (!inserted) {
      // Гонка параллельных вебхуков: активную сессию уже создал другой обработчик
      log.warn("active kick stream session already exists", { channel_id: channelId });
      return false;
    }
    return true;
  });
}

export type FinishKickStreamResult =
  | { outcome: "closed"; durationMs: number }
  | { outcome: "no_session" }
  | { outcome: "stream_mismatch" };

export async function finishKickStream(channelId: number, expectedStartedAt?: string, endedAt?: string): Promise<FinishKickStreamResult> {
  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    const [activeStream] = await tx.select().from(stream_sessions)
      .where(and(eq(stream_sessions.channel_id, channelId), eq(stream_sessions.platform, "kick"), isNull(stream_sessions.ended_at)))
      .orderBy(desc(stream_sessions.id)).limit(1)
      .for("update");
    if (!activeStream) return { outcome: "no_session" };

    // Payload завершения стрима содержит started_at: сверяем его с активной сессией,
    // чтобы запоздавший offline предыдущего стрима не закрыл текущий
    const expectedStart = expectedStartedAt ? new Date(expectedStartedAt) : null;
    if (expectedStart && !isNaN(expectedStart.getTime()) && activeStream.started_at !== expectedStart.toISOString()) {
      log.warn("kick stream.offline for a different stream ignored", {
        channel_id: channelId,
        active_session_id: activeStream.id,
        active_started_at: activeStream.started_at,
        event_started_at: expectedStart.toISOString(),
      });
      return { outcome: "stream_mismatch" };
    }

    // Если Kick прислал корректный ended_at — используем его (точнее времени обработки)
    const sessionStartMs = new Date(activeStream.started_at).getTime();
    const payloadEnd = endedAt ? new Date(endedAt) : null;
    const effectiveEnd = payloadEnd && !isNaN(payloadEnd.getTime()) && payloadEnd.getTime() >= sessionStartMs
      ? payloadEnd.toISOString()
      : now;

    await tx.update(stream_sessions).set({ ended_at: effectiveEnd }).where(eq(stream_sessions.id, activeStream.id));
    return { outcome: "closed", durationMs: new Date(effectiveEnd).getTime() - sessionStartMs };
  });
}

export async function getRecentStreamLogs(limit: number = 10): Promise<(StreamLog & { channel_name?: string | null, follower_count?: number })[]> {
  const result = await db.select({
    id: stream_logs.id,
    channel_id: stream_logs.channel_id,
    platform: stream_logs.platform,
    event: stream_logs.event,
    created: stream_logs.created,
    channel_name: channels.channel_name,
    follower_count: count(users_follows.user_id),
  })
    .from(stream_logs)
    .leftJoin(channels, and(
      eq(stream_logs.channel_id, channels.channel_id),
      eq(stream_logs.platform, channels.platform),
    ))
    .leftJoin(users_follows, and(eq(stream_logs.channel_id, users_follows.channel_id), eq(stream_logs.platform, users_follows.platform)))
    .groupBy(stream_logs.id, channels.channel_name)
    .orderBy(sql`${stream_logs.id} DESC`)
    .limit(limit)
  return result
}
