CREATE TABLE "admin_settings" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"utc_offset" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_settings" ADD CONSTRAINT "admin_settings_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;