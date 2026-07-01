ALTER TABLE "user_keys" ADD COLUMN "credential_id" text;--> statement-breakpoint
ALTER TABLE "user_keys" ADD COLUMN "key_type" text DEFAULT 'ecdsa' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_keys" ADD COLUMN "device_info" jsonb;--> statement-breakpoint
CREATE INDEX "user_keys_credential_id_idx" ON "user_keys" USING btree ("credential_id");