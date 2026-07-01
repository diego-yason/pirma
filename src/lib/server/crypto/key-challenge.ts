import { env } from "$env/dynamic/private";
import { createHash } from "node:crypto";
import { logger } from "$lib/server/logger";

interface KeyChallenge {
    userId: string;
    nonce: string;
    timestamp: number;
    purpose: string;
}

const challenges = new Map<string, KeyChallenge>();
const CHALLENGE_TTL = 5 * 60 * 1000;

// Clean up expired challenges every 2 minutes
setInterval(() => {
    const now = Date.now();
    let count = 0;
    for (const [key, val] of challenges) {
        if (now - val.timestamp > CHALLENGE_TTL) { challenges.delete(key); count++; }
    }
    if (count > 0) logger.debug("keyChallenge", `Cleaned ${count} expired challenges`);
}, 2 * 60 * 1000);

/** Create a new key-registration challenge for the given user. */
export function createChallenge(userId: string): KeyChallenge {
    const nonce = createHash("sha256")
        .update(`${userId}:${Date.now()}:${env.BETTER_AUTH_SECRET}`)
        .digest("hex")
        .slice(0, 16);
    const challenge: KeyChallenge = {
        userId,
        nonce,
        timestamp: Date.now(),
        purpose: "key-registration",
    };
    challenges.set(nonce, challenge);
    logger.debug("keyChallenge", "Challenge created", { userId, nonce });
    return challenge;
}

/** Verify and consume a challenge (one-time use). Returns null if invalid/expired. */
export function consumeChallenge(nonce: string): KeyChallenge | null {
    const challenge = challenges.get(nonce);
    if (!challenge) {
        logger.warn("keyChallenge", "Challenge not found (already used or never created)", { nonce });
        return null;
    }
    challenges.delete(nonce);

    if (Date.now() - challenge.timestamp > CHALLENGE_TTL) {
        logger.warn("keyChallenge", "Challenge expired", {
            nonce,
            userId: challenge.userId,
            age: Date.now() - challenge.timestamp,
        });
        return null;
    }
    if (challenge.purpose !== "key-registration") {
        logger.warn("keyChallenge", "Challenge purpose mismatch", {
            nonce,
            expected: "key-registration",
            actual: challenge.purpose,
        });
        return null;
    }

    logger.info("keyChallenge", "Challenge consumed", { userId: challenge.userId, nonce });
    return challenge;
}
