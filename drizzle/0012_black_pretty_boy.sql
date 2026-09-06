CREATE TABLE "object_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"object_key" text NOT NULL,
	"public_url" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "object_uploads_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "object_uploads_public_url_unique" UNIQUE("public_url")
);
--> statement-breakpoint
ALTER TABLE "object_uploads" ADD CONSTRAINT "object_uploads_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "object_uploads_cleanup_idx" ON "object_uploads" USING btree ("claimed_at","deleted_at","created_at");