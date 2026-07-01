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
ALTER TABLE "account" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "passkey" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_anonymous" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "guest_tokens" ADD CONSTRAINT "guest_tokens_recipient_id_package_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."package_recipients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_tokens" ADD CONSTRAINT "guest_tokens_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guest_tokens_token_idx" ON "guest_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "guest_tokens_recipient_id_idx" ON "guest_tokens" USING btree ("recipient_id");