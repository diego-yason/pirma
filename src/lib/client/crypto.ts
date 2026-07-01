/**
 * Client-side signing key management.
 *
 * Uses WebAuthn (device-bound) as the primary key, falling back to
 * in-memory ECDSA when WebAuthn is unavailable.
 *
 * WebAuthn registration happens silently after login. The credential
 * stays bound to the device (platform attachment, no sync) and does
 * not prompt for user verification during signing.
 */

import { registerWebAuthnKey } from "./webauthn";

let keyPair: CryptoKeyPair | null = null;
let webauthnCredentialId: string | null = null;

/**
 * Registers a signing key with the server.
 * Tries WebAuthn first; if unavailable falls back to ECDSA.
 */
export async function registerPublicKey(): Promise<void> {
    // Try WebAuthn
    if (typeof PublicKeyCredential !== "undefined") {
        try {
            const reg = await registerWebAuthnKey({
                userEmail: "", // filled by caller or server
                userName: "",
            });
            const res = await fetch("/api/keys/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    keyType: "webauthn",
                    credentialId: reg.credentialId,
                    pubkey: reg.pubkey,
                    deviceInfo: reg.deviceInfo,
                }),
            });
            if (res.ok) {
                webauthnCredentialId = reg.credentialId;
                return;
            }
        } catch {
            // WebAuthn failed — fall through to ECDSA
        }
    }

    // Fallback: ECDSA in-memory key
    const kp = await getOrCreateKeyPair();
    const spki = await crypto.subtle.exportKey("spki", kp.publicKey);
    const pem = spkiToPem(spki);

    await fetch("/api/keys/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pubkey: pem }),
    });
}

/**
 * Returns the current in-memory ECDSA key pair, generating one if none exists.
 */
export async function getOrCreateKeyPair(): Promise<CryptoKeyPair> {
    if (keyPair) return keyPair;

    keyPair = await crypto.subtle.generateKey(
        {
            name: "ECDSA",
            namedCurve: "P-256",
        },
        false,
        ["sign"],
    );

    return keyPair;
}

/**
 * Signs data. Uses WebAuthn if available, otherwise ECDSA.
 */
export async function sign(data: BufferSource): Promise<ArrayBuffer> {
    // Use WebAuthn if we have a credential
    if (webauthnCredentialId) {
        const { signWithWebAuthn } = await import("./webauthn");
        const view = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array((data as ArrayBufferView).buffer);
        const challenge = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
        const result = await signWithWebAuthn(webauthnCredentialId, challenge);
        // Return the raw signature bytes as ArrayBuffer
        const sig = base64urlToBytes(result.signature);
        return sig.buffer as ArrayBuffer;
    }

    // Fallback: ECDSA
    const kp = await getOrCreateKeyPair();
    return crypto.subtle.sign(
        {
            name: "ECDSA",
            hash: { name: "SHA-256" },
        },
        kp.privateKey,
        data,
    );
}

function spkiToPem(buffer: ArrayBuffer): string {
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;
}

function base64urlToBytes(b64: string): Uint8Array {
    const s = b64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

