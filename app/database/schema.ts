import {
  bigserial,
  boolean,
  integer,
  pgTable,
  text,
  varchar,
  bigint,
  primaryKey,
  serial,
  pgEnum
} from "drizzle-orm/pg-core";


export const channels = pgTable("channels", {
  channel_id: bigint({mode: "number"}).unique().notNull(),
  channel_name: varchar({ length: 64 }).notNull(),
  platform: varchar({length: 16})
});

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
  user_id: bigint({mode: "number"}).references(() => users.user_id),
  channel_id: bigint({mode: "number"}).references(() => channels.channel_id),
  created: text().notNull(),
  platform: varchar({length: 16})
})

export type UserFollow = typeof users_follows.$inferSelect
export type NewUserFollow = typeof users_follows.$inferInsert

export const users_settings = pgTable("users_settings", {
  user_id: bigint({mode: "number"}).primaryKey().references(() => users.user_id),
  online_notification: integer().default(1),
  offline_notification: integer().default(1),
  link_preview: integer().default(1),
  language: varchar({ length: 5 }).default("ru")
})

export type UserSettings = typeof users_settings.$inferSelect
export type NewUserSettings = typeof users_settings.$inferInsert

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
  channel_id: bigint({mode: "number"}).references(() => channels.channel_id).notNull(),
  platform: varchar({length: 16}).notNull(),
  event: varchar({length: 16}).notNull(),
  created: text().notNull(),
})

export type StreamLog = typeof stream_logs.$inferSelect
export type NewStreamLog = typeof stream_logs.$inferInsert
