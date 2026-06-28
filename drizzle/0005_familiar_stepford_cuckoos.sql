CREATE TABLE "admin_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"issue_date" text NOT NULL,
	"issued_by" bigint,
	"used" boolean DEFAULT false,
	"used_date" text,
	"used_by" bigint,
	CONSTRAINT "admin_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "admin_keys" ADD CONSTRAINT "admin_keys_issued_by_users_user_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_keys" ADD CONSTRAINT "admin_keys_used_by_users_user_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;