CREATE TABLE "stream_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel_id" bigint NOT NULL,
	"platform" varchar(16) NOT NULL,
	"event" varchar(16) NOT NULL,
	"created" text NOT NULL
);
