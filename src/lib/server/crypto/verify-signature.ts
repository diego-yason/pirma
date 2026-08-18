import { createVerify } from "node:crypto";

/**
 * Verify an ECDSA P-256 signature.
 *
 * @param pubkey  — PEM-encoded public key (SPKI format)
 * @param data    — the raw string that was signed
 * @param signature — base64-encoded signature (IEEE P1363 or DER format)
 * @returns true if the signature is valid
 */
export function verifyEcdsaSignature(pubkey: string, data: string, signature: string): boolean {
    try {
        const sigBuf = Buffer.from(signature, "base64");

        // Convert IEEE P1363 (r||s, 64 bytes) to DER if needed
        const derBuf: Buffer = sigBuf.length === 64 ? p1363ToDer(sigBuf) : sigBuf;

        const verify = createVerify("SHA256");
        verify.update(data);
        verify.end();

        return verify.verify(pubkey, derBuf);
    } catch {
        // Fail closed: malformed key/signature input must never throw (→ 500).
        return false;
    }
}

// ── P1363 → DER conversion ──────────────────────────────────────

function p1363ToDer(sig: Buffer): Buffer {
    const half = Math.floor(sig.length / 2);
    const r = sig.subarray(0, half);
    const s = sig.subarray(half);
    const derR = encodeInteger(r);
    const derS = encodeInteger(s);
    const seq = Buffer.concat([derR, derS]);
    return Buffer.concat([Buffer.from([0x30, seq.length]), seq]);
}

function encodeInteger(bytes: Buffer): Buffer {
    let start = 0;
    while (start < bytes.length && bytes[start] === 0) start++;
    const value = start < bytes.length ? bytes.subarray(start) : Buffer.from([0]);
    const prefix = value[0]! & 0x80 ? Buffer.from([0x00]) : Buffer.alloc(0);
    return Buffer.concat([Buffer.from([0x02, value.length + prefix.length]), prefix, value]);
}
