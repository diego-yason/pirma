import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { cryptoKeys } from "$lib/server/db/schema";
import { logger } from "$lib/server/logger";
import { createVerify } from "node:crypto";
import { consumeChallenge } from "$lib/server/key-challenge";

export const POST: RequestHandler = async ({ request, locals }) => {
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
    let sigBuf: Buffer = Buffer.from(signature, "base64");

    if (sigBuf.length === 64) {
        sigBuf = p1363ToDer(sigBuf);
    }

    const verify = createVerify("SHA256");
    verify.update(challengeData);
    verify.end();

    const isValid = verify.verify(pubkey, sigBuf);
    if (!isValid) {
        logger.warn("keyUpload", "Signature verification failed", {
            kid,
            userId: locals.user.id,
            sigLength: sigBuf.length,
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
                keyLevel,
                algorithm,
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

// ── P1363 → DER conversion ──────────────────────────────────────

function p1363ToDer(sig: Buffer): Buffer {
    const half = sig.length / 2;
    const derR = encodeInteger(sig.subarray(0, half));
    const derS = encodeInteger(sig.subarray(half));
    const seq = Buffer.concat([derR, derS]);
    return Buffer.concat([Buffer.from([0x30, seq.length]), seq]);
}

function encodeInteger(bytes: Buffer): Buffer {
    let start = 0;
    while (start < bytes.length && bytes[start] === 0) start++;
    const stripped = start < bytes.length ? bytes.subarray(start) : Buffer.from([0]);
    const prefix = stripped[0] & 0x80 ? Buffer.from([0x00]) : Buffer.alloc(0);
    const contents = Buffer.concat([prefix, stripped]);
    return Buffer.concat([Buffer.from([0x02, contents.length]), contents]);
}
