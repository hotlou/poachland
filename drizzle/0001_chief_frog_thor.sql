CREATE TABLE "listing_views" (
	"listing_id" text NOT NULL,
	"viewer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_views_listing_id_viewer_id_pk" PRIMARY KEY("listing_id","viewer_id")
);
