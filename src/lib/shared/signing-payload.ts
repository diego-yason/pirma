/**
 * Build the deterministic signing payload for a signature.
 *
 * There is ONE signature per document, NOT per field. All signed fields
 * within the same document share the same payload and the same ECDSA
 * signature. The server verifies the signature once per document and
 * reuses it for every field record in that document.
 *
 * Format: "${documentHash}:${fieldCount}"
 *
 * @param documentHash — the document's content hash (from documents.hash)
 * @param fieldCount   — number of signed fields being finalized in THIS document
 */
export function buildSigningPayload(documentHash: string, fieldCount: number): string {
    return `${documentHash}:${fieldCount}`;
}
