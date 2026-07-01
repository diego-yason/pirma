ALTER TABLE "account" ADD COLUMN "registration_record" text;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_registration_record_unique" UNIQUE("registration_record");