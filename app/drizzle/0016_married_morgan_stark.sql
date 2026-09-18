-- Close duplicate active sessions before creating the unique index:
-- for each channel keep only the newest open session.
UPDATE "stream_sessions" AS "s"
SET "ended_at" = now()
WHERE "s"."ended_at" IS NULL
  AND EXISTS (
    SELECT 1 FROM "stream_sessions" AS "t"
    WHERE "t"."channel_id" = "s"."channel_id"
      AND "t"."platform" = "s"."platform"
      AND "t"."ended_at" IS NULL
      AND "t"."id" > "s"."id"
  );
--> statement-breakpoint
CREATE UNIQUE INDEX "stream_sessions_one_active_per_channel" ON "stream_sessions" USING btree ("channel_id","platform") WHERE "stream_sessions"."ended_at" IS NULL;