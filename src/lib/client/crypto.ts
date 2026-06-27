/**
 * Client-side signing key management.
 *
 * The private key is generated via Web Crypto (non-extractable) and kept
 * in module-level memory. Only the public key (SPKI PEM) is transmitted
 * to the server for storage.
 *
 * Key is valid as long as it remains in memory (page session).
 */

let keyPair: CryptoKeyPair | null = null;

/**
 * Returns the current in-memory key pair, generating one if none exists.
 * The private key is non-extractable — it cannot leave the browser.
 */
export async function getOrCreateKeyPair(): Promise<CryptoKeyPair> {
    if (keyPair) return keyPair;

    keyPair = await crypto.subtle.generateKey(
        {
            name: "ECDSA",
            namedCurve: "P-256",
        },
        false, // extractable: false — private key stays in memory
        ["sign"],
    );

    return keyPair;
}

/**
 * Exports the public key as SPKI PEM and registers it with the server.
 * Call this after getOrCreateKeyPair() to persist the public key.
 */
export async function registerPublicKey(): Promise<void> {
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
 * Signs data with the in-memory private key.
 */
export async function sign(data: BufferSource): Promise<ArrayBuffer> {
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
