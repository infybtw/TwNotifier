import {
  bigserial,
  boolean,
  integer,
  pgTable,
  text,
  uniqueIndex,
  varchar,
  bigint,
  primaryKey,
  serial,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Platforms supported by the bot and the Mini App.
 * Stored as a restricted varchar column; platform is part of the channel key.
 */
export type Platform = "twitch" | "kick";

/**
 * A tracked channel is identified by the composite key (platform, channel_id).
 * The same numeric id can belong to different platforms and must not collide.
 *
 * `channel_login` is the canonical, lower-cased login/slug used for lookups and
 * links. `channel_name` is the human readable display name.
 */
export const channels = pgTable("channels", {
  channel_id: bigint({ mode: "number" }).notNull(),
  channel_name: varchar({ length: 64 }).notNull(),
  channel_login: varchar({ length: 64 }).notNull(),
  platform: varchar({ length: 16 }).$type<Platform>().notNull(),
}, (table) => [
  primaryKey({ columns: [table.platform, table.channel_id] }),
]);

export type Channel = typeof channels.$inferSelect
export type NewChannel = typeof channels.$inferInsert

export const users = pgTable("users", {
  user_id: bigint({mode: "number"}).unique().notNull(),
  username: text(),
  first_name: text(),
  created: text().notNull(),
  is_admin: boolean().default(false)
});

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export const users_follows = pgTable("users_follows", {
  user_id: bigint({mode: "number"}).notNull().references(() => users.user_id),
  channel_id: bigint({mode: "number"}).notNull(),
  platform: varchar({length: 16}).$type<Platform>().notNull(),
  created: text().notNull(),
}, (table) => [
  primaryKey({ columns: [table.user_id, table.platform, table.channel_id] }),
  foreignKey({
    columns: [table.platform, table.channel_id],
    foreignColumns: [channels.platform, channels.channel_id],
  }),
])

export type UserFollow = typeof users_follows.$inferSelect
export type NewUserFollow = typeof users_follows.$inferInsert

export const users_settings = pgTable("users_settings", {
  user_id: bigint({mode: "number"}).primaryKey().references(() => users.user_id),
  online_notification: integer().default(1),
  offline_notification: integer().default(1),
  title_change_notification: integer().default(1),
  category_change_notification: integer().default(1),
  stream_metadata: integer().default(1),
  link_preview: integer().default(1),
  language: varchar({ length: 5 }).default("ru"),
  is_bot_blocked: integer().default(0).notNull(),
  /**
   * Whether the user has granted the bot permission to message them.
   * null = unknown, 1 = confirmed, 0 = denied. Kept separate from
   * `is_bot_blocked`, which is a delivery diagnostic set on Telegram 403s.
   */
  chat_delivery: integer(),
})

export type UserSettings = typeof users_settings.$inferSelect
export type NewUserSettings = typeof users_settings.$inferInsert

/**
 * Server-side bearer sessions issued after Telegram initData verification.
 * Only the SHA-256 hash of the opaque token is stored.
 */
export const web_sessions = pgTable("web_sessions", {
  id: serial("id").primaryKey(),
  token_hash: text().notNull().unique(),
  user_id: bigint({ mode: "number" }).notNull().references(() => users.user_id),
  created_at: text().notNull(),
  expires_at: text().notNull(),
})

export type WebSession = typeof web_sessions.$inferSelect
export type NewWebSession = typeof web_sessions.$inferInsert

export const admin_keys = pgTable("admin_keys", {
  id: serial("id").primaryKey(),
  key: text().notNull().unique(),
  issue_date: text().notNull(),
  issued_by: bigint({ mode: "number" }).references(() => users.user_id),
  used: boolean().default(false),
  used_date: text(),
  used_by: bigint({ mode: "number"}).references(() => users.user_id)
})

export type AdminKey = typeof admin_keys.$inferSelect
export type NewAdminKey = typeof admin_keys.$inferInsert

export const admin_settings = pgTable("admin_settings", {
  user_id: bigint({ mode: "number" }).primaryKey().references(() => users.user_id),
  utc_offset: integer().notNull().default(0),
})

export type AdminSettings = typeof admin_settings.$inferSelect
export type NewAdminSettings = typeof admin_settings.$inferInsert

export const stream_logs = pgTable("stream_logs", {
  id: serial("id").primaryKey(),
  channel_id: bigint({mode: "number"}).notNull(),
  platform: varchar({length: 16}).$type<Platform>().notNull(),
  event: varchar({length: 16}).notNull(),
  created: text().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.platform, table.channel_id],
    foreignColumns: [channels.platform, channels.channel_id],
  }),
])

export type StreamLog = typeof stream_logs.$inferSelect
export type NewStreamLog = typeof stream_logs.$inferInsert

export const stream_sessions = pgTable("stream_sessions", {
  id: serial("id").primaryKey(),
  channel_id: bigint({ mode: "number" }).notNull(),
  platform: varchar({ length: 16 }).$type<Platform>().notNull(),
  stream_id: text(),
  title: text(),
  started_at: text().notNull(),
  ended_at: text(),
}, (table) => [
  uniqueIndex("stream_sessions_one_active_per_channel")
    .on(table.channel_id, table.platform)
    .where(sql`${table.ended_at} IS NULL`),
  foreignKey({
    columns: [table.platform, table.channel_id],
    foreignColumns: [channels.platform, channels.channel_id],
  }),
])

export type StreamSession = typeof stream_sessions.$inferSelect

export const stream_categories = pgTable("stream_categories", {
  id: serial("id").primaryKey(),
  stream_session_id: integer().references(() => stream_sessions.id).notNull(),
  category_name: text().notNull(),
  started_at: text().notNull(),
  ended_at: text(),
})

export type StreamCategory = typeof stream_categories.$inferSelect
