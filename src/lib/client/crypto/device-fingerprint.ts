/**
 * Lightweight, non-invasive device fingerprint.
 *
 * Hashes ambient browser properties into a stable SHA‑256 hex string.
 * No cookies, no storage, no tracking — the hash cannot be reversed into PII.
 *
 * Also produces a human-readable device label (e.g. "Chrome 132, Windows").
 */

export interface DeviceFingerprint {
    /** Stable hash derived from browser properties */
    hash: string;
    /** Human-readable label for display (e.g. in key management UI) */
    label: string;
}

/** Derive a human-readable device label from the user agent. */
function deriveLabel(ua: string): string {
    // Extract browser name + version
    const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/([\d]+)/);
    const browser = browserMatch ? `${browserMatch[1]} ${browserMatch[2]}` : "Unknown browser";

    // Extract OS
    let os = "Unknown OS";
    if (ua.includes("Windows NT")) os = "Windows";
    else if (ua.includes("Mac OS X")) os = "macOS";
    else if (ua.includes("Linux")) os = "Linux";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

    return `${browser}, ${os}`;
}

/** Compute a SHA‑256 hash of the given string. */
async function sha256(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hash = await crypto.subtle.digest("SHA-256", data);
    const hex = Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return hex;
}

/** Magic delimiter used to join raw fingerprint components before hashing. */
const DELIMITER = "||";

/**
 * Components that form the raw fingerprint string.
 * These are joined with `||` and SHA‑256 hashed.
 *
 * Order: `userAgent || language || hardwareConcurrency || screenWidth || screenHeight || timeZone`
 *
 * Example raw input:
 * ```
 * "Mozilla/5.0 ... Chrome/132.0.0.0||en-US||8||1920||1080||Asia/Manila"
 * ```
 *
 * The hash is deterministic: same browser profile → same hash every time.
 * It cannot be reversed into the original values.
 */

/**
 * Compute a device fingerprint from ambient browser properties.
 * Safe to call on the client side only (requires `navigator` and `crypto.subtle`).
 *
 * Hash formula:
 * ```
 * SHA-256(userAgent + "||" + language + "||" + hardwareConcurrency + "||" + screenWidth + "||" + screenHeight + "||" + timeZone)
 * ```
 */
export async function getDeviceFingerprint(): Promise<DeviceFingerprint> {
    const ua = navigator.userAgent;
    const lang = navigator.language;
    const cores = navigator.hardwareConcurrency;
    const sw = window.screen.width;
    const sh = window.screen.height;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const raw = [ua, lang, cores, sw, sh, tz].join(DELIMITER);
    const hash = await sha256(raw);
    const label = deriveLabel(ua);

    return { hash, label };
}
