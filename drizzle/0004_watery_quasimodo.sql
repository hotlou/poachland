ALTER TABLE "sessions" ADD COLUMN "impersonating_user_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "moderation_note" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonating_user_id_users_id_fk" FOREIGN KEY ("impersonating_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;