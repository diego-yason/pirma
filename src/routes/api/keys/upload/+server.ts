import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { cryptoKeys } from "$lib/server/db/schema";
import { logger } from "$lib/server/logger";
import { verifyEcdsaSignature } from "$lib/server/crypto/verify-signature";
import { consumeChallenge } from "$lib/server/crypto/key-challenge";

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
    if (!locals.user) {
        logger.warn("keyUpload", "Unauthorized attempt — no session");
        return json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return json({ error: "Invalid JSON" }, { status: 400 });
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
        return json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate the challenge
    const challenge = consumeChallenge(nonce);
    if (!challenge) {
        logger.warn("keyUpload", "Challenge invalid or expired", { nonce, userId: locals.user.id });
        return json({ error: "Challenge invalid or expired" }, { status: 401 });
    }
    if (challenge.userId !== locals.user.id) {
        logger.warn("keyUpload", "Challenge userId mismatch", {
            expected: challenge.userId,
            actual: locals.user.id,
        });
        return json({ error: "Challenge userId mismatch" }, { status: 401 });
    }

    // Verify the signature
    const challengeData = JSON.stringify(challenge);
    const isValid = verifyEcdsaSignature(pubkey, challengeData, signature);
    if (!isValid) {
        logger.warn("keyUpload", "Signature verification failed", {
            kid,
            userId: locals.user.id,
        });
        return json({ error: "Signature verification failed — key rejected" }, { status: 401 });
    }

    logger.info("keyUpload", "Signature verified, storing key", {
        kid,
        userId: locals.user.id,
        keyLevel,
    });

    try {
        const [record] = await db
            .insert(cryptoKeys)
            .values({
                userId: locals.user.id,
                pubkey,
                kid,
                keyLevel,
                algorithm,
                deviceInfo,
                lastUsedAt: new Date(),
            })
            .returning();

        logger.info("keyUpload", "Key stored", {
            keyId: record.id,
            userId: locals.user.id,
            keyLevel,
            kid,
        });

        return json({ id: record.id, keyLevel });
    } catch (err) {
        logger.error("keyUpload", "DB insert failed", err);
        return json({ error: "Failed to store key" }, { status: 500 });
    }
};
