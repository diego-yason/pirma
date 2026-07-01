/**
 * Simple in-memory cache for Supabase signed URLs.
 * Caches URLs for the configured TTL to avoid regenerating them.
 */

const cache = new Map<string, { url: string; expiresAt: number }>();
const TTL = 3_600_000; // 1 hour in ms

export function getSignedUrl(path: string): string | null {
    const entry = cache.get(path);
    if (entry && entry.expiresAt > Date.now()) {
        return entry.url;
    }
    return null;
}

export function setSignedUrl(path: string, url: string): void {
    cache.set(path, { url, expiresAt: Date.now() + TTL });
}
