import type { RequestHandler } from "./$types";
import { db } from "#lib/server/db/index.js";
import { packageRecipients, guestTokens } from "#lib/server/db/schema.js";
import { verifyGuestToken } from "#lib/server/auth/guest-token.js";
import { eq, and } from "drizzle-orm";
import { logger } from "#lib/server/logger.js";

/**
 * Links an anonymous Better Auth user to a package recipient.
 *
 * Expected body: { token: string }
 *
 * Flow:
 * 1. Guest signs in anonymously on the client via authClient.signIn.anonymous()
 * 2. Client POSTs to this endpoint with the guest token
 * 3. Server validates the token, updates packageRecipients.userId
 * 4. Marks the guest_tokens row as accessed
 * 5. On next page load, the anonymous user's session is recognized
 *    and the recipient lookup succeeds via userId
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        logger.warn("guestLink", "Link rejected — no active session");
        return Response.json({ error: "Unauthorized — no active session" }, { status: 401 });
    }

    let token: string;
    try {
        const body = await request.json();
        token = body.token;
        if (!token || typeof token !== "string") {
            logger.warn("guestLink", "Link rejected — missing or invalid token in body");
            return Response.json({ error: "Missing or invalid token" }, { status: 400 });
        }
    } catch {
        logger.warn("guestLink", "Link rejected — invalid JSON body");
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const payload = verifyGuestToken(token);
    if (!payload) {
        logger.warn("guestLink", "Link rejected — token verification failed", {
            userId: locals.user.id,
        });
        return Response.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    logger.info("guestLink", "Linking anonymous user to recipient", {
        userId: locals.user.id,
        recipientId: payload.recipientId,
        packageId: payload.packageId,
    });

    // Update the recipient row to link the anonymous user
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
        logger.error("guestLink", "Link failed — recipient not found for valid token", {
            userId: locals.user.id,
            recipientId: payload.recipientId,
            packageId: payload.packageId,
        });
        return Response.json({ error: "Recipient not found" }, { status: 404 });
    }

    // Mark the guest token as accessed
    try {
        await db
            .update(guestTokens)
            .set({ accessedAt: new Date() })
            .where(eq(guestTokens.token, token));
    } catch (err) {
        // Non-fatal: token link still succeeded
        logger.warn("guestLink", "Failed to mark guest token as accessed", {
            userId: locals.user.id,
            recipientId: payload.recipientId,
            error: err,
        });
    }

    logger.info("guestLink", "Anonymous user linked to recipient successfully", {
        userId: locals.user.id,
        recipientId: payload.recipientId,
        packageId: payload.packageId,
        recipientName: updated.name,
    });

    return Response.json({ success: true, name: updated.name });
};
