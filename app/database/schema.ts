import {
  bigserial,
  boolean,
  integer,
  pgTable,
  text,
  varchar,
  bigint
} from "drizzle-orm/pg-core";

export const channels = pgTable("channels", {
  channel_id: bigint({mode: "number"}).unique().notNull(),
  channel_name: varchar({ length: 64 }).notNull(),
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
  created: text().notNull()
})

export type UserFollow = typeof users_follows.$inferSelect
export type NewUserFollow = typeof users_follows.$inferInsert

export const users_settings = pgTable("users_settings", {
  user_id: bigint({mode: "number"}).primaryKey().references(() => users.user_id),
  online_notification: integer().default(1),
  offline_notification: integer().default(1)
})

export type UserSettings = typeof users_settings.$inferSelect
export type NewUserSettings = typeof users_settings.$inferInsert
