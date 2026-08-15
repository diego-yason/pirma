/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

export {}; // isolate module scope — prevents SW globals conflicting with DOM

const sw = self as unknown as ServiceWorkerGlobalScope;

const PBKDF2_ITERATIONS = 600_000;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const DB_NAME = "pirma-sw-keys";
const STORE_NAME = "encrypted-keys";

// In-memory private keys for active signing sessions.
// Level-1 keys live HERE ONLY (never persisted to disk); level-2 keys are
// loaded into here from IndexedDB after a password unlock.
interface InMemoryKey {
    userId: string;
    keyLevel: number;
    key: CryptoKey;
}
const keyStore = new Map<string, InMemoryKey>();

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
    salt: string,
    keyLevel: number,
) {
    console.log("[SW] storeEncryptedKey", {
        kid,
        userId,
        pubkeyLength: pubkey.length,
        keyLength: encryptedPrivateKey.length,
        keyLevel,
    });
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put({ kid, userId, pubkey, encryptedPrivateKey, salt, keyLevel });
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

/** Level-1 session keys live only in memory — check there. */
function hasKeysForUser(userId: string): boolean {
    for (const rec of keyStore.values()) {
        if (rec.userId === userId && rec.keyLevel === 1) return true;
    }
    return false;
}

/** Level-2 keys are persisted (password-wrapped) in IndexedDB — check there. */
async function hasPersistentKeysForUser(userId: string): Promise<boolean> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.log("[SW hasPersistentKeysForUser] No encrypted-keys store yet", { userId });
            db.close();
            resolve(false);
            return;
        }
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        if (!store.indexNames.contains("userId")) {
            console.warn("[SW hasPersistentKeysForUser] userId index not found", { userId });
            db.close();
            resolve(false);
            return;
        }
        const index = store.index("userId");
        const req = index.getAll(userId);
        req.onsuccess = () => {
            const results = req.result as EncryptedKeyRecord[];
            const has = results.some((r) => r.keyLevel === 2 && !!r.salt);
            console.log(`[SW hasPersistentKeysForUser] ${has ? "found" : "no"} level-2 keys`, {
                userId,
            });
            db.close();
            resolve(has);
        };
        req.onerror = () => {
            console.error("[SW hasPersistentKeysForUser] Query failed", {
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
    /** Random per-key PBKDF2 salt (base64). Absent on legacy userId-derived records. */
    salt?: string;
    /** 2 for password-wrapped persistent keys. */
    keyLevel?: number;
}

/** Fetch the persistent (level-2) key records for a user from IndexedDB. */
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
            // Only level-2 records with a salt are loadable. Legacy level-1
            // records (userId-derived, no salt) are intentionally ignored.
            resolve((results ?? []).filter((r) => r.keyLevel === 2 && !!r.salt));
        };
        req.onerror = () => {
            console.error("[SW getKeysForUser] Failed", { userId, error: req.error?.message });
            db.close();
            reject(req.error);
        };
    });
}

/**
 * Load keys into the in-memory keyStore.
 * - Level-1 session keys are already in memory (never persisted).
 * - Level-2 keys are read from IndexedDB and unwrapped with the password.
 *   Without a password they are skipped.
 */
async function handleLoadKeys(
    userId: string,
    password?: string,
): Promise<{ loaded: number; skipped: number; kids: string[] }> {
    let loaded = 0;
    let skipped = 0;
    const kids: string[] = [];

    // Level-1 session keys (in-memory only)
    for (const [kid, rec] of keyStore) {
        if (rec.userId === userId && rec.keyLevel === 1) {
            kids.push(kid);
            loaded++;
        }
    }

    // Level-2 persistent keys (IndexedDB, password-wrapped)
    const records = await getKeysForUser(userId);
    if (password) {
        for (const rec of records) {
            try {
                const raw = b64Decode(rec.encryptedPrivateKey);
                const iv = raw.slice(0, IV_LENGTH);
                const ciphertext = raw.slice(IV_LENGTH);
                const aesKey = await deriveKey(password, b64Decode(rec.salt!));
                const privateKey = await crypto.subtle.unwrapKey(
                    "pkcs8",
                    ciphertext.buffer as ArrayBuffer,
                    aesKey,
                    { name: "AES-GCM", iv },
                    { name: "ECDSA", namedCurve: "P-256" },
                    true,
                    ["sign"],
                );
                keyStore.set(rec.kid, { userId, keyLevel: 2, key: privateKey });
                kids.push(rec.kid);
                loaded++;
                console.log("[SW handleLoadKeys] Loaded level-2 key", { kid: rec.kid });
            } catch {
                skipped++;
                console.log("[SW handleLoadKeys] Skipped key (wrong password or corrupted)", {
                    kid: rec.kid,
                });
            }
        }
    } else {
        skipped += records.length;
    }

    console.log("[SW handleLoadKeys] Complete", { userId, loaded, skipped, kids });
    return { loaded, skipped, kids };
}

// ── Key generation ──────────────────────────────────────────────

/**
 * Generates signing key pair(s):
 *   1. Level-1 SESSION key — non-extractable, held only in memory, never persisted.
 *   2. Level-2 persistent key — wrapped with the password + random salt, stored in IndexedDB.
 *      Skipped entirely when no password is provided (e.g. guest/anonymous users).
 * Only public keys are ever returned to the caller.
 */
async function handleGenerateKeyPair(userId: string, password: string) {
    console.log("[SW] Starting key generation", { userId, hasPassword: !!password });
    const algorithm = { name: "ECDSA", namedCurve: "P-256" } as const;

    // ── Key A: level-1 SESSION key (in-memory only) ────────────
    console.log("[SW] Generating key A (level-1 session key)");
    const kpA = await crypto.subtle.generateKey(algorithm, false, ["sign"]);
    const spkiA = await crypto.subtle.exportKey("spki", kpA.publicKey);
    const kidA = crypto.randomUUID();
    keyStore.set(kidA, { userId, keyLevel: 1, key: kpA.privateKey });
    console.log("[SW] Key A ready", { kid: kidA });

    // ── Key B: level-2 persistent key (password-wrapped) ───────
    if (!password) {
        console.log("[SW] No password — skipping level-2 key");
        return {
            kid: kidA,
            publicKey: spkiToPem(new Uint8Array(spkiA)),
            keyLevel: 1,
            kidPw: null,
            publicKeyPw: null,
            keyLevelPw: null,
            algorithm: "ECDSA-P256",
        };
    }

    console.log("[SW] Generating key B (level-2 password-encrypted)");
    const kpB = await crypto.subtle.generateKey(algorithm, true, ["sign", "verify"]);
    const spkiB = await crypto.subtle.exportKey("spki", kpB.publicKey);
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const aesB = await deriveKey(password, salt);
    const ivB = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const wrappedB = await crypto.subtle.wrapKey("pkcs8", kpB.privateKey, aesB, {
        name: "AES-GCM",
        iv: ivB,
    });
    const kidB = crypto.randomUUID();
    keyStore.set(kidB, { userId, keyLevel: 2, key: kpB.privateKey });
    await storeEncryptedKey(
        kidB,
        userId,
        spkiToPem(new Uint8Array(spkiB)),
        ivAndCiphertext(ivB, new Uint8Array(wrappedB)),
        b64Encode(salt),
        2,
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
    const entry = keyStore.get(kid);
    if (!entry) {
        console.warn("[SW sign] Key not found", { kid, keyStoreSize: keyStore.size });
        throw new Error("Key not found in SW memory");
    }

    const key = entry.key;
    console.log("[SW sign] Signing data", { kid, keyLevel: entry.keyLevel, dataLength: data.length });

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

async function deriveKey(password: string, salt: string | Uint8Array): Promise<CryptoKey> {
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
            salt: typeof salt === "string" ? enc.encode(salt) : salt,
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
            const has = hasKeysForUser(userId);
            console.log("[SW] hasKeys response", { userId, has });
            respond({ success: true, data: { has } });
            break;
        }
        case "hasPersistentKeys": {
            console.log("[SW] Received hasPersistentKeys message");
            const { userId } = (msg.payload ?? {}) as { userId?: string };
            if (!userId) {
                respond({ success: false, error: "userId is required" });
                break;
            }
            hasPersistentKeysForUser(userId)
                .then((has) => {
                    console.log("[SW] hasPersistentKeys response", { userId, has });
                    respond({ success: true, data: { has } });
                })
                .catch((err: Error) => {
                    console.error("[SW] hasPersistentKeys error", { userId, error: err.message });
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
            if (!userId) {
                respond({ success: false, error: "userId is required" });
                break;
            }
            handleGenerateKeyPair(userId, password ?? "")
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
            const { userId, password } = (msg.payload ?? {}) as {
                userId?: string;
                password?: string;
            };
            if (!userId) {
                respond({ success: false, error: "userId is required" });
                break;
            }
            handleLoadKeys(userId, password)
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
