/**
 * Build the deterministic signing payload for a signature.
 *
 * There is ONE signature per document, NOT per field. All signed fields
 * within the same document share the same payload and the same ECDSA
 * signature. The server verifies the signature once per document and
 * reuses it for every field record in that document.
 *
 * The payload binds the package, document, document hash, the exact (sorted)
 * set of field IDs, the signer, and a hash of the document's submitted field
 * values — so a signature cannot be replayed across packages/documents/fields,
 * attributed to a different signer, or have its fillable values altered after
 * signing without detection.
 *
 * Format: `${packageId}:${documentId}:${documentHash}:${sortedFieldIds}:${signerUserId}:${fieldValuesHash}`
 */
export interface SigningPayloadInput {
    packageId: string;
    documentId: string;
    documentHash: string;
    fieldIds: string[];
    signerUserId: string;
    /** hex SHA-256 over `canonicalFieldValues(...)` for this document's submitted values. */
    fieldValuesHash: string;
}

export function buildSigningPayload(input: SigningPayloadInput): string {
    const fieldIds = [...new Set(input.fieldIds)].sort().join(",");
    return [
        input.packageId,
        input.documentId,
        input.documentHash,
        fieldIds,
        input.signerUserId,
        input.fieldValuesHash,
    ].join(":");
}

/**
 * Deterministic canonical serialization of a field-value map for hashing.
 * Entries are sorted by field id and empty strings / undefined are dropped, so
 * client and server always compute the identical hash.
 */
export function canonicalFieldValues(values: Record<string, string | boolean>): string {
    const entries = Object.entries(values)
        .filter(([, v]) => v !== undefined && v !== "")
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return JSON.stringify(entries);
}

/** hex SHA-256 digest of a string (Web Crypto — works in browsers and Node 20+). */
export async function sha256Hex(input: string): Promise<string> {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

