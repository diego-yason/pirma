CREATE TABLE "user_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'My Signature' NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text DEFAULT 'image/png' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_signatures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_signatures" ADD CONSTRAINT "user_signatures_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_signatures_user_id_idx" ON "user_signatures" USING btree ("user_id");