CREATE TABLE "trust_dm_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"handle" text NOT NULL,
	"code_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "trust_dm_challenges_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "trust_dm_receipts" (
	"message_id" text PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trust_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text DEFAULT 'instagram' NOT NULL,
	"handle" text NOT NULL,
	"external_sender_id" text,
	"challenge_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"note" text,
	CONSTRAINT "trust_evidence_external_sender_id_unique" UNIQUE("external_sender_id"),
	CONSTRAINT "trust_evidence_challenge_id_unique" UNIQUE("challenge_id"),
	CONSTRAINT "trust_evidence_provider_handle_unique" UNIQUE("provider","handle")
);
--> statement-breakpoint
CREATE TABLE "trust_policy_lock" (
	"id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trust_vouches" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer_id" text NOT NULL,
	"target_id" text NOT NULL,
	"relationship" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "trust_vouches_pair_unique" UNIQUE("issuer_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"window_key" text NOT NULL,
	"cadence" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sources" jsonb NOT NULL,
	"source_fingerprint" text NOT NULL,
	"caption" text NOT NULL,
	"image_token" text NOT NULL,
	"scheduled_at" timestamp with time zone,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"lease_token" text,
	"lease_until" timestamp with time zone,
	"container_id" text,
	"media_id" text,
	"publish_attempted_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_posts_window_key_unique" UNIQUE("window_key")
);
--> statement-breakpoint
CREATE TABLE "social_settings" (
	"id" text PRIMARY KEY DEFAULT 'instagram' NOT NULL,
	"paused" boolean DEFAULT true NOT NULL,
	"daily" boolean DEFAULT false NOT NULL,
	"weekly" boolean DEFAULT false NOT NULL,
	"automatic" boolean DEFAULT false NOT NULL,
	"hour_utc" integer DEFAULT 15 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trust_override" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trust_source" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trust_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trust_review_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "social_sharing_allowed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trust_dm_challenges" ADD CONSTRAINT "trust_dm_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_evidence" ADD CONSTRAINT "trust_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_evidence" ADD CONSTRAINT "trust_evidence_challenge_id_trust_dm_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."trust_dm_challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_vouches" ADD CONSTRAINT "trust_vouches_issuer_id_users_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_vouches" ADD CONSTRAINT "trust_vouches_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trust_dm_challenges_user_idx" ON "trust_dm_challenges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trust_evidence_user_idx" ON "trust_evidence" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trust_vouches_target_idx" ON "trust_vouches" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "social_posts_due_idx" ON "social_posts" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "social_posts_lease_idx" ON "social_posts" USING btree ("lease_until");
--> statement-breakpoint
-- Existing blue checks were explicit staff decisions; preserve those roots only.
UPDATE users SET trust_override = 'granted', trust_source = 'staff', trust_verified_at = now()
WHERE is_verified AND sample_batch_id IS NULL AND managed_by_user_id IS NULL
  AND deleted_at IS NULL AND status = 'active' AND onboarded_at IS NOT NULL;
--> statement-breakpoint
UPDATE users SET is_verified = false WHERE trust_override <> 'granted';
--> statement-breakpoint
-- Linked account ownership is no longer represented by the member verification badge.
UPDATE users SET badges = coalesce((SELECT jsonb_agg(b) FROM jsonb_array_elements(users.badges) b WHERE b->>'type' <> 'verified'), '[]'::jsonb)
WHERE badges @> '[{"type":"verified"}]'::jsonb;
--> statement-breakpoint
-- Keep fictional fixtures private, including after an application rollback.
UPDATE sample_batches SET state = 'hidden', archival_reason = 'Private admin fixtures; public marketplace contains real inventory only.' WHERE state = 'published';
