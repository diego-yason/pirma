const KEY_ALGORITHM = "ECDSA";
const CURVE = "P-256";

const PBKDF2_ITERATIONS = 600_000;
const IV_LENGTH = 12;

export interface StoredKeyPair {
    publicKey: string; // base64-encoded SPKI
    encryptedPrivateKey: string; // base64-encoded: iv + ciphertext
}

/**
 * Generate an ECDSA P-256 key pair using the Web Crypto API.
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: KEY_ALGORITHM,
            namedCurve: CURVE,
        },
        true, // extractable so we can export and wrap
        ["sign", "verify"],
    );

    return keyPair;
}

/**
 * Export the public key as a base64-encoded SPKI string.
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
    const spki = await crypto.subtle.exportKey("spki", publicKey);
    return arrayBufferToBase64(spki);
}

/**
 * Derive an AES-GCM key from a password using PBKDF2.
 */
async function deriveEncryptionKey(password: string, salt: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"],
    );

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: encoder.encode(salt),
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256",
        },
        keyMaterial,
        {
            name: "AES-GCM",
            length: 256,
        },
        false,
        ["wrapKey", "unwrapKey"],
    );
}

/**
 * Encrypt (wrap) the private key using AES-GCM with a key derived from password + userId.
 * Uses wrapKey so the plaintext private key never leaves the Web Crypto API.
 * Returns a base64-encoded: iv (12) + wrapped key bytes.
 */
export async function encryptPrivateKey(
    privateKey: CryptoKey,
    password: string,
    userId: string,
): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const aesKey = await deriveEncryptionKey(password, userId);

    const wrapped = await crypto.subtle.wrapKey("pkcs8", privateKey, aesKey, {
        name: "AES-GCM",
        iv: iv as BufferSource,
    });

    // Concatenate: iv + wrapped key
    const combined = new Uint8Array(IV_LENGTH + wrapped.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(wrapped), IV_LENGTH);

    return arrayBufferToBase64(combined.buffer);
}

/**
 * Decrypt (unwrap) the private key using the password and userId.
 * Uses unwrapKey so the unwrapped key goes directly into a CryptoKey handle.
 */
export async function decryptPrivateKey(
    encryptedPrivateKey: string,
    password: string,
    userId: string,
): Promise<CryptoKey> {
    const combined = base64ToArrayBuffer(encryptedPrivateKey);
    const combinedBytes = new Uint8Array(combined);

    const iv = combinedBytes.slice(0, IV_LENGTH);
    const wrappedKey = combinedBytes.slice(IV_LENGTH);

    const aesKey = await deriveEncryptionKey(password, userId);

    return crypto.subtle.unwrapKey(
        "pkcs8",
        wrappedKey as BufferSource,
        aesKey,
        { name: "AES-GCM", iv: iv as BufferSource },
        {
            name: KEY_ALGORITHM,
            namedCurve: CURVE,
        },
        true, // extractable
        ["sign"],
    );
}

/**
 * Import a private key from a base64-encoded PKCS8 string.
 */
export async function importPrivateKey(pkcs8Base64: string): Promise<CryptoKey> {
    const pkcs8 = base64ToArrayBuffer(pkcs8Base64);

    return crypto.subtle.importKey(
        "pkcs8",
        pkcs8,
        {
            name: KEY_ALGORITHM,
            namedCurve: CURVE,
        },
        true,
        ["sign"],
    );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
