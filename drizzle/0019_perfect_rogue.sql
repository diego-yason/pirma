CREATE TABLE "package_viewers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "package_viewers_unique" UNIQUE("package_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "package_viewers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "package_viewers" ADD CONSTRAINT "package_viewers_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_viewers" ADD CONSTRAINT "package_viewers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "package_viewers_user_id_idx" ON "package_viewers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "package_viewers_package_id_idx" ON "package_viewers" USING btree ("package_id");