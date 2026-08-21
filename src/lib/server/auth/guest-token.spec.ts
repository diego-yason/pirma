import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { BETTER_AUTH_SECRET } from "$app/env/private";
import { createGuestToken, verifyGuestToken } from "./guest-token";

// BETTER_AUTH_SECRET comes from the committed `.env.test` (baked into $app/env/private),
// so these tests need no vi.mock and are deterministic.

/** Craft a token signed with the same secret — used to build edge-case payloads. */
function signToken(payload: unknown): string {
    const payloadB64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
    const sig = createHmac("sha256", BETTER_AUTH_SECRET).update(payloadB64).digest("base64url");
    return `${payloadB64}.${sig}`;
}

const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // +1 day
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // -1 day

describe("createGuestToken", () => {
    it("produces a payload.signature pair of base64url segments", () => {
        const token = createGuestToken("recipient-1", "pkg-1");
        const parts = token.split(".");
        expect(parts).toHaveLength(2);
        for (const part of parts) {
            expect(part).toMatch(/^[A-Za-z0-9_-]+$/); // base64url alphabet
        }
    });

    it("embeds recipientId, packageId and a ~7-day expiry", () => {
        const token = createGuestToken("recipient-1", "pkg-1");
        const payload = verifyGuestToken(token);
        expect(payload?.recipientId).toBe("recipient-1");
        expect(payload?.packageId).toBe("pkg-1");
        const expMs = new Date(payload!.exp).getTime();
        const approx = 7 * 24 * 60 * 60 * 1000;
        // Allow a little slack for the time between creation and assertion.
        expect(Math.abs(expMs - Date.now() - approx)).toBeLessThan(60_000);
    });

    it("produces different tokens for different recipients/packages", () => {
        expect(createGuestToken("a", "pkg-1")).not.toBe(createGuestToken("b", "pkg-1"));
        expect(createGuestToken("a", "pkg-1")).not.toBe(createGuestToken("a", "pkg-2"));
    });
});

describe("verifyGuestToken", () => {
    it("round-trips a token created by createGuestToken", () => {
        const token = createGuestToken("recipient-9", "pkg-42");
        expect(verifyGuestToken(token)).toEqual({
            recipientId: "recipient-9",
            packageId: "pkg-42",
            exp: expect.any(String),
        });
    });

    it("rejects a token whose payload was tampered with", () => {
        const token = createGuestToken("recipient-1", "pkg-1");
        const [payloadB64, sig] = token.split(".");
        const tampered = Buffer.from(
            JSON.stringify({ recipientId: "evil", packageId: "pkg-1", exp: FUTURE }),
            "utf-8",
        ).toString("base64url");
        expect(verifyGuestToken(`${tampered}.${sig}`)).toBeNull();
    });

    it("rejects a token whose signature was tampered with", () => {
        const token = createGuestToken("recipient-1", "pkg-1");
        const [payloadB64] = token.split(".");
        const badSig = createHmac("sha256", "wrong-secret").update(payloadB64).digest("base64url");
        expect(verifyGuestToken(`${payloadB64}.${badSig}`)).toBeNull();
    });

    it("rejects a token signed with a different secret", () => {
        const token = signToken({ recipientId: "r", packageId: "p", exp: FUTURE });
        // signToken uses BETTER_AUTH_SECRET, so a valid token verifies:
        expect(verifyGuestToken(token)).not.toBeNull();
        // But a token produced by an HMAC over the *payload* with a different
        // key but same claimed secret structure fails. Directly flip a secret:
        const [payloadB64] = token.split(".");
        const wrong = createHmac("sha256", "other-secret").update(payloadB64).digest("base64url");
        expect(verifyGuestToken(`${payloadB64}.${wrong}`)).toBeNull();
    });

    it("rejects an expired token", () => {
        const token = signToken({ recipientId: "r", packageId: "p", exp: PAST });
        expect(verifyGuestToken(token)).toBeNull();
    });

    it("accepts a not-yet-expired token", () => {
        const token = signToken({ recipientId: "r", packageId: "p", exp: FUTURE });
        expect(verifyGuestToken(token)?.recipientId).toBe("r");
    });

    it("rejects a token with no delimiter", () => {
        expect(verifyGuestToken("no-dot-here")).toBeNull();
        expect(verifyGuestToken("")).toBeNull();
    });

    it("rejects a token with garbage payload (not base64 JSON)", () => {
        const garbage = Buffer.from("!!!not-json!!!").toString("base64url");
        const sig = createHmac("sha256", BETTER_AUTH_SECRET).update(garbage).digest("base64url");
        expect(verifyGuestToken(`${garbage}.${sig}`)).toBeNull();
    });

    it("rejects a token whose payload is not valid JSON", () => {
        const notJson = Buffer.from("{ this is not json", "utf-8").toString("base64url");
        const sig = createHmac("sha256", BETTER_AUTH_SECRET).update(notJson).digest("base64url");
        expect(verifyGuestToken(`${notJson}.${sig}`)).toBeNull();
    });
});
