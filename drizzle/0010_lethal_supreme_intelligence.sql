CREATE INDEX "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "package_signatories_user_id_idx" ON "package_signatories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "package_viewers_user_id_idx" ON "package_viewers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "signatures_status_idx" ON "signatures" USING btree ("status");