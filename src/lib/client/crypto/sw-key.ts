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

/** Generate key pair(s) in the service worker. Returns:
 *  - `kid` / `publicKey` — level-1 session key (in-memory only, never persisted)
 *  - `kidPw` / `publicKeyPw` — level-2 key, wrapped with password + random salt (null when no password) */
export async function generateKeyPair(options: { userId: string; password: string }): Promise<{
    kid: string;
    publicKey: string;
    keyLevel: number;
    kidPw: string | null;
    publicKeyPw: string | null;
    keyLevelPw: number | null;
    algorithm: string;
}> {
    ensureListener();
    return send("generateKeyPair", options) as Promise<{
        kid: string;
        publicKey: string;
        keyLevel: number;
        kidPw: string | null;
        publicKeyPw: string | null;
        keyLevelPw: number | null;
        algorithm: string;
    }>;
}

/** Check whether a level-1 session key already exists in the SW's memory. */
export async function hasKeys(userId: string): Promise<boolean> {
    ensureListener();
    const result = await send<{ has: boolean }>("hasKeys", { userId });
    return result.has;
}

/** Check whether a persistent (level-2, password-wrapped) key exists in IndexedDB. */
export async function hasPersistentKeys(userId: string): Promise<boolean> {
    ensureListener();
    const result = await send<{ has: boolean }>("hasPersistentKeys", { userId });
    return result.has;
}

/** Sign data with the key identified by `kid`. Returns base64-encoded DER signature.
 *  @param keyLevel — reserved for future key-level-specific signing behavior (level 2+)
 *  @param context — reserved for key-level-specific data (e.g. password digest for level 2)
 */
export async function sign(
    kid: string,
    data: string,
    keyLevel?: number,
    context?: Record<string, unknown>,
): Promise<string> {
    ensureListener();
    const result = await send<{ signature: string }>("sign", { kid, data, keyLevel, context });
    return result.signature;
}

/** Clear all in-memory private keys from the service worker (e.g. on logout). */
export async function clearKeys(): Promise<void> {
    ensureListener();
    await send("clearKeys");
}

/**
 * Load keys into the SW's in-memory keyStore.
 * Level-1 session keys are already in memory (loaded automatically).
 * Level-2 keys are unwrapped from IndexedDB only when a password is provided.
 * Returns the number of keys loaded, skipped, and the list of kid values.
 */
export async function loadKeys(
    userId: string,
    password?: string,
): Promise<{ loaded: number; skipped: number; kids: string[] }> {
    ensureListener();
    const result = await send<{ loaded: number; skipped: number; kids: string[] }>("loadKeys", {
        userId,
        ...(password ? { password } : {}),
    });
    return result;
}
