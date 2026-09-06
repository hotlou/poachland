CREATE TABLE "admin_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"actor_username" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "email_outbox_unsent_idx";--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "available_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "lock_token" text;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "dead_lettered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_actor_idx" ON "admin_audit_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "admin_audit_created_idx" ON "admin_audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_outbox_ready_idx" ON "email_outbox" USING btree ("sent_at","dead_lettered_at","available_at");