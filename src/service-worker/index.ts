/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

export {}; // isolate module scope — prevents SW globals conflicting with DOM

const sw = self as unknown as ServiceWorkerGlobalScope;

const PBKDF2_ITERATIONS = 600_000;
const IV_LENGTH = 12;
const DB_NAME = "pirma-sw-keys";
const STORE_NAME = "encrypted-keys";

// In-memory private key references for active signing sessions
const keyStore = new Map<string, CryptoKey>();

let msgCounter = 0;

// ── IndexedDB helpers (inside SW) ───────────────────────────────

function openDB(): Promise<IDBDatabase> {
    console.log("[SW] openDB called");
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 3);
        req.onupgradeneeded = () => {
            const db = req.result;
            console.log("[SW] openDB upgrade needed");
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: "kid" });
                store.createIndex("userId", "userId", { unique: false });
                console.log("[SW] Created object store and userId index");
            } else {
                // Migrate from v1/v2 — ensure userId index exists
                const store = req.transaction!.objectStore(STORE_NAME);
                if (!store.indexNames.contains("userId")) {
                    store.createIndex("userId", "userId", { unique: false });
                    console.log("[SW] Added userId index to existing store");
                } else {
                    console.log("[SW] userId index already exists");
                }
            }
        };
        req.onsuccess = () => {
            console.log("[SW] openDB success", req.result);
            resolve(req.result);
        };
        req.onerror = () => {
            console.error("[SW] openDB failed", { error: req.error?.message });
            reject(req.error);
        };
    });
}

async function storeEncryptedKey(
    kid: string,
    userId: string,
    pubkey: string,
    encryptedPrivateKey: string,
) {
    console.log("[SW] storeEncryptedKey", {
        kid,
        userId,
        pubkeyLength: pubkey.length,
        keyLength: encryptedPrivateKey.length,
    });
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put({ kid, userId, pubkey, encryptedPrivateKey });
        tx.oncomplete = () => {
            console.log("[SW] Key stored in IndexedDB", { kid, userId });
            db.close();
            resolve();
        };
        tx.onerror = () => {
            console.error("[SW] Failed to store key in IndexedDB", {
                kid,
                userId,
                error: tx.error?.message,
            });
            reject(tx.error);
        };
    });
}

async function hasKeysForUser(userId: string): Promise<boolean> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.log("[SW hasKeysForUser] No encrypted-keys store yet", { userId });
            db.close();
            resolve(false);
            return;
        }
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        if (!store.indexNames.contains("userId")) {
            console.warn("[SW hasKeysForUser] userId index not found", { userId });
            db.close();
            resolve(false);
            return;
        }
        const index = store.index("userId");
        const req = index.count(userId);
        req.onsuccess = () => {
            const count = req.result;
            console.log(`[SW hasKeysForUser] Found ${count} keys for user`, { userId });
            db.close();
            resolve(count > 0);
        };
        req.onerror = () => {
            console.error("[SW hasKeysForUser] Query failed", {
                userId,
                error: req.error?.message,
            });
            reject(req.error);
        };
    });
}

// ── Key loading helpers ─────────────────────────────────────────

interface EncryptedKeyRecord {
    kid: string;
    userId: string;
    pubkey: string;
    encryptedPrivateKey: string;
}

/** Fetch all encrypted key records for a user from IndexedDB. */
async function getKeysForUser(userId: string): Promise<EncryptedKeyRecord[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.close();
            resolve([]);
            return;
        }
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        if (!store.indexNames.contains("userId")) {
            db.close();
            resolve([]);
            return;
        }
        const index = store.index("userId");
        const req = index.getAll(userId);
        req.onsuccess = () => {
            const results = req.result as EncryptedKeyRecord[];
            db.close();
            resolve(results ?? []);
        };
        req.onerror = () => {
            console.error("[SW getKeysForUser] Failed", { userId, error: req.error?.message });
            db.close();
            reject(req.error);
        };
    });
}

/**
 * Load keys from IndexedDB into the in-memory keyStore.
 * For level 1, decrypts with deriveKey(userId, userId).
 * Level 2 keys are skipped (require password).
 * Returns loaded count and the list of loaded kid values.
 */
async function handleLoadKeys(
    userId: string,
): Promise<{ loaded: number; skipped: number; kids: string[] }> {
    const records = await getKeysForUser(userId);
    let loaded = 0;
    let skipped = 0;
    const kids: string[] = [];

    for (const rec of records) {
        try {
            // Try level 1 decryption (userId-encrypted)
            const raw = b64Decode(rec.encryptedPrivateKey);
            const iv = raw.slice(0, IV_LENGTH);
            const ciphertext = raw.slice(IV_LENGTH);
            const aesKey = await deriveKey(userId, userId);
            const privateKey = await crypto.subtle.unwrapKey(
                "pkcs8",
                ciphertext.buffer as ArrayBuffer,
                aesKey,
                { name: "AES-GCM", iv },
                { name: "ECDSA", namedCurve: "P-256" },
                true,
                ["sign"],
            );
            keyStore.set(rec.kid, privateKey);
            kids.push(rec.kid);
            loaded++;
            console.log("[SW handleLoadKeys] Loaded key", { kid: rec.kid });
        } catch {
            // Not a level 1 key or corrupted — skip
            skipped++;
            console.log("[SW handleLoadKeys] Skipped key (not level 1)", { kid: rec.kid });
        }
    }

    console.log("[SW handleLoadKeys] Complete", { userId, loaded, skipped, kids });
    return { loaded, skipped, kids };
}

// ── Key generation ──────────────────────────────────────────────

/**
 * Generates two key pairs at registration:
 *   1. userId-encrypted key — derived from userId alone (deterministic, no password needed)
 *   2. Password-encrypted key — derived from password + userId as salt
 * Both private keys stay in the SW; only public keys are returned.
 */
async function handleGenerateKeyPair(userId: string, password: string) {
    console.log("[SW] Starting key generation", { userId });
    const algorithm = { name: "ECDSA", namedCurve: "P-256" } as const;

    // ── Key A: encrypted with userId only ──────────────────────
    console.log("[SW] Generating key A (userId-encrypted)");
    const kpA = await crypto.subtle.generateKey(algorithm, true, ["sign", "verify"]);
    const spkiA = await crypto.subtle.exportKey("spki", kpA.publicKey);
    const aesA = await deriveKey(userId, userId); // password = userId, salt = userId
    const ivA = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const wrappedA = await crypto.subtle.wrapKey("pkcs8", kpA.privateKey, aesA, {
        name: "AES-GCM",
        iv: ivA,
    });
    const kidA = crypto.randomUUID();
    keyStore.set(kidA, kpA.privateKey);
    await storeEncryptedKey(
        kidA,
        userId,
        spkiToPem(new Uint8Array(spkiA)),
        ivAndCiphertext(ivA, new Uint8Array(wrappedA)),
    );
    console.log("[SW] Key A ready", { kid: kidA });

    // ── Key B: encrypted with password + userId salt ───────────
    console.log("[SW] Generating key B (password-encrypted)");
    const kpB = await crypto.subtle.generateKey(algorithm, true, ["sign", "verify"]);
    const spkiB = await crypto.subtle.exportKey("spki", kpB.publicKey);
    const aesB = await deriveKey(password, userId);
    const ivB = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const wrappedB = await crypto.subtle.wrapKey("pkcs8", kpB.privateKey, aesB, {
        name: "AES-GCM",
        iv: ivB,
    });
    const kidB = crypto.randomUUID();
    keyStore.set(kidB, kpB.privateKey);
    await storeEncryptedKey(
        kidB,
        userId,
        spkiToPem(new Uint8Array(spkiB)),
        ivAndCiphertext(ivB, new Uint8Array(wrappedB)),
    );
    console.log("[SW] Key B ready", { kid: kidB });

    console.log("[SW] Key generation complete", { kidA, kidB, userId });
    return {
        kid: kidA,
        publicKey: spkiToPem(new Uint8Array(spkiA)),
        keyLevel: 1,
        kidPw: kidB,
        publicKeyPw: spkiToPem(new Uint8Array(spkiB)),
        keyLevelPw: 2,
        algorithm: "ECDSA-P256",
    };
}

// ── Signing ─────────────────────────────────────────────────────

async function handleSign(kid: string, data: string) {
    const key = keyStore.get(kid);
    if (!key) {
        console.warn("[SW sign] Key not found", { kid, keyStoreSize: keyStore.size });
        throw new Error("Key not found in SW memory");
    }

    console.log("[SW sign] Signing data", { kid, dataLength: data.length });

    const enc = new TextEncoder();
    const signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        enc.encode(data),
    );

    const sigB64 = b64Encode(new Uint8Array(signature));
    console.log("[SW sign] Signature produced", {
        kid,
        sigPreview: sigB64.slice(0, 32) + "…",
        sigLength: sigB64.length,
        dataLength: data.length,
    });

    return { signature: sigB64 };
}

// ── PBKDF2 key derivation ───────────────────────────────────────

async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"],
    );
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: enc.encode(salt),
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["wrapKey", "unwrapKey"],
    );
}

// ── Message dispatcher ──────────────────────────────────────────

sw.addEventListener("message", (event: ExtendableMessageEvent) => {
    const msg = event.data as {
        type: string;
        id?: string;
        payload?: Record<string, unknown>;
    };
    if (!msg?.type) return;

    const id = msg.id ?? `r${++msgCounter}`;
    const respond = (data: Record<string, unknown>) => {
        if (event.source) (event.source as Client).postMessage({ id, ...data });
    };

    switch (msg.type) {
        case "hasKeys": {
            console.log("[SW] Received hasKeys message");
            const { userId } = (msg.payload ?? {}) as { userId?: string };
            if (!userId) {
                respond({ success: false, error: "userId is required" });
                break;
            }
            hasKeysForUser(userId)
                .then((has) => {
                    console.log("[SW] hasKeys response", { userId, has });
                    respond({ success: true, data: { has } });
                })
                .catch((err: Error) => {
                    console.error("[SW] hasKeys error", { userId, error: err.message });
                    respond({ success: false, error: err.message });
                });
            break;
        }
        case "generateKeyPair": {
            console.log("[SW] Received generateKeyPair message");
            const { userId, password } = (msg.payload ?? {}) as {
                userId?: string;
                password?: string;
            };
            if (!userId || !password) {
                respond({ success: false, error: "userId and password are required" });
                break;
            }
            handleGenerateKeyPair(userId, password)
                .then((data) => {
                    console.log("[SW] generateKeyPair success", {
                        userId,
                        kid: data.kid,
                        kidPw: data.kidPw,
                    });
                    respond({ success: true, data });
                })
                .catch((err: Error) => {
                    console.error("[SW] generateKeyPair failed", { userId, error: err.message });
                    respond({ success: false, error: err.message ?? "Key generation failed" });
                });
            break;
        }
        case "sign": {
            const { kid, data, keyLevel, context } = (msg.payload ?? {}) as {
                kid?: string;
                data?: string;
                keyLevel?: number;
                context?: Record<string, unknown>;
            };
            if (!kid || !data) {
                console.warn("[SW] sign missing kid or data");
                respond({ success: false, error: "kid and data are required" });
                break;
            }
            console.log("[SW] sign request", { kid, dataLength: data.length, keyLevel });
            handleSign(kid, data)
                .then((result) => {
                    console.log("[SW] sign success", { kid });
                    respond({ success: true, data: result });
                })
                .catch((err: Error) => {
                    console.error("[SW] sign failed", { kid, error: err.message });
                    respond({ success: false, error: err.message ?? "Signing failed" });
                });
            break;
        }
        case "clearKeys": {
            console.log("[SW] Received clearKeys — clearing in-memory key store");
            keyStore.clear();
            respond({ success: true, data: {} });
            break;
        }
        case "loadKeys": {
            console.log("[SW] Received loadKeys message");
            const { userId } = (msg.payload ?? {}) as { userId?: string };
            if (!userId) {
                respond({ success: false, error: "userId is required" });
                break;
            }
            handleLoadKeys(userId)
                .then((result) => {
                    console.log("[SW] loadKeys complete", result);
                    respond({ success: true, data: result });
                })
                .catch((err: Error) => {
                    console.error("[SW] loadKeys failed", { userId, error: err.message });
                    respond({ success: false, error: err.message });
                });
            break;
        }
        default:
            console.warn("[SW] Unknown message type", { type: msg.type });
            respond({ success: false, error: `Unknown message type: ${msg.type}` });
    }
});

// ── Lifecycle ───────────────────────────────────────────────────

sw.addEventListener("install", () => {
    console.log("[SW] Installing — skipWaiting");
    sw.skipWaiting();
});
sw.addEventListener("activate", (event) => {
    console.log("[SW] Activating — claim clients");
    event.waitUntil(sw.clients.claim());
});

// ── Helpers ─────────────────────────────────────────────────────

function b64Encode(buf: Uint8Array): string {
    return btoa(String.fromCharCode(...buf));
}

function spkiToPem(spki: Uint8Array): string {
    const b64 = b64Encode(spki);
    const lines = b64.match(/.{1,64}/g) ?? [b64];
    return ["-----BEGIN PUBLIC KEY-----", ...lines, "-----END PUBLIC KEY-----"].join("\n");
}

function ivAndCiphertext(iv: Uint8Array, ciphertext: Uint8Array): string {
    const out = new Uint8Array(iv.length + ciphertext.length);
    out.set(iv);
    out.set(ciphertext, iv.length);
    return b64Encode(out);
}

function b64Decode(str: string): Uint8Array {
    const bin = atob(str);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf;
}
