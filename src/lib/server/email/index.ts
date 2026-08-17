import { eq } from "drizzle-orm";
import { db } from "#lib/server/db/index.js";
import { emailEvents } from "#lib/server/db/schema.js";
import { logger } from "#lib/server/logger.js";
import { getProvider, type EmailMessage } from "./providers.js";

export type { EmailMessage } from "./providers.js";

export interface SendEmailInput extends EmailMessage {
    /** Unique idempotency key — retries with the same eventId never double-send */
    eventId: string;
    /** Template name, stored on the email_events row for audit */
    template: string;
}

/**
 * Provider-agnostic transactional email send.
 * Records an `email_events` row (queued → sent|failed) keyed by `eventId`.
 * Never throws — failures are logged and reflected in the DB row.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
    if (!input.to) {
        logger.warn("email", "sendEmail skipped — no recipient", {
            eventId: input.eventId,
            template: input.template,
        });
        return false;
    }

    // Record the attempt first (idempotent by eventId).
    try {
        await db
            .insert(emailEvents)
            .values({
                eventId: input.eventId,
                to: input.to,
                template: input.template,
                subject: input.subject,
                status: "queued",
            })
            .onConflictDoNothing();
    } catch (err) {
        logger.error("email", "Failed to record email event", { eventId: input.eventId, error: err });
    }

    try {
        const provider = getProvider();
        await provider.send({
            to: input.to,
            subject: input.subject,
            html: input.html,
            text: input.text,
        });

        await db
            .update(emailEvents)
            .set({ status: "sent", sentAt: new Date() })
            .where(eq(emailEvents.eventId, input.eventId));

        logger.info("email", "Email sent", {
            eventId: input.eventId,
            to: input.to,
            template: input.template,
        });
        return true;
    } catch (err) {
        logger.error("email", "Email send failed", {
            eventId: input.eventId,
            to: input.to,
            template: input.template,
            error: err,
        });
        try {
            await db
                .update(emailEvents)
                .set({ status: "failed", error: err instanceof Error ? err.message : String(err) })
                .where(eq(emailEvents.eventId, input.eventId));
        } catch (dbErr) {
            logger.error("email", "Failed to record email failure", { eventId: input.eventId, error: dbErr });
        }
        return false;
    }
}
