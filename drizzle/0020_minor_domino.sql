ALTER TABLE "package_recipients" ADD COLUMN "signing_group" integer;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "signing_order_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "mfa_required" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "expiration_date" timestamp;