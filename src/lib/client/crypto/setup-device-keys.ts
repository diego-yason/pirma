import { getDeviceFingerprint } from "#lib/client/crypto/device-fingerprint.js";
import type { DeviceFingerprint } from "#lib/client/crypto/device-fingerprint.js";

/**
 * Unified device-bound key setup flow.
 *
 * Call `setupDeviceKeys(userId, password?)` after login or registration.
 * It checks the SW for existing keys, generates new ones if missing, proves
 * ownership via challenge-response, and uploads public keys.
 *
 * Key model:
 *  - Level-1: session-only key, held in SW memory, never persisted.
 *    Generated lazily; requires no password.
 *  - Level-2: persistent key wrapped with the password + random salt,
 *    stored in IndexedDB. Only created when a password is provided.
 *
 * Returns the number of keys accepted by the server (0–2).
 */

let _listener = false;
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let nextId = 0;

function ensureListener() {
    if (_listener) return;
    _listener = true;
    navigator.serviceWorker.addEventListener("message", (event) => {
        const msg = event.data as { id: string; success: boolean; data?: unknown; error?: string };
        const p = pending.get(msg.id);
        if (!p) return;
        pending.delete(msg.id);
        if (msg.success) p.resolve(msg.data);
        else p.reject(new Error(msg.error ?? "Unknown error"));
    });
}

function send<T = unknown>(type: string, payload?: Record<string, unknown>): Promise<T> {
    if (!navigator.serviceWorker.controller) throw new Error("No active service worker");
    return new Promise((resolve, reject) => {
        const id = `k${++nextId}`;
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
        navigator.serviceWorker.controller!.postMessage({ type, id, payload });
    });
}

// ── SW communication ───────────────────────────────────────────

async function swHasKeys(userId: string): Promise<boolean> {
    ensureListener();
    const result = await send<{ has: boolean }>("hasKeys", { userId });
    return result.has;
}

async function swHasPersistentKeys(userId: string): Promise<boolean> {
    ensureListener();
    const result = await send<{ has: boolean }>("hasPersistentKeys", { userId });
    return result.has;
}

async function swGenerateKeyPair(userId: string, password: string) {
    ensureListener();
    return send<{
        kid: string;
        publicKey: string;
        keyLevel: number;
        kidPw: string | null;
        publicKeyPw: string | null;
        keyLevelPw: number | null;
        algorithm: string;
    }>("generateKeyPair", { userId, password });
}

async function swSign(kid: string, data: string): Promise<string> {
    ensureListener();
    const result = await send<{ signature: string }>("sign", { kid, data });
    return result.signature;
}

// ── Upload with retry ──────────────────────────────────────────

async function uploadKey(
    pubkey: string,
    keyLevel: number,
    algorithm: string,
    kid: string,
    label: string,
    deviceInfo?: DeviceFingerprint,
): Promise<boolean> {
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            // Fetch challenge
            const chalRes = await fetch("/api/keys/challenge");
            if (!chalRes.ok) throw new Error("Failed to get challenge");
            const challenge = await chalRes.json();
            const sig = await swSign(kid, JSON.stringify(challenge));

            const res = await fetch("/api/keys/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pubkey,
                    keyLevel,
                    algorithm,
                    nonce: challenge.nonce,
                    kid,
                    signature: sig,
                    ...(deviceInfo ? { deviceInfo } : {}),
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error ?? "Upload failed");
            }
            console.log(`[deviceKeys] ${label} accepted (attempt ${attempt})`);
            return true;
        } catch (e) {
            console.warn(`[deviceKeys] ${label} attempt ${attempt} failed`, e);
        }
    }
    return false;
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Check whether a level-1 session key is present in the service worker's memory.
 */
export async function hasDeviceKeys(userId: string): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) {
        console.warn("[deviceKeys] hasDeviceKeys: no active service worker");
        return false;
    }
    try {
        const exists = await swHasKeys(userId);
        console.log(`[deviceKeys] hasDeviceKeys: ${exists ? "found" : "not found"}`, { userId });
        return exists;
    } catch (err) {
        console.warn("[deviceKeys] hasDeviceKeys: SW communication failed", { userId, error: err });
        return false;
    }
}

/**
 * Check whether a persistent (level-2, password-wrapped) key exists in IndexedDB.
 */
export async function hasPersistentKeys(userId: string): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) {
        console.warn("[deviceKeys] hasPersistentKeys: no active service worker");
        return false;
    }
    try {
        return await swHasPersistentKeys(userId);
    } catch (err) {
        console.warn("[deviceKeys] hasPersistentKeys: SW communication failed", {
            userId,
            error: err,
        });
        return false;
    }
}

/**
 * Full key setup: generate keys, prove ownership, upload public keys.
 * Returns the number of keys accepted by the server (0–2).
 *
 * - Level-1 session key is always ensured (no password needed).
 * - Level-2 persistent key is created only when a `password` is provided.
 *
 * @param force — if true, skip the local existence checks and always regenerate.
 *                Use when the server reports no active keys (e.g. revoked).
 */
export async function setupDeviceKeys(
    userId: string,
    password?: string,
    force = false,
): Promise<number> {
    console.log("[deviceKeys] Starting key setup", {
        userId,
        hasPassword: !!password,
        force,
    });

    // 1. Check what already exists locally (skip if forcing re-setup)
    const existingL1 = !force && (await hasDeviceKeys(userId));
    const existingL2 = !force && !!password && (await hasPersistentKeys(userId));

    // Everything we need is already present locally.
    if (existingL1 && (!password || existingL2)) {
        console.log("[deviceKeys] Keys already present on this device");
        return password ? 2 : 1;
    }

    // 2. Generate key pair(s) in the service worker.
    //    A level-2 key is produced only when one is missing AND a password is
    //    available. Password-less calls produce only the level-1 session key.
    const needL2 = !!password && !existingL2;
    console.log("[deviceKeys] Generating key pair(s)", { needL2 });
    const gen = await swGenerateKeyPair(userId, needL2 ? password : "");

    // 3. Compute device fingerprint (non-invasive, hash-based)
    let fp: DeviceFingerprint | undefined;
    try {
        fp = await getDeviceFingerprint();
        console.log("[deviceKeys] Device fingerprint computed", {
            label: fp.label,
            hash: fp.hash.slice(0, 8) + "…",
        });
    } catch (err) {
        console.warn("[deviceKeys] Device fingerprint failed, skipping", err);
    }

    let accepted = 0;

    // 4a. Upload the freshly generated level-1 session key. Uploading whatever
    //     the SW produced keeps local state and the server in sync, so there
    //     are never orphaned/unregistered local keys.
    console.log("[deviceKeys] Uploading level-1 session key");
    const okA = await uploadKey(gen.publicKey, gen.keyLevel, gen.algorithm, gen.kid, "keyA", fp);
    if (okA) accepted++;
    else if (existingL1) accepted++; // pre-existing key still counts

    // 4b. Upload level-2 persistent key when it was generated
    if (needL2 && gen.kidPw && gen.publicKeyPw && gen.keyLevelPw != null) {
        console.log("[deviceKeys] Uploading level-2 persistent key");
        const okB = await uploadKey(
            gen.publicKeyPw,
            gen.keyLevelPw,
            gen.algorithm,
            gen.kidPw,
            "keyB",
            fp,
        );
        if (okB) accepted++;
    } else if (existingL2) {
        accepted++;
    }

    console.log(`[deviceKeys] ${accepted} key(s) accepted`);
    return accepted;
}
