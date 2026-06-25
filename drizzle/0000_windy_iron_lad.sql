CREATE TABLE "channels" (
	"channel_id" integer NOT NULL,
	"channel_name" varchar(64) NOT NULL,
	CONSTRAINT "channels_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" integer NOT NULL,
	"created" text NOT NULL,
	CONSTRAINT "users_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users_follows" (
	"user_id" integer,
	"channel_id" integer,
	"created" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users_settings" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"online_notification" integer DEFAULT 1,
	"offline_notification" integer DEFAULT 1
);
--> statement-breakpoint
ALTER TABLE "users_follows" ADD CONSTRAINT "users_follows_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_follows" ADD CONSTRAINT "users_follows_channel_id_channels_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("channel_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_settings" ADD CONSTRAINT "users_settings_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;