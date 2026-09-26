CREATE TABLE "web_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" bigint NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL,
	CONSTRAINT "web_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- Data integrity cleanup before enforcing the composite channel key.
-- A channel is now identified by (platform, channel_id) and a follow keeps
-- the follow date of its earliest record.
-- ---------------------------------------------------------------------------
-- Follows with an unknown platform cannot be mapped to a channel key.
DELETE FROM "users_follows"
WHERE "platform" IS NULL OR "platform" NOT IN ('twitch', 'kick');--> statement-breakpoint
-- Channels without a supported platform are unusable; their follows were
-- removed above.
DELETE FROM "channels"
WHERE "platform" IS NULL OR "platform" NOT IN ('twitch', 'kick');--> statement-breakpoint
-- Deduplicate (platform, channel_id) keeping one row per key.
DELETE FROM "channels" a
USING "channels" b
WHERE a.ctid > b.ctid
  AND a."platform" = b."platform"
  AND a."channel_id" = b."channel_id";--> statement-breakpoint
-- Deduplicate follows on (user_id, platform, channel_id), preserving the
-- earliest follow date.
DELETE FROM "users_follows" a
USING "users_follows" b
WHERE a."user_id" = b."user_id"
  AND a."platform" = b."platform"
  AND a."channel_id" = b."channel_id"
  AND (a."created" > b."created"
       OR (a."created" = b."created" AND a.ctid > b.ctid));--> statement-breakpoint
ALTER TABLE "stream_logs" DROP CONSTRAINT "stream_logs_channel_id_channels_channel_id_fk";
--> statement-breakpoint
ALTER TABLE "stream_sessions" DROP CONSTRAINT "stream_sessions_channel_id_channels_channel_id_fk";
--> statement-breakpoint
ALTER TABLE "users_follows" DROP CONSTRAINT "users_follows_channel_id_channels_channel_id_fk";
--> statement-breakpoint
ALTER TABLE "channels" DROP CONSTRAINT "channels_channel_id_unique";--> statement-breakpoint
-- Canonical login: add as nullable, backfill from the current name, then
-- enforce NOT NULL. The lower-cased name is a best-effort login; a provider
-- backfill can correct display-name casing later.
ALTER TABLE "channels" ADD COLUMN "channel_login" varchar(64);--> statement-breakpoint
UPDATE "channels" SET "channel_login" = lower("channel_name")
WHERE "channel_login" IS NULL OR "channel_login" = '';--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "channel_login" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "platform" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users_follows" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users_follows" ALTER COLUMN "channel_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users_follows" ALTER COLUMN "platform" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_platform_channel_id_pk" PRIMARY KEY("platform","channel_id");--> statement-breakpoint
ALTER TABLE "users_follows" ADD CONSTRAINT "users_follows_user_id_platform_channel_id_pk" PRIMARY KEY("user_id","platform","channel_id");--> statement-breakpoint
ALTER TABLE "users_settings" ADD COLUMN "chat_delivery" integer;--> statement-breakpoint
ALTER TABLE "web_sessions" ADD CONSTRAINT "web_sessions_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_logs" ADD CONSTRAINT "stream_logs_platform_channel_id_channels_platform_channel_id_fk" FOREIGN KEY ("platform","channel_id") REFERENCES "public"."channels"("platform","channel_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_sessions" ADD CONSTRAINT "stream_sessions_platform_channel_id_channels_platform_channel_id_fk" FOREIGN KEY ("platform","channel_id") REFERENCES "public"."channels"("platform","channel_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_follows" ADD CONSTRAINT "users_follows_platform_channel_id_channels_platform_channel_id_fk" FOREIGN KEY ("platform","channel_id") REFERENCES "public"."channels"("platform","channel_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Restrict platforms to the supported set.
ALTER TABLE "channels" ADD CONSTRAINT "channels_platform_check" CHECK ("platform" IN ('twitch', 'kick'));--> statement-breakpoint
ALTER TABLE "users_follows" ADD CONSTRAINT "users_follows_platform_check" CHECK ("platform" IN ('twitch', 'kick'));--> statement-breakpoint
ALTER TABLE "stream_logs" ADD CONSTRAINT "stream_logs_platform_check" CHECK ("platform" IN ('twitch', 'kick'));--> statement-breakpoint
ALTER TABLE "stream_sessions" ADD CONSTRAINT "stream_sessions_platform_check" CHECK ("platform" IN ('twitch', 'kick'));
