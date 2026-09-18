ALTER TABLE "users_settings" ADD COLUMN "title_change_notification" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "users_settings" ADD COLUMN "category_change_notification" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "users_settings" ADD COLUMN "stream_metadata" integer DEFAULT 1;