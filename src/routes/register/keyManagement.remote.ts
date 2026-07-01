import { z } from "zod";
import { command } from "$app/server";
import { db } from "$lib/server/db";
import { cryptoKeys } from "$lib/server/db/schema";
import { getRequestEvent } from "$app/server";
import { logger } from "$lib/server/logger";
import { createVerify } from "node:crypto";
import { consumeChallenge } from "$lib/server/key-challenge";

const uploadKeysInput = z.object({
    pubkey: z.string().min(1),
    keyLevel: z.number().int().min(1).optional().default(1),
    nonce: z.string().min(1),
    kid: z.string().min(1),
    signature: z.string().min(1),
});

export const uploadKeys = command(uploadKeysInput, async ({ pubkey, keyLevel, nonce, kid, signature }) => {
    const { locals } = getRequestEvent();

    if (!locals.user) {
        logger.warn("uploadKeys", "Unauthorized attempt — no session");
        throw new Error("Unauthorized: user must be logged in to upload keys");
    }

    // Validate the challenge
    const challenge = consumeChallenge(nonce);
    if (!challenge) {
        logger.warn("uploadKeys", "Challenge invalid or expired", { nonce });
        throw new Error("Challenge invalid or expired");
    }
    if (challenge.userId !== locals.user.id) {
        logger.warn("uploadKeys", "Challenge userId mismatch", {
            expected: challenge.userId,
            actual: locals.user.id,
        });
        throw new Error("Challenge userId mismatch");
    }

    // Verify the signature — the challenge JSON string was signed
    const challengeData = JSON.stringify(challenge);
    let sigBuf: Buffer = Buffer.from(signature, "base64");

    // The SW signs in IEEE P1363 format (r||s, 64 bytes for P-256).
    // Node's verify() expects DER format — convert if needed.
    if (sigBuf.length === 64) {
        sigBuf = p1363ToDer(sigBuf as Buffer);
    }

    const verify = createVerify("SHA256");
    verify.update(challengeData);
    verify.end();

    const isValid = verify.verify(pubkey, sigBuf);
    if (!isValid) {
        logger.warn("uploadKeys", "Signature verification failed", {
            kid,
            userId: locals.user.id,
            sigFormat: sigBuf.length === 64 ? "p1363" : "der",
            sigLength: sigBuf.length,
        });
        throw new Error("Signature verification failed — key rejected");
    }

    logger.info("uploadKeys", "Challenge signature verified", {
        kid,
        userId: locals.user.id,
        keyLevel,
    });

    logger.debug("uploadKeys", "Storing public key for user", {
        userId: locals.user.id,
        keyLevel,
        kid,
    });

    try {
        const [record] = await db
            .insert(cryptoKeys)
            .values({
                userId: locals.user.id,
                pubkey,
                keyLevel,
            })
            .returning();

        logger.info("uploadKeys", "Public key stored after challenge verification", {
            userId: locals.user.id,
            keyId: record.id,
            keyLevel,
            kid,
        });

        return record;
    } catch (err) {
        logger.error("uploadKeys", "DB insert failed", err);
        throw err;
    }
});

/**
 * Convert an ECDSA signature from IEEE P1363 format (r||s, 64 bytes for P-256)
 * to DER format (ASN.1 SEQUENCE { INTEGER r, INTEGER s }).
 */
function p1363ToDer(sig: Buffer): Buffer {
    const half = sig.length / 2;
    const r = sig.subarray(0, half);
    const s = sig.subarray(half);

    const derR = encodeInteger(r);
    const derS = encodeInteger(s);

    const seq = Buffer.concat([derR, derS]);
    return Buffer.concat([
        Buffer.from([0x30, seq.length]),
        seq,
    ]);
}

function encodeInteger(bytes: Buffer): Buffer {
    // Strip leading zeros
    let start = 0;
    while (start < bytes.length && bytes[start] === 0) start++;
    const stripped = start < bytes.length ? bytes.subarray(start) : Buffer.from([0]);

    // Add 0x00 prefix if high bit is set
    const prefix = (stripped[0] & 0x80) ? Buffer.from([0x00]) : Buffer.alloc(0);

    const contents = Buffer.concat([prefix, stripped]);
    return Buffer.concat([
        Buffer.from([0x02, contents.length]),
        contents,
    ]);
}
