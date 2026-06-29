ALTER TABLE "channels" ALTER COLUMN "channel_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "users_follows" ALTER COLUMN "user_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "users_follows" ALTER COLUMN "channel_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "users_settings" ALTER COLUMN "user_id" SET DATA TYPE bigint;