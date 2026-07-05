ALTER TABLE "users" ALTER COLUMN "user_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text DEFAULT '@';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_name" text DEFAULT 'value';