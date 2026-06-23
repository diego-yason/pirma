CREATE VIEW "public"."completed_documents" AS (select distinct "documents"."id", "documents"."title", "documents"."status", "documents"."updated_at", "user_keys"."user_id" from "documents" inner join "signatures" on "documents"."id" = "signatures"."document_id" inner join "user_keys" on "signatures"."crypto_key" = "user_keys"."id" where "signatures"."status" in ('signed', 'anchored'));--> statement-breakpoint
CREATE VIEW "public"."pending_documents" AS (select "documents"."id", "documents"."title", "documents"."status", "documents"."updated_at", "package_signatories"."user_id" from "documents" inner join "document_assignments" on "documents"."id" = "document_assignments"."document_id" inner join "package_signatories" on "document_assignments"."package_id" = "package_signatories"."package_id" where NOT EXISTS (
            SELECT 1 FROM "signatures"
            INNER JOIN "user_keys"
                ON "signatures"."crypto_key" = "user_keys"."id"
                AND "user_keys"."user_id" = "package_signatories"."user_id"
                AND "user_keys"."revoked_at" IS NULL
            WHERE "signatures"."document_id" = "documents"."id"
        ));