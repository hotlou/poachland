ALTER TABLE "trust_evidence" DROP CONSTRAINT "trust_evidence_external_sender_id_unique";--> statement-breakpoint
ALTER TABLE "trust_evidence" DROP CONSTRAINT "trust_evidence_provider_handle_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "trust_evidence_active_handle_unique" ON "trust_evidence" USING btree ("provider","handle") WHERE "trust_evidence"."status" <> 'revoked';--> statement-breakpoint
CREATE UNIQUE INDEX "trust_evidence_active_sender_unique" ON "trust_evidence" USING btree ("external_sender_id") WHERE "trust_evidence"."status" <> 'revoked';