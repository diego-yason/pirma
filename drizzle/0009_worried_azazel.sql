CREATE TABLE "document_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_assignments_document_id_unique" UNIQUE("document_id")
);
--> statement-breakpoint
ALTER TABLE "document_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "packages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_signatories" RENAME TO "package_signatories";--> statement-breakpoint
ALTER TABLE "document_viewers" RENAME TO "package_viewers";--> statement-breakpoint
ALTER TABLE "package_signatories" RENAME COLUMN "document_id" TO "package_id";--> statement-breakpoint
ALTER TABLE "package_viewers" RENAME COLUMN "document_id" TO "package_id";--> statement-breakpoint
ALTER TABLE "package_signatories" DROP CONSTRAINT "document_signatories_document_id_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "package_signatories" DROP CONSTRAINT "document_signatories_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "package_viewers" DROP CONSTRAINT "document_viewers_document_id_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "package_viewers" DROP CONSTRAINT "document_viewers_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "package_signatories" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "package_viewers" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "document_assignments" ADD CONSTRAINT "document_assignments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_assignments" ADD CONSTRAINT "document_assignments_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_owner_user_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_assignments_package_id_idx" ON "document_assignments" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "packages_owner_idx" ON "packages" USING btree ("owner");--> statement-breakpoint
ALTER TABLE "package_signatories" ADD CONSTRAINT "package_signatories_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_signatories" ADD CONSTRAINT "package_signatories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_viewers" ADD CONSTRAINT "package_viewers_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_viewers" ADD CONSTRAINT "package_viewers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_keys_user_id_idx" ON "user_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "package_signatories_package_id_idx" ON "package_signatories" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "documents_owner_idx" ON "documents" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "signatures_document_id_idx" ON "signatures" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "signatures_crypto_key_idx" ON "signatures" USING btree ("crypto_key");--> statement-breakpoint
ALTER TABLE "package_signatories" ADD CONSTRAINT "package_signatories_unique" UNIQUE("package_id","user_id");--> statement-breakpoint
ALTER TABLE "package_viewers" ADD CONSTRAINT "package_viewers_unique" UNIQUE("package_id","user_id");