CREATE TYPE "public"."recipient_role" AS ENUM('signer', 'viewer');--> statement-breakpoint
DROP VIEW "public"."pending_documents";--> statement-breakpoint
DROP TABLE "package_viewers" CASCADE;--> statement-breakpoint
ALTER TABLE "package_signatories" RENAME TO "package_recipients";--> statement-breakpoint
ALTER TABLE "package_recipients" DROP CONSTRAINT "package_signatories_unique";--> statement-breakpoint
ALTER TABLE "package_recipients" DROP CONSTRAINT "package_signatories_package_id_packages_id_fk";
--> statement-breakpoint
ALTER TABLE "package_recipients" DROP CONSTRAINT "package_signatories_user_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "package_signatories_package_id_idx";--> statement-breakpoint
DROP INDEX "package_signatories_user_id_idx";--> statement-breakpoint
ALTER TABLE "package_recipients" ADD COLUMN "role" "recipient_role" DEFAULT 'signer' NOT NULL;--> statement-breakpoint
ALTER TABLE "package_recipients" ADD CONSTRAINT "package_recipients_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_recipients" ADD CONSTRAINT "package_recipients_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "package_recipients_package_id_idx" ON "package_recipients" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "package_recipients_user_id_idx" ON "package_recipients" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "package_recipients" ADD CONSTRAINT "package_recipients_unique" UNIQUE("package_id","email");--> statement-breakpoint
CREATE VIEW "public"."pending_documents" AS (select "documents"."id", "documents"."title", "documents"."status", "documents"."updated_at", "package_recipients"."user_id" from "documents" inner join "document_assignments" on "documents"."id" = "document_assignments"."document_id" inner join "package_recipients" on "document_assignments"."package_id" = "package_recipients"."package_id" where "package_recipients"."role" = 'signer' AND NOT EXISTS (
            SELECT 1 FROM "signatures"
            INNER JOIN "user_keys"
                ON "signatures"."crypto_key" = "user_keys"."id"
                AND "user_keys"."user_id" = "package_recipients"."user_id"
                AND "user_keys"."revoked_at" IS NULL
            WHERE "signatures"."document_id" = "documents"."id"
        ));