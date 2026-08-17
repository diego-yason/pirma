import type { RequestHandler } from "./$types";
import { db } from "#lib/server/db/index.js";
import { packageRecipients } from "#lib/server/db/schema.js";
import { verifyGuestToken } from "#lib/server/auth/guest-token.js";
import { createGuestOtp } from "#lib/server/auth/guest-otp.js";
import { sendEmail } from "#lib/server/email/index.js";
import { renderGuestOtp, guestOtpSubject } from "#lib/server/email/templates/index.js";
import { and, eq } from "drizzle-orm";
import { logger } from "#lib/server/logger.js";

const OTP_TTL_MINUTES = 10;

/**
 * POST /api/guest/otp/request
 * Body: { token: string, email?: string }
 * Sends a one-time code to the recipient's email (bound to the token).
 */
export const POST: RequestHandler = async ({ request }) => {
    let token: string;
    let submittedEmail: string | undefined;
    try {
        const body = await request.json();
        token = body.token;
        submittedEmail = body.email;
        if (!token || typeof token !== "string") {
            return Response.json({ error: "Missing or invalid token" }, { status: 400 });
        }
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const payload = verifyGuestToken(token);
    if (!payload) {
        logger.warn("guestOtp", "Request rejected — invalid or expired token");
        return Response.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const [recipient] = await db
        .select({
            id: packageRecipients.id,
            name: packageRecipients.name,
            email: packageRecipients.email,
        })
        .from(packageRecipients)
        .where(
            and(
                eq(packageRecipients.id, payload.recipientId),
                eq(packageRecipients.packageId, payload.packageId),
                eq(packageRecipients.role, "signer"),
            ),
        )
        .limit(1);

    if (!recipient) {
        logger.warn("guestOtp", "Request rejected — recipient not found", {
            recipientId: payload.recipientId,
            packageId: payload.packageId,
        });
        return Response.json({ error: "Recipient not found" }, { status: 404 });
    }

    // Email binding: the submitted email must match the one on file.
    const expected = recipient.email?.trim().toLowerCase();
    const submitted = submittedEmail?.trim().toLowerCase();
    if (expected && submitted && submitted !== expected) {
        logger.warn("guestOtp", "Request rejected — email mismatch", {
            recipientId: recipient.id,
        });
        return Response.json({ error: "Email doesn't match the one this document was sent to" }, { status: 400 });
    }

    const targetEmail = expected ?? submitted ?? "";
    if (!targetEmail) {
        return Response.json({ error: "No email on file for this recipient" }, { status: 400 });
    }

    const { code } = await createGuestOtp(recipient.id, payload.packageId, targetEmail);

    await sendEmail({
        eventId: `guest-otp:${payload.packageId}:${recipient.id}`,
        template: "guest-otp",
        to: targetEmail,
        subject: guestOtpSubject(),
        html: renderGuestOtp({
            name: recipient.name,
            code,
            packageName: "your document",
            expiresInMinutes: OTP_TTL_MINUTES,
        }),
    });

    logger.info("guestOtp", "OTP sent", { recipientId: recipient.id, packageId: payload.packageId });
    return Response.json({ ok: true });
};
