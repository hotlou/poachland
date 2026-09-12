CREATE TABLE "sample_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"state" text DEFAULT 'hidden' NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"archived_at" timestamp with time zone,
	"archival_reason" text,
	"created_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "sample_batch_id" text;--> statement-breakpoint
ALTER TABLE "haul_posts" ADD COLUMN "sample_batch_id" text;--> statement-breakpoint
ALTER TABLE "iso_posts" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "sample_batch_id" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "moderation_reason" text;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "sample_batch_id" text;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sample_batch_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_active_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "sample_batches_expiry_idx" ON "sample_batches" USING btree ("state","expires_at");--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_sample_batch_id_sample_batches_id_fk" FOREIGN KEY ("sample_batch_id") REFERENCES "public"."sample_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "haul_posts" ADD CONSTRAINT "haul_posts_sample_batch_id_sample_batches_id_fk" FOREIGN KEY ("sample_batch_id") REFERENCES "public"."sample_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_sample_batch_id_sample_batches_id_fk" FOREIGN KEY ("sample_batch_id") REFERENCES "public"."sample_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_sample_batch_id_sample_batches_id_fk" FOREIGN KEY ("sample_batch_id") REFERENCES "public"."sample_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_sample_batch_id_sample_batches_id_fk" FOREIGN KEY ("sample_batch_id") REFERENCES "public"."sample_batches"("id") ON DELETE no action ON UPDATE no action;