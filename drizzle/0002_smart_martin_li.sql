CREATE TABLE "guest_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guest_otps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "guest_otps" ADD CONSTRAINT "guest_otps_recipient_id_package_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."package_recipients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_otps" ADD CONSTRAINT "guest_otps_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guest_otps_recipient_id_idx" ON "guest_otps" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "guest_otps_package_id_idx" ON "guest_otps" USING btree ("package_id");