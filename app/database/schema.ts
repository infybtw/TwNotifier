import {
  bigserial,
  integer,
  pgTable,
  text,
  varchar,
} from "drizzle-orm/pg-core";

export const channels = pgTable("channels", {
  channel_id: integer().unique().notNull(),
  channel_name: varchar({ length: 64 }).notNull(),
});

export type Channel = typeof channels.$inferSelect
export type NewChannel = typeof channels.$inferInsert

export const users = pgTable("users", {
  user_id: integer().unique().notNull(),
  created: text().notNull(),
});

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export const users_follows = pgTable("users_follows", {
  user_id: integer().primaryKey().references(() => users.user_id),
  channel_id: integer().references(() => channels.channel_id),
  created: text().notNull()
})

export type UserFollow = typeof users_follows.$inferSelect
export type NewUserFollow = typeof users_follows.$inferInsert

export const users_settings = pgTable("users_settings", {
  user_id: integer().primaryKey().references(() => users.user_id),
  online_notification: integer().default(1),
  offline_notification: integer().default(1)
})

export type UserSettings = typeof users_settings.$inferSelect
export type NewUserSettings = typeof users_settings.$inferInsert
