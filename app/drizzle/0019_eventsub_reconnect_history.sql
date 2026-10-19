CREATE TABLE "eventsub_reconnects" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" text NOT NULL,
	"finished_at" text NOT NULL,
	"reason" varchar(32) NOT NULL,
	"status" varchar(16) NOT NULL,
	"attempt" integer NOT NULL,
	"delay_ms" integer NOT NULL,
	"close_code" integer,
	"close_reason" text,
	"details" text,
	"error" text,
	"previous_session_id" text,
	"session_id" text
);
--> statement-breakpoint
CREATE INDEX "eventsub_reconnects_started_at_id_idx" ON "eventsub_reconnects" USING btree ("started_at","id");