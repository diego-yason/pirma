import { getDeviceFingerprint } from "$lib/client/crypto/device-fingerprint";
import type { DeviceFingerprint } from "$lib/client/crypto/device-fingerprint";

/**
 * Unified device-bound key setup flow.
 *
 * Call `setupDeviceKeys(userId, password)` after login or registration.
 * It checks the SW for existing keys, generates new ones if missing,
 * proves ownership via challenge-response, and uploads public keys.
 *
 * Returns the number of keys accepted by the server (0, 1, or 2).
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

async function swGenerateKeyPair(userId: string, password: string) {
    ensureListener();
    return send<{
        kid: string;
        publicKey: string;
        keyLevel: number;
        kidPw: string;
        publicKeyPw: string;
        keyLevelPw: number;
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
 * Check whether device-bound keys exist in the service worker.
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
 * Full key setup: generate keys, prove ownership, upload public keys.
 * Returns the number of keys accepted by the server (0–2).
 *
 * @param force — if true, skip the local `hasDeviceKeys` check and always regenerate.
 *                Use when the server reports no active keys (e.g. revoked).
 */
export async function setupDeviceKeys(
    userId: string,
    password: string,
    force = false,
): Promise<number> {
    console.log("[deviceKeys] Starting key setup", { userId, force });

    // 1. Check if keys already exist locally (skip if forcing re-setup)
    if (!force) {
        const existing = await hasDeviceKeys(userId);
        if (existing) {
            console.log("[deviceKeys] Keys already exist on this device");
            return 2;
        }
    }

    // 2. Generate keys in the service worker
    console.log("[deviceKeys] Generating key pairs");
    const { kid, publicKey, kidPw, publicKeyPw, keyLevel, keyLevelPw, algorithm } =
        await swGenerateKeyPair(userId, password);

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

    // 4. Upload both keys sequentially (each needs its own one-time challenge)
    console.log("[deviceKeys] Uploading key A (userId-encrypted)");
    const okA = await uploadKey(publicKey, keyLevel, algorithm, kid, "keyA", fp);

    console.log("[deviceKeys] Uploading key B (password-encrypted)");
    const okB = await uploadKey(publicKeyPw, keyLevelPw, algorithm, kidPw, "keyB", fp);

    const accepted = [okA, okB].filter(Boolean).length;
    console.log(`[deviceKeys] ${accepted}/2 keys accepted`);
    return accepted;
}
