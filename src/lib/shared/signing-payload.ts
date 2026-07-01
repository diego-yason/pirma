/**
 * Build the deterministic signing payload for a signature.
 *
 * Format: "${documentHash}:${totalFields}"
 *
 * Includes the document hash (binds to a specific document version) and the
 * total field count (binds to the exact batch size, preventing fields from
 * being silently added or removed after signing). The field ID is not included
 * since each signature is stored in its own row keyed by txId (the field ID).
 *
 * Both client (sign page) and server (finalize action) use this function so
 * the payload is guaranteed to be identical on both ends.
 *
 * @param documentHash — the document's content hash (from documents.hash)
 * @param totalFields  — total number of fields being finalized in this batch
 */
export function buildSigningPayload(documentHash: string, totalFields: number): string {
    return `${documentHash}:${totalFields}`;
}
