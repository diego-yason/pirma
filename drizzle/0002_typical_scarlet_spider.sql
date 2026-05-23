ALTER TABLE "user_keys" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "document_signatories" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "document_viewers" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "owner" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "passkey" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();