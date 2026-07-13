CREATE TABLE "haul_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"haul_id" text NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "haul_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"kind" text NOT NULL,
	"proposer_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"shared_by" text NOT NULL,
	"proposer_side" jsonb NOT NULL,
	"owner_side" jsonb NOT NULL,
	"note" text,
	"comments_enabled" boolean DEFAULT true NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"hidden_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "haul_posts_deal_id_unique" UNIQUE("deal_id")
);
--> statement-breakpoint
CREATE TABLE "haul_reactions" (
	"haul_id" text NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "haul_reactions_haul_id_user_id_pk" PRIMARY KEY("haul_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "haul_comments" ADD CONSTRAINT "haul_comments_haul_id_haul_posts_id_fk" FOREIGN KEY ("haul_id") REFERENCES "public"."haul_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "haul_comments" ADD CONSTRAINT "haul_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "haul_posts" ADD CONSTRAINT "haul_posts_proposer_id_users_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "haul_posts" ADD CONSTRAINT "haul_posts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "haul_reactions" ADD CONSTRAINT "haul_reactions_haul_id_haul_posts_id_fk" FOREIGN KEY ("haul_id") REFERENCES "public"."haul_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "haul_reactions" ADD CONSTRAINT "haul_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "haul_comments_haul_idx" ON "haul_comments" USING btree ("haul_id");--> statement-breakpoint
CREATE INDEX "haul_posts_hidden_created_idx" ON "haul_posts" USING btree ("hidden","created_at");