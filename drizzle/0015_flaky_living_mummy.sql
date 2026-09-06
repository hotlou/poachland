CREATE TABLE "product_events" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"user_id" text,
	"subject_type" text,
	"subject_id" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_events_name_created_idx" ON "product_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "product_events_user_created_idx" ON "product_events" USING btree ("user_id","created_at");