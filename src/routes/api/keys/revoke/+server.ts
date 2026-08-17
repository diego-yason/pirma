import type { RequestHandler } from "./$types";
import { db } from "#lib/server/db/index.js";
import { cryptoKeys } from "#lib/server/db/schema.js";
import { and, eq, isNull } from "drizzle-orm";
import { logger } from "#lib/server/logger.js";

/**
 * POST /api/keys/revoke
 * Body: { kid: string }
 * Revokes the authenticated user's signing key identified by `kid`, so it can
 * no longer be used to sign. Existing signatures remain verifiable (the key
 * row is retained, only `revokedAt` is set).
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        logger.warn("keyRevoke", "Revoke rejected — no session");
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let kid: string;
    try {
        const body = await request.json();
        kid = body.kid;
        if (!kid || typeof kid !== "string") {
            return Response.json({ error: "Missing or invalid kid" }, { status: 400 });
        }
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const [updated] = await db
        .update(cryptoKeys)
        .set({ revokedAt: new Date() })
        .where(
            and(
                eq(cryptoKeys.userId, locals.user.id),
                eq(cryptoKeys.kid, kid),
                isNull(cryptoKeys.revokedAt),
            ),
        )
        .returning({ id: cryptoKeys.id, keyLevel: cryptoKeys.keyLevel });

    if (!updated) {
        logger.warn("keyRevoke", "Revoke failed — key not found or already revoked", {
            userId: locals.user.id,
            kid,
        });
        return Response.json({ error: "Key not found or already revoked" }, { status: 404 });
    }

    logger.info("keyRevoke", "Key revoked", {
        userId: locals.user.id,
        keyId: updated.id,
        keyLevel: updated.keyLevel,
    });
    return Response.json({ success: true, id: updated.id });
};
