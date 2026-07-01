ALTER TABLE "user_keys" ADD COLUMN "algorithm" text DEFAULT 'ECDSA-P256' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_keys" ADD COLUMN "last_used_at" timestamp;