CREATE TABLE "user_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"platform" varchar(16),
	"channel_id" bigint,
	"event" varchar(32) NOT NULL,
	"status" varchar(16) DEFAULT 'sent' NOT NULL,
	"created" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_notifications_user_id_id_idx" ON "user_notifications" USING btree ("user_id","id");