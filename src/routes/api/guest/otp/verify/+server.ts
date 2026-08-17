import type { RequestHandler } from "./$types";
import { db } from "#lib/server/db/index.js";
import { packageRecipients, guestTokens } from "#lib/server/db/schema.js";
import { verifyGuestToken } from "#lib/server/auth/guest-token.js";
import { verifyGuestOtp } from "#lib/server/auth/guest-otp.js";
import { and, eq } from "drizzle-orm";
import { logger } from "#lib/server/logger.js";

/**
 * POST /api/guest/otp/verify
 * Body: { token: string, code: string }
 * Requires an active (anonymous) session. Verifies the OTP, then links the
 * anonymous user to the recipient (proof-of-possession of the inbox).
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return Response.json({ error: "Unauthorized — no active session" }, { status: 401 });
    }

    let token: string;
    let code: string;
    try {
        const body = await request.json();
        token = body.token;
        code = body.code;
        if (!token || typeof token !== "string" || !code || typeof code !== "string") {
            return Response.json({ error: "Missing or invalid token/code" }, { status: 400 });
        }
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const payload = verifyGuestToken(token);
    if (!payload) {
        logger.warn("guestOtp", "Verify rejected — invalid or expired token");
        return Response.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const ok = await verifyGuestOtp(payload.recipientId, payload.packageId, code);
    if (!ok) {
        logger.warn("guestOtp", "Verify rejected — invalid/expired code", {
            recipientId: payload.recipientId,
            userId: locals.user.id,
        });
        return Response.json({ error: "Invalid or expired code" }, { status: 401 });
    }

    logger.info("guestOtp", "OTP verified — linking anonymous user", {
        userId: locals.user.id,
        recipientId: payload.recipientId,
        packageId: payload.packageId,
    });

    const [updated] = await db
        .update(packageRecipients)
        .set({ userId: locals.user.id })
        .where(
            and(
                eq(packageRecipients.id, payload.recipientId),
                eq(packageRecipients.packageId, payload.packageId),
                eq(packageRecipients.role, "signer"),
            ),
        )
        .returning({ id: packageRecipients.id, name: packageRecipients.name });

    if (!updated) {
        logger.error("guestOtp", "Verify — recipient not found for valid token", {
            userId: locals.user.id,
            recipientId: payload.recipientId,
            packageId: payload.packageId,
        });
        return Response.json({ error: "Recipient not found" }, { status: 404 });
    }

    try {
        await db
            .update(guestTokens)
            .set({ accessedAt: new Date() })
            .where(eq(guestTokens.token, token));
    } catch (err) {
        logger.warn("guestOtp", "Failed to mark guest token as accessed", {
            userId: locals.user.id,
            recipientId: payload.recipientId,
            error: err,
        });
    }

    logger.info("guestOtp", "Anonymous user linked via OTP successfully", {
        userId: locals.user.id,
        recipientId: payload.recipientId,
        recipientName: updated.name,
    });

    return Response.json({ success: true, name: updated.name });
};
