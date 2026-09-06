CREATE INDEX "listings_status_created_cursor_idx" ON "listings" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "listings_status_saves_cursor_idx" ON "listings" USING btree ("status","saves","id");--> statement-breakpoint
CREATE INDEX "listings_status_views_cursor_idx" ON "listings" USING btree ("status","views","id");--> statement-breakpoint
CREATE INDEX "listings_status_price_cursor_idx" ON "listings" USING btree ("status","asking_price","id");--> statement-breakpoint
CREATE INDEX "listings_search_idx" ON "listings" USING gin (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("team", '') || ' ' || coalesce("description", '') || ' ' || coalesce("tags"::text, '')));