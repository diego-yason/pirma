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
	"created_at" timestamp DEFAULT now(),
	"aaguid" text
);
--> statement-breakpoint
ALTER TABLE "accounts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "accounts" CASCADE;--> statement-breakpoint
DROP TABLE "users" CASCADE;--> statement-breakpoint
ALTER TABLE "user_keys" DROP CONSTRAINT "user_keys_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "document_signatories" DROP CONSTRAINT "document_signatories_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "document_viewers" DROP CONSTRAINT "document_viewers_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_owner_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_keys" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "document_signatories" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "document_viewers" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "owner" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "username" text NOT NULL;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "user_keys" ADD CONSTRAINT "user_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_signatories" ADD CONSTRAINT "document_signatories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_viewers" ADD CONSTRAINT "document_viewers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_user_id_fk" FOREIGN KEY ("owner") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_username_unique" UNIQUE("username");