import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPairSync, createSign, type KeyObject } from "node:crypto";
import { verifyEcdsaSignature } from "./verify-signature";

const DATA = "pkg-1:doc-1:abc123:f1,f2:user-9";

let pubkey: string;
let otherPubkey: string;
let derB64: string;
let p1363B64: string;

function signDer(data: string, key: KeyObject): string {
    const signer = createSign("SHA256");
    signer.update(data);
    signer.end();
    return signer.sign(key).toString("base64");
}

function signP1363(data: string, key: KeyObject): string {
    const signer = createSign("SHA256");
    signer.update(data);
    signer.end();
    return signer.sign({ key, dsaEncoding: "ieee-p1363" }).toString("base64");
}

beforeAll(() => {
    const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    pubkey = publicKey.export({ type: "spki", format: "pem" }).toString();

    derB64 = signDer(DATA, privateKey); // DER by default
    p1363B64 = signP1363(DATA, privateKey);

    const other = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    otherPubkey = other.publicKey.export({ type: "spki", format: "pem" }).toString();
});

describe("verifyEcdsaSignature", () => {
    it("accepts a valid DER-encoded signature", () => {
        expect(verifyEcdsaSignature(pubkey, DATA, derB64)).toBe(true);
    });

    it("accepts a valid IEEE P1363 (r||s, 64-byte) signature", () => {
        expect(verifyEcdsaSignature(pubkey, DATA, p1363B64)).toBe(true);
    });

    it("rejects a signature over different data", () => {
        expect(verifyEcdsaSignature(pubkey, DATA + "tampered", derB64)).toBe(false);
    });

    it("rejects a signature from a different key", () => {
        expect(verifyEcdsaSignature(otherPubkey, DATA, derB64)).toBe(false);
    });

    it("rejects a tampered P1363 signature (flipped byte keeps it in range)", () => {
        const buf = Buffer.from(p1363B64, "base64");
        buf[buf.length - 1]! ^= 0x01; // flip a low bit of s — stays a valid-length, valid-range sig
        expect(verifyEcdsaSignature(pubkey, DATA, buf.toString("base64"))).toBe(false);
    });

    it("rejects malformed signature input (empty string)", () => {
        // Fail-closed: malformed input returns false rather than throwing.
        expect(verifyEcdsaSignature(pubkey, DATA, "")).toBe(false);
    });

    it("rejects malformed signature input (garbage base64)", () => {
        expect(verifyEcdsaSignature(pubkey, DATA, "!!!not-base64!!!")).toBe(false);
    });

    it("rejects a structurally-invalid DER signature (truncated)", () => {
        const full = Buffer.from(derB64, "base64");
        const truncated = full.subarray(0, Math.floor(full.length / 2));
        expect(verifyEcdsaSignature(pubkey, DATA, truncated.toString("base64"))).toBe(false);
    });

    it("fails closed on an invalid public key (no throw → no 500)", () => {
        // Exercises the try/catch: a garbage key makes verify.verify() throw;
        // the function must swallow it and return false.
        expect(verifyEcdsaSignature("not-a-pem-key", DATA, derB64)).toBe(false);
    });
});
