import { db } from "#lib/server/db/index.js";
import {
    documents,
    templates,
    packages,
    documentAssignments,
    packageRecipients,
} from "#lib/server/db/schema.js";
import { supabaseAdmin } from "#lib/server/storage/supabase.js";
import { convertToPdf } from "#lib/server/ingest/convert-to-pdf.js";
import { eq, and } from "drizzle-orm";
import { logger } from "#lib/server/logger.js";
import type { PlacedRect } from "#lib/client/types/SignatureBoxTypes.d.ts";

/**
 * Document templates (per-user, v1 clone-only — see `docs/ai/signing/templates-page.md`).
 *
 * A template is backed by a `documents` row with `isTemplate = true` whose PDF lives in
 * the `templates` storage bucket. Instantiating it copies the bytes into the `drafts`
 * bucket and creates a fresh (non-template) document + package, leaving the template
 * untouched.
 */

export const TEMPLATES_BUCKET = "templates";

/** A named signatory placeholder on a template (e.g. "Person 1"). */
export type TemplateSignatory = { id: string; name: string };

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Create a template from a raw uploaded file (PDF/JPG/PNG → normalized PDF).
 */
export async function createTemplateFromUpload(params: {
    userId: string;
    name: string;
    file: File;
}): Promise<{ templateId: string; documentId: string }> {
    const { userId, name, file } = params;
    const buffer = await file.arrayBuffer();
    const { bytes, pageCount } = await convertToPdf(buffer, file.type);
    return createTemplate({
        userId,
        name,
        bytes,
        pageCount,
        placementFields: null,
        signatories: [],
    });
}

/**
 * Create a template from an existing document the user owns (e.g. a just-uploaded
 * draft on `/doc/new`, or a prepared document with placement fields on step 2).
 * The source PDF is copied from the `drafts` bucket into the `templates` bucket.
 */
export async function createTemplateFromDocument(params: {
    userId: string;
    name: string;
    sourceDocumentId: string;
}): Promise<{ templateId: string; documentId: string }> {
    const { userId, name, sourceDocumentId } = params;

    const [src] = await db
        .select({
            storagePath: documents.storagePath,
            pageCount: documents.pageCount,
            fileSize: documents.fileSize,
            hash: documents.hash,
            placementFields: documents.placementFields,
        })
        .from(documents)
        .where(and(eq(documents.id, sourceDocumentId), eq(documents.owner, userId)))
        .limit(1);
    if (!src || !src.storagePath) {
        logger.warn("templates", "Source document not found for template", {
            userId,
            documentId: sourceDocumentId,
        });
        throw new Error("Source document not found");
    }

    const { data, error } = await supabaseAdmin.storage.from("drafts").download(src.storagePath);
    if (error || !data) {
        logger.error("templates", "Failed to download source document", {
            userId,
            documentId: sourceDocumentId,
            error,
        });
        throw new Error("Failed to read the source document");
    }
    const bytes = new Uint8Array(await data.arrayBuffer());

    return createTemplate({
        userId,
        name,
        bytes,
        pageCount: src.pageCount ?? 1,
        placementFields: src.placementFields as PlacedRect[] | null,
        hash: src.hash,
        signatories: [],
    });
}

async function createTemplate(params: {
    userId: string;
    name: string;
    bytes: Uint8Array<ArrayBuffer>;
    pageCount: number;
    placementFields: PlacedRect[] | null;
    hash?: string;
    signatories?: TemplateSignatory[];
}): Promise<{ templateId: string; documentId: string }> {
    const { userId, name, bytes, pageCount, placementFields, hash, signatories = [] } = params;
    const hashHex = hash ?? (await sha256Hex(bytes));
    const filePath = `${crypto.randomUUID()}.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage
        .from(TEMPLATES_BUCKET)
        .upload(filePath, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) {
        logger.error("templates", "Failed to store template PDF", {
            userId,
            path: filePath,
            error: uploadError,
        });
        throw new Error("Failed to store the template");
    }

    const [doc] = await db
        .insert(documents)
        .values({
            title: name,
            owner: userId,
            hash: hashHex,
            status: "draft",
            detailedViewAccess: "restricted",
            isTemplate: true,
            pageCount,
            fileSize: bytes.byteLength,
            storagePath: filePath,
            placementFields,
        })
        .returning();

    const [tmpl] = await db
        .insert(templates)
        .values({ userId, documentId: doc.id, name, signatories })
        .returning();

    logger.info("templates", "Template created", { templateId: tmpl.id, userId, name });
    return { templateId: tmpl.id, documentId: doc.id };
}

/**
 * Clone a template into a brand-new package (PDF + placement fields) and land on
 * step 2 of the create flow. The template file is copied (never moved/mutated).
 */
export async function instantiateTemplate(params: {
    userId: string;
    templateId: string;
}): Promise<{ packageId: string }> {
    const { userId, templateId } = params;

    const [tmpl] = await db
        .select({
            id: templates.id,
            name: templates.name,
            documentId: templates.documentId,
            useCount: templates.useCount,
            signatories: templates.signatories,
        })
        .from(templates)
        .where(and(eq(templates.id, templateId), eq(templates.userId, userId)))
        .limit(1);
    if (!tmpl) {
        logger.warn("templates", "Template not found or not owned", { userId, templateId });
        throw new Error("Template not found");
    }

    const [doc] = await db
        .select({
            title: documents.title,
            storagePath: documents.storagePath,
            pageCount: documents.pageCount,
            fileSize: documents.fileSize,
            hash: documents.hash,
            placementFields: documents.placementFields,
        })
        .from(documents)
        .where(eq(documents.id, tmpl.documentId))
        .limit(1);
    if (!doc || !doc.storagePath) {
        logger.warn("templates", "Template document missing", { templateId, userId });
        throw new Error("Template document is missing");
    }

    const { data, error } = await supabaseAdmin.storage
        .from(TEMPLATES_BUCKET)
        .download(doc.storagePath);
    if (error || !data) {
        logger.error("templates", "Failed to download template PDF", { templateId, error });
        throw new Error("Failed to read the template");
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    const filePath = `${crypto.randomUUID()}.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage
        .from("drafts")
        .upload(filePath, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) {
        logger.error("templates", "Failed to copy template into drafts", {
            templateId,
            path: filePath,
            error: uploadError,
        });
        throw new Error("Failed to create a document from this template");
    }

    const [newDoc] = await db
        .insert(documents)
        .values({
            title: doc.title,
            owner: userId,
            hash: doc.hash,
            status: "draft",
            detailedViewAccess: "restricted",
            isTemplate: false,
            pageCount: doc.pageCount,
            fileSize: doc.fileSize ?? bytes.byteLength,
            storagePath: filePath,
            placementFields: doc.placementFields,
        })
        .returning();

    const [pkg] = await db.insert(packages).values({ name: tmpl.name, owner: userId }).returning();

    await db.insert(documentAssignments).values({ documentId: newDoc.id, packageId: pkg.id });

    // Turn the template's signatory placeholders into default signer recipients,
    // preserving their ids so the cloned placementFields' assignedTo stays valid.
    const signatories = (tmpl.signatories ?? []) as TemplateSignatory[];
    if (signatories.length > 0) {
        await db.insert(packageRecipients).values(
            signatories.map((s, i) => ({
                id: s.id,
                packageId: pkg.id,
                userId: null,
                name: s.name || null,
                email: null,
                role: "signer" as const,
                recipientId: i + 1,
            })),
        );
        logger.info("templates", "Default signers added from template", {
            templateId,
            packageId: pkg.id,
            count: signatories.length,
        });
    }

    await db
        .update(templates)
        .set({ useCount: tmpl.useCount + 1, lastUsedAt: new Date(), updatedAt: new Date() })
        .where(eq(templates.id, templateId));

    logger.info("templates", "Template instantiated", {
        templateId,
        packageId: pkg.id,
        userId,
        useCount: tmpl.useCount + 1,
    });

    return { packageId: pkg.id };
}

/**
 * Delete a template (best-effort storage removal, then the rows).
 */
export async function deleteTemplate(params: {
    userId: string;
    templateId: string;
}): Promise<void> {
    const { userId, templateId } = params;

    const [tmpl] = await db
        .select({ id: templates.id, documentId: templates.documentId })
        .from(templates)
        .where(and(eq(templates.id, templateId), eq(templates.userId, userId)))
        .limit(1);
    if (!tmpl) {
        logger.warn("templates", "Delete rejected: not found or not owned", { userId, templateId });
        throw new Error("Template not found");
    }

    const [doc] = await db
        .select({ storagePath: documents.storagePath })
        .from(documents)
        .where(eq(documents.id, tmpl.documentId))
        .limit(1);

    if (doc?.storagePath) {
        const { error } = await supabaseAdmin.storage
            .from(TEMPLATES_BUCKET)
            .remove([doc.storagePath]);
        if (error) {
            logger.warn("templates", "Storage removal failed (continuing)", { templateId, error });
        }
    }

    await db.delete(templates).where(eq(templates.id, templateId));
    await db.delete(documents).where(eq(documents.id, tmpl.documentId));

    logger.info("templates", "Template deleted", { templateId, userId });
}
