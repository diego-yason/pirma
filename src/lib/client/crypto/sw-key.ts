/**
 * Service worker key management messenger.
 * Communicates with the SW via postMessage for key operations.
 */

let nextId = 0;
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function ensureListener() {
    if (pending.size) return;
    navigator.serviceWorker.addEventListener("message", (event) => {
        const msg = event.data as {
            id: string;
            success: boolean;
            data?: unknown;
            error?: string;
        };
        const p = pending.get(msg.id);
        if (!p) return;
        pending.delete(msg.id);
        if (msg.success) p.resolve(msg.data);
        else p.reject(new Error(msg.error ?? "Unknown error"));
    });
}

function send<T = unknown>(type: string, payload?: Record<string, unknown>): Promise<T> {
    if (!navigator.serviceWorker.controller) {
        throw new Error("No active service worker");
    }
    return new Promise((resolve, reject) => {
        const id = `k${++nextId}`;
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
        navigator.serviceWorker.controller!.postMessage({ type, id, payload });
    });
}

/** Generate key pairs in the service worker. Returns two keys:
 *  - `kid` / `publicKey` — encrypted with userId only (no password needed to unlock)
 *  - `kidPw` / `publicKeyPw` — encrypted with password + salt */
export async function generateKeyPair(options: { userId: string; password: string }): Promise<{
    kid: string;
    publicKey: string;
    keyLevel: number;
    kidPw: string;
    publicKeyPw: string;
    keyLevelPw: number;
    algorithm: string;
}> {
    ensureListener();
    return send("generateKeyPair", options) as Promise<{
        kid: string;
        publicKey: string;
        keyLevel: number;
        kidPw: string;
        publicKeyPw: string;
        keyLevelPw: number;
        algorithm: string;
    }>;
}

/** Check whether keys already exist in the SW for this user (device-bound). */
export async function hasKeys(userId: string): Promise<boolean> {
    ensureListener();
    const result = await send<{ has: boolean }>("hasKeys", { userId });
    return result.has;
}

/** Sign data with the key identified by `kid`. Returns base64-encoded DER signature. */
export async function sign(kid: string, data: string): Promise<string> {
    ensureListener();
    const result = await send<{ signature: string }>("sign", { kid, data });
    return result.signature;
}

/** Clear all in-memory private keys from the service worker (e.g. on logout). */
export async function clearKeys(): Promise<void> {
    ensureListener();
    await send("clearKeys");
}
