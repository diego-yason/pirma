ALTER TABLE "package_signatories" DROP CONSTRAINT "package_signatories_unique";--> statement-breakpoint
ALTER TABLE "package_viewers" DROP CONSTRAINT "package_viewers_unique";--> statement-breakpoint
ALTER TABLE "package_signatories" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "package_viewers" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "package_signatories" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "package_signatories" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "package_viewers" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "package_viewers" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "package_signatories" ADD CONSTRAINT "package_signatories_unique" UNIQUE("package_id","email");--> statement-breakpoint
ALTER TABLE "package_viewers" ADD CONSTRAINT "package_viewers_unique" UNIQUE("package_id","email");