/**
 * WebAuthn utilities for device-bound signing keys.
 *
 * - Platform attachment → key stays on this device, does NOT sync
 * - residentKey discouraged → no discoverable credentials stored
 * - userVerification discouraged → no biometric/PIN prompts for signing
 */

export interface WebAuthnRegistration {
    credentialId: string;
    pubkey: string;
    deviceInfo: {
        platform: string;
        userAgent: string;
        vendor?: string;
    };
}

/** Register a new device-bound WebAuthn credential for document signing. */
export async function registerWebAuthnKey(options: {
    userEmail: string;
    userName: string;
}): Promise<WebAuthnRegistration> {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const credential = (await navigator.credentials.create({
        publicKey: {
            challenge: challenge.buffer.slice(challenge.byteOffset, challenge.byteOffset + challenge.byteLength),
            rp: { name: "Pirma", id: window.location.hostname },
            user: {
                id: userId.buffer.slice(userId.byteOffset, userId.byteOffset + userId.byteLength),
                name: options.userEmail,
                displayName: options.userName,
            },
            pubKeyCredParams: [
                { type: "public-key", alg: -7 },  // ES256
                { type: "public-key", alg: -257 }, // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: "platform",
                residentKey: "discouraged",
                userVerification: "discouraged",
            },
            attestation: "none",
        },
    })) as PublicKeyCredential;

    const response = credential.response as AuthenticatorAttestationResponse;
    const pubkeyBytes = response.getPublicKey();
    if (!pubkeyBytes) throw new Error("WebAuthn: public key not available from authenticator");

    const vendor = typeof navigator !== 'undefined' ? (navigator as unknown as Record<string, unknown>).vendor as string | undefined : undefined;
    return {
        credentialId: b64urlEncode(new Uint8Array(credential.rawId)),
        pubkey: b64urlEncode(new Uint8Array(pubkeyBytes)),
        deviceInfo: {
            platform: navigator.platform,
            userAgent: navigator.userAgent,
            vendor,
        },
    };
}

/** Sign a challenge using the stored WebAuthn credential. */
export async function signWithWebAuthn(
    credentialIdBase64: string,
    challenge: ArrayBufferLike | ArrayBuffer,
): Promise<{ signature: string; authenticatorData: string }> {
    const rawIdArr = b64urlDecode(credentialIdBase64);
    const challengeArr = new Uint8Array(challenge);
    const idBuf = rawIdArr.buffer.slice(rawIdArr.byteOffset, rawIdArr.byteOffset + rawIdArr.byteLength) as ArrayBuffer;
    const challengeBuf = challengeArr.buffer.slice(challengeArr.byteOffset, challengeArr.byteOffset + challengeArr.byteLength) as ArrayBuffer;
    const credential = (await navigator.credentials.get({
        publicKey: {
            challenge: challengeBuf,
            allowCredentials: [
                {
                    id: idBuf,
                    type: "public-key",
                },
            ],
            userVerification: "discouraged",
        },
    })) as PublicKeyCredential;

    const response = credential.response as AuthenticatorAssertionResponse;
    return {
        signature: b64urlEncode(new Uint8Array(response.signature)),
        authenticatorData: b64urlEncode(new Uint8Array(response.authenticatorData)),
    };
}

// ── Base64url helpers ─────────────────────────────────────

function b64urlEncode(buf: Uint8Array): string {
    return btoa(String.fromCharCode(...buf))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function b64urlDecode(b64: string): Uint8Array {
    const s = b64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}
