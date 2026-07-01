import type { StoredKeyPair } from "./generateKey";

const DB_NAME = "pirma-keys";
const STORE_NAME = "key-pairs";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: "userId" });
                store.createIndex("userId", "userId", { unique: true });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export interface KeyRecord {
    userId: string;
    publicKey: string;
    encryptedPrivateKey: string;
    createdAt: string;
}

/**
 * Store an encrypted key pair in IndexedDB, keyed by user ID.
 */
export async function storeKeys(userId: string, keyPair: StoredKeyPair): Promise<void> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        const record: KeyRecord = {
            userId,
            publicKey: keyPair.publicKey,
            encryptedPrivateKey: keyPair.encryptedPrivateKey,
            createdAt: new Date().toISOString(),
        };

        const request = store.put(record);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);

        transaction.oncomplete = () => db.close();
    });
}

/**
 * Retrieve a stored key record by user ID.
 */
export async function getKeys(userId: string): Promise<KeyRecord | null> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(userId);

        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);

        transaction.oncomplete = () => db.close();
    });
}

/**
 * Delete a stored key record by user ID.
 */
export async function deleteKeys(userId: string): Promise<void> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(userId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);

        transaction.oncomplete = () => db.close();
    });
}
