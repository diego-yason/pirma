import { createHmac, timingSafeEqual } from "node:crypto";
import { BETTER_AUTH_SECRET } from "$app/env/private";

const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface GuestTokenPayload {
    /** package_recipients.id */
    recipientId: string;
    /** packages.id */
    packageId: string;
    /** ISO timestamp when the token expires */
    exp: string;
}

/**
 * Creates a signed guest token for a package recipient.
 * The token is an HMAC-SHA256 signed string that can be passed via URL.
 */
export function createGuestToken(recipientId: string, packageId: string): string {
    const exp = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString();
    const payload: GuestTokenPayload = { recipientId, packageId, exp };
    const payloadStr = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadStr, "utf-8").toString("base64url");
    const sig = createHmac("sha256", BETTER_AUTH_SECRET).update(payloadB64).digest("base64url");

    return `${payloadB64}.${sig}`;
}

/**
 * Verifies a guest token and returns the payload if valid, or null.
 */
export function verifyGuestToken(token: string): GuestTokenPayload | null {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;

    const payloadB64 = token.slice(0, dot);
    const sig = token.slice(dot + 1);

    // Verify HMAC signature
    const expectedSig = createHmac("sha256", BETTER_AUTH_SECRET)
        .update(payloadB64)
        .digest("base64url");

    const sigBuf = Buffer.from(sig, "base64url");
    const expectedBuf = Buffer.from(expectedSig, "base64url");

    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
        return null;
    }

    // Decode payload
    let payload: GuestTokenPayload;
    try {
        const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf-8");
        payload = JSON.parse(payloadStr);
    } catch {
        return null;
    }

    // Check expiry
    if (new Date(payload.exp).getTime() < Date.now()) {
        return null;
    }

    return payload;
}
