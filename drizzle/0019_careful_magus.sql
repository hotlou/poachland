CREATE INDEX "threads_updated_cursor_idx" ON "threads" USING btree ("updated_at","id");--> statement-breakpoint
CREATE INDEX "threads_participants_gin_idx" ON "threads" USING gin ("participant_ids");