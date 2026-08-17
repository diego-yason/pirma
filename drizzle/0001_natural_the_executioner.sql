CREATE TYPE "public"."email_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"to" text NOT NULL,
	"template" text NOT NULL,
	"subject" text,
	"status" "email_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "email_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "package_recipients" ADD COLUMN "rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "package_recipients" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
CREATE INDEX "email_events_event_id_idx" ON "email_events" USING btree ("event_id");