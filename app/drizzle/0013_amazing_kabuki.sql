CREATE TABLE "stream_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"stream_session_id" integer NOT NULL,
	"category_name" text NOT NULL,
	"started_at" text NOT NULL,
	"ended_at" text
);
--> statement-breakpoint
CREATE TABLE "stream_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" bigint NOT NULL,
	"platform" varchar(16) NOT NULL,
	"title" text,
	"started_at" text NOT NULL,
	"ended_at" text
);
--> statement-breakpoint
ALTER TABLE "stream_categories" ADD CONSTRAINT "stream_categories_stream_session_id_stream_sessions_id_fk" FOREIGN KEY ("stream_session_id") REFERENCES "public"."stream_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_sessions" ADD CONSTRAINT "stream_sessions_channel_id_channels_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("channel_id") ON DELETE no action ON UPDATE no action;