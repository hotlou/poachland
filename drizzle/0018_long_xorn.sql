DROP INDEX "haul_posts_hidden_created_idx";--> statement-breakpoint
CREATE INDEX "haul_posts_hidden_created_cursor_idx" ON "haul_posts" USING btree ("hidden","created_at","id");