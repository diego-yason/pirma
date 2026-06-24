ALTER VIEW "public"."completed_documents" SET (security_invoker = true);--> statement-breakpoint
ALTER VIEW "public"."pending_documents" SET (security_invoker = true);