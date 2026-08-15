import type { RequestHandler } from "./$types";
import { db } from "#lib/server/db/index.js";
import { cryptoKeys } from "#lib/server/db/schema.js";
import { logger } from "#lib/server/logger.js";
import { verifyEcdsaSignature } from "#lib/server/crypto/verify-signature.js";
import { consumeChallenge } from "#lib/server/crypto/key-challenge.js";
import { and, eq, isNull } from "drizzle-orm";

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
    if (!locals.user) {
        logger.warn("keyUpload", "Unauthorized attempt — no session");
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const pubkey = body.pubkey as string | undefined;
    const keyLevel = typeof body.keyLevel === "number" ? body.keyLevel : 1;
    const algorithm = (body.algorithm as string) ?? "ECDSA-P256";

    // Merge client-side device info with server-side IP
    let clientIp: string;
    try {
        clientIp = getClientAddress();
    } catch {
        clientIp =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            request.headers.get("x-real-ip") ??
            "unknown";
    }
    const deviceInfo: Record<string, unknown> = {
        ...(body.deviceInfo as Record<string, unknown> | undefined),
        ip: clientIp,
    };

    const nonce = body.nonce as string | undefined;
    const kid = body.kid as string | undefined;
    const signature = body.signature as string | undefined;

    if (!pubkey || !nonce || !kid || !signature) {
        logger.warn("keyUpload", "Missing required fields", {
            userId: locals.user.id,
            hasPubkey: !!pubkey,
            hasNonce: !!nonce,
            hasKid: !!kid,
            hasSignature: !!signature,
        });
        return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate the challenge
    const challenge = consumeChallenge(nonce);
    if (!challenge) {
        logger.warn("keyUpload", "Challenge invalid or expired", { nonce, userId: locals.user.id });
        return Response.json({ error: "Challenge invalid or expired" }, { status: 401 });
    }
    if (challenge.userId !== locals.user.id) {
        logger.warn("keyUpload", "Challenge userId mismatch", {
            expected: challenge.userId,
            actual: locals.user.id,
        });
        return Response.json({ error: "Challenge userId mismatch" }, { status: 401 });
    }

    // Verify the signature
    const challengeData = JSON.stringify(challenge);
    const isValid = verifyEcdsaSignature(pubkey, challengeData, signature);
    if (!isValid) {
        logger.warn("keyUpload", "Signature verification failed", {
            kid,
            userId: locals.user.id,
        });
        return Response.json({ error: "Signature verification failed — key rejected" }, { status: 401 });
    }

    logger.info("keyUpload", "Signature verified, storing key", {
        kid,
        userId: locals.user.id,
        keyLevel,
    });

    try {
        const now = new Date();
        const record = await db.transaction(async (tx) => {
            // Revoke prior active keys of the same level for this user. Old rows
            // are retained (never deleted) so past signatures stay verifiable.
            await tx
                .update(cryptoKeys)
                .set({ revokedAt: now })
                .where(
                    and(
                        eq(cryptoKeys.userId, locals.user.id),
                        eq(cryptoKeys.keyLevel, keyLevel),
                        isNull(cryptoKeys.revokedAt),
                    ),
                );

            const [inserted] = await tx
                .insert(cryptoKeys)
                .values({
                    userId: locals.user.id,
                    pubkey,
                    kid,
                    keyLevel,
                    algorithm,
                    deviceInfo,
                    lastUsedAt: now,
                })
                .returning();
            return inserted;
        });

        logger.info("keyUpload", "Key stored", {
            keyId: record.id,
            userId: locals.user.id,
            keyLevel,
            kid,
        });

        return Response.json({ id: record.id, keyLevel });
    } catch (err) {
        logger.error("keyUpload", "DB insert failed", err);
        return Response.json({ error: "Failed to store key" }, { status: 500 });
    }
};
