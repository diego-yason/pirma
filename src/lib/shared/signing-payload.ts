/**
 * Build the deterministic signing payload for a signature.
 *
 * There is ONE signature per document, NOT per field. All signed fields
 * within the same document share the same payload and the same ECDSA
 * signature. The server verifies the signature once per document and
 * reuses it for every field record in that document.
 *
 * The payload binds the package, document, document hash, the exact (sorted)
 * set of field IDs, and the signer — so a signature cannot be replayed across
 * packages/documents/fields or attributed to a different signer.
 *
 * Format: `${packageId}:${documentId}:${documentHash}:${sortedFieldIds}:${signerUserId}`
 */
export interface SigningPayloadInput {
    packageId: string;
    documentId: string;
    documentHash: string;
    fieldIds: string[];
    signerUserId: string;
}

export function buildSigningPayload(input: SigningPayloadInput): string {
    const fieldIds = [...new Set(input.fieldIds)].sort().join(",");
    return [
        input.packageId,
        input.documentId,
        input.documentHash,
        fieldIds,
        input.signerUserId,
    ].join(":");
}
