import type { RequestHandler } from "./$types";
import { db } from "#lib/server/db/index.js";
import { cryptoKeys } from "#lib/server/db/schema.js";
import { eq, and, isNull } from "drizzle-orm";
import { logger } from "#lib/server/logger.js";

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        logger.warn("keyRegister", "Key registration rejected — no session");
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        logger.warn("keyRegister", "Key registration rejected — invalid JSON", {
            userId: locals.user.id,
        });
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // ── WebAuthn registration ──────────────────────────────────
    if (body.keyType === "webauthn") {
        const credentialId = body.credentialId as string | undefined;
        const pubkey = body.pubkey as string | undefined;
        const deviceInfo = body.deviceInfo as Record<string, unknown> | undefined;

        if (!credentialId || typeof credentialId !== "string") {
            logger.warn("keyRegister", "WebAuthn registration rejected — missing credentialId", {
                userId: locals.user.id,
            });
            return Response.json({ error: "Missing credentialId" }, { status: 400 });
        }
        if (!pubkey || typeof pubkey !== "string") {
            logger.warn("keyRegister", "WebAuthn registration rejected — missing pubkey", {
                userId: locals.user.id,
            });
            return Response.json({ error: "Missing pubkey" }, { status: 400 });
        }

        // Check if this credential was already registered (same device)
        const [existing] = await db
            .select({ id: cryptoKeys.id })
            .from(cryptoKeys)
            .where(
                and(
                    eq(cryptoKeys.userId, locals.user.id),
                    eq(cryptoKeys.credentialId, credentialId),
                    isNull(cryptoKeys.revokedAt),
                ),
            )
            .limit(1);

        if (existing) {
            logger.debug("keyRegister", "WebAuthn credential already registered", {
                userId: locals.user.id,
                keyId: existing.id,
            });
            return Response.json({ id: existing.id, message: "Credential already registered" });
        }

        const [inserted] = await db
            .insert(cryptoKeys)
            .values({
                userId: locals.user.id,
                pubkey,
                credentialId,
                keyType: "webauthn",
                deviceInfo: deviceInfo ?? null,
                keyLevel: 2,
            })
            .returning({ id: cryptoKeys.id });

        logger.info("keyRegister", "WebAuthn credential registered", {
            userId: locals.user.id,
            keyId: inserted.id,
            platform: deviceInfo?.platform ?? null,
        });

        return Response.json({ id: inserted.id });
    }

    // ── Legacy ECDSA registration ──────────────────────────────
    const pubkey = body.pubkey as string | undefined;
    if (!pubkey || typeof pubkey !== "string") {
        logger.warn("keyRegister", "Key registration rejected — invalid pubkey", {
            userId: locals.user.id,
        });
        return Response.json({ error: "Missing or invalid pubkey" }, { status: 400 });
    }

    logger.debug("keyRegister", "Registering ECDSA public key", { userId: locals.user.id });

    const [existing] = await db
        .select({ id: cryptoKeys.id })
        .from(cryptoKeys)
        .where(and(eq(cryptoKeys.userId, locals.user.id), isNull(cryptoKeys.revokedAt)))
        .limit(1);

    if (existing) {
        logger.debug("keyRegister", "Active key already exists, skipping", {
            userId: locals.user.id,
            keyId: existing.id,
        });
        return Response.json({ id: existing.id, message: "Active key already exists" });
    }

    const [inserted] = await db
        .insert(cryptoKeys)
        .values({
            userId: locals.user.id,
            pubkey,
            keyLevel: 1,
        })
        .returning({ id: cryptoKeys.id });

    logger.info("keyRegister", "ECDSA public key registered", {
        userId: locals.user.id,
        keyId: inserted.id,
    });

    return Response.json({ id: inserted.id });
};
