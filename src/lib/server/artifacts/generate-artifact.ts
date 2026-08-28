import { createHash } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "#lib/server/db/index.js";
import { documents, signatures, userSignatures } from "#lib/server/db/schema.js";
import { supabaseAdmin } from "#lib/server/storage/supabase.js";
import { logger } from "#lib/server/logger.js";
import { flattenPdf, type FlattenRender } from "./flatten-pdf.js";
import type { PlacedRect, FieldValue, FieldKind } from "#lib/client/types/SignatureBoxTypes.d.ts";

export interface ArtifactResult {
    storagePath: string;
    hash: string;
}

/**
 * Generates the flattened signed artifact (O3-B2) for an executed document:
 *
 * 1. Downloads the original (normalized) PDF from the `drafts` bucket.
 * 2. Loads the document's signed/anchored signature rows.
 * 3. Burns each signed field into the PDF at its placement rect:
 *    - `signature` → the signer's saved signature image (per-signer, reused
 *      across every field that signer signed — mirrors the view page).
 *    - `text` / `phone` / `choices` → the submitted value string.
 *    - `checkbox` → a check mark when checked.
 *    - `radio` → a filled dot on the selected radio box.
 * 4. Uploads the result to the `artifacts` bucket and records
 *    `artifactStoragePath` + `artifactHash` on the document.
 */
export async function generateArtifactForDocument(documentId: string): Promise<ArtifactResult> {
    const [doc] = await db
        .select({
            storagePath: documents.storagePath,
            placementFields: documents.placementFields,
        })
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1);
    if (!doc?.storagePath) throw new Error("Document has no storage path");

    const { data: pdfData } = await supabaseAdmin.storage.from("drafts").download(doc.storagePath);
    if (!pdfData) throw new Error("Original PDF not found in storage");

    // Signature rows for this document (signed + anchored).
    const sigRows = await db
        .select({
            signerUserId: signatures.signerUserId,
            signedFields: signatures.signedFields,
            fieldValues: signatures.fieldValues,
        })
        .from(signatures)
        .where(
            and(
                eq(signatures.documentId, documentId),
                inArray(signatures.status, ["signed", "anchored"]),
            ),
        );

    // fieldId → the signature row that signed it.
    const rowForField = new Map<string, (typeof sigRows)[number]>();
    for (const s of sigRows) {
        for (const fieldId of (s.signedFields ?? []) as string[]) {
            if (!rowForField.has(fieldId)) rowForField.set(fieldId, s);
        }
    }

    // Signature image per signer (first non-removed, mirrors the view page).
    const signerIds = [...new Set(sigRows.map((s) => s.signerUserId))];
    const userSigs =
        signerIds.length > 0
            ? await db
                  .select({
                      userId: userSignatures.userId,
                      storagePath: userSignatures.storagePath,
                      mimeType: userSignatures.mimeType,
                  })
                  .from(userSignatures)
                  .where(
                      and(
                          inArray(userSignatures.userId, signerIds),
                          isNull(userSignatures.removedAt),
                      ),
                  )
            : [];
    const imageByUser = new Map<string, { storagePath: string; mimeType: string }>();
    for (const us of userSigs) {
        if (!imageByUser.has(us.userId)) imageByUser.set(us.userId, us);
    }

    // Download signature images, deduped by path.
    const bytesByPath = new Map<string, Uint8Array>();
    async function downloadImage(path: string): Promise<Uint8Array | undefined> {
        const cached = bytesByPath.get(path);
        if (cached) return cached;
        const { data } = await supabaseAdmin.storage.from("signatures").download(path);
        if (!data) return undefined;
        const bytes = new Uint8Array(await data.arrayBuffer());
        bytesByPath.set(path, bytes);
        return bytes;
    }

    const fields = (doc.placementFields ?? []) as PlacedRect[];
    const renders: FlattenRender[] = [];
    for (const f of fields) {
        const row = rowForField.get(f.id);
        if (!row) continue; // unsigned field — nothing to burn

        const base = { page: f.page, x: f.x, y: f.y, width: f.width, height: f.height };

        if (f.kind === "signature") {
            const img = imageByUser.get(row.signerUserId);
            if (!img) continue;
            const bytes = await downloadImage(img.storagePath);
            if (!bytes) continue;
            renders.push({
                ...base,
                kind: "signature",
                imageBytes: bytes,
                imageMime: img.mimeType ?? "image/png",
            });
            continue;
        }

        const entry = (row.fieldValues as Record<string, FieldValue> | null | undefined)?.[f.id];
        if (!entry) continue;

        if (f.kind === "radio") {
            // A radio box is checked iff its own id is the group's selected value.
            if (entry.value === f.id) renders.push({ ...base, kind: "radio", value: true });
            continue;
        }
        if (f.kind === "checkbox") {
            if (entry.value === true) renders.push({ ...base, kind: "checkbox", value: true });
            continue;
        }
        // text / phone / choices
        renders.push({ ...base, kind: f.kind as FieldKind, value: entry.value });
    }

    const flattened = await flattenPdf(new Uint8Array(await pdfData.arrayBuffer()), renders);

    const hashHex = createHash("sha256").update(flattened).digest("hex");
    const artifactPath = `${documentId}-${Date.now()}.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage
        .from("artifacts")
        .upload(artifactPath, flattened, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw uploadError;

    await db
        .update(documents)
        .set({ artifactStoragePath: artifactPath, artifactHash: hashHex })
        .where(eq(documents.id, documentId));

    logger.info("artifact", "Flattened artifact generated", {
        documentId,
        storagePath: artifactPath,
        hash: hashHex.slice(0, 16),
        renderedFields: renders.length,
    });

    return { storagePath: artifactPath, hash: hashHex };
}
