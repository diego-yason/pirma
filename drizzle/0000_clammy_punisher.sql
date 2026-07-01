CREATE TYPE "public"."document_status" AS ENUM('draft', 'finalized', 'executed');--> statement-breakpoint
CREATE TYPE "public"."recipient_role" AS ENUM('signer', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."signature_status" AS ENUM('pending', 'signed', 'anchored', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."view_access" AS ENUM('public', 'restricted');--> statement-breakpoint
CREATE TABLE "user_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"pubkey" text NOT NULL,
	"kid" text,
	"credential_id" text,
	"key_level" integer DEFAULT 1 NOT NULL,
	"key_type" text DEFAULT 'ecdsa' NOT NULL,
	"algorithm" text DEFAULT 'ECDSA-P256' NOT NULL,
	"device_info" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	"revoked_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "user_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "document_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_assignments_document_id_unique" UNIQUE("document_id")
);
--> statement-breakpoint
ALTER TABLE "document_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"owner" text NOT NULL,
	"detailed_view_access" "view_access" DEFAULT 'restricted' NOT NULL,
	"hash" text NOT NULL,
	"status" "document_status" DEFAULT 'draft' NOT NULL,
	"page_count" integer,
	"file_size" bigint,
	"storage_path" text,
	"placement_fields" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "guest_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"token" text NOT NULL,
	"email" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"accessed_at" timestamp,
	"revoked_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "guest_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "package_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"user_id" text,
	"name" text,
	"email" text,
	"role" "recipient_role" DEFAULT 'signer' NOT NULL,
	"recipient_id" integer,
	"signing_group" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "package_recipients_unique" UNIQUE("package_id","email")
);
--> statement-breakpoint
ALTER TABLE "package_recipients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "package_viewers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "package_viewers_unique" UNIQUE("package_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "package_viewers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner" text NOT NULL,
	"signing_order_enabled" boolean DEFAULT false,
	"mfa_required" boolean DEFAULT false,
	"expiration_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "packages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"signer_user_id" text NOT NULL,
	"signed_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"document_hash" text NOT NULL,
	"status" "signature_status" DEFAULT 'pending' NOT NULL,
	"signed_at" timestamp,
	"crypto_key" uuid NOT NULL,
	"signature_payload" text NOT NULL,
	"signature_algorithm" text NOT NULL,
	CONSTRAINT "signatures_doc_signer_unique" UNIQUE("document_id","signer_user_id")
);
--> statement-breakpoint
ALTER TABLE "signatures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'My Signature' NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text DEFAULT 'image/png' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"removed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "user_signatures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"registration_record" text,
	CONSTRAINT "account_registration_record_unique" UNIQUE("registration_record")
);
--> statement-breakpoint
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
ALTER TABLE "passkey" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_anonymous" boolean DEFAULT false,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_keys" ADD CONSTRAINT "user_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_assignments" ADD CONSTRAINT "document_assignments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_assignments" ADD CONSTRAINT "document_assignments_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_user_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_tokens" ADD CONSTRAINT "guest_tokens_recipient_id_package_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."package_recipients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_tokens" ADD CONSTRAINT "guest_tokens_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_recipients" ADD CONSTRAINT "package_recipients_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_recipients" ADD CONSTRAINT "package_recipients_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_viewers" ADD CONSTRAINT "package_viewers_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_viewers" ADD CONSTRAINT "package_viewers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_owner_user_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_signer_user_id_user_id_fk" FOREIGN KEY ("signer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_crypto_key_user_keys_id_fk" FOREIGN KEY ("crypto_key") REFERENCES "public"."user_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_signatures" ADD CONSTRAINT "user_signatures_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_keys_user_id_idx" ON "user_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_keys_credential_id_idx" ON "user_keys" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "document_assignments_package_id_idx" ON "document_assignments" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "documents_owner_idx" ON "documents" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "guest_tokens_token_idx" ON "guest_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "guest_tokens_recipient_id_idx" ON "guest_tokens" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "package_recipients_package_id_idx" ON "package_recipients" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "package_recipients_user_id_idx" ON "package_recipients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "package_viewers_user_id_idx" ON "package_viewers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "package_viewers_package_id_idx" ON "package_viewers" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "packages_owner_idx" ON "packages" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "signatures_document_id_idx" ON "signatures" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "signatures_signer_user_id_idx" ON "signatures" USING btree ("signer_user_id");--> statement-breakpoint
CREATE INDEX "signatures_crypto_key_idx" ON "signatures" USING btree ("crypto_key");--> statement-breakpoint
CREATE INDEX "signatures_status_idx" ON "signatures" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_signatures_user_id_idx" ON "user_signatures" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE VIEW "public"."completed_documents" WITH (security_invoker = true) AS (select distinct "documents"."id", "documents"."title", "documents"."status", "documents"."updated_at", "signatures"."signer_user_id" from "documents" inner join "signatures" on "documents"."id" = "signatures"."document_id" where "signatures"."status" in ('signed', 'anchored'));--> statement-breakpoint
CREATE VIEW "public"."pending_documents" WITH (security_invoker = true) AS (select "documents"."id", "documents"."title", "documents"."status", "documents"."updated_at", "package_recipients"."user_id" from "documents" inner join "document_assignments" on "documents"."id" = "document_assignments"."document_id" inner join "package_recipients" on "document_assignments"."package_id" = "package_recipients"."package_id" where "package_recipients"."role" = 'signer' AND NOT EXISTS (
            SELECT 1 FROM "signatures"
            WHERE "signatures"."document_id" = "documents"."id"
            AND "signatures"."signer_user_id" = "package_recipients"."user_id"
            AND "signatures"."status" IN ('signed', 'anchored')
        ));