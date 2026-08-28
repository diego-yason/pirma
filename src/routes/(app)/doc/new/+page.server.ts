import type { Actions, PageServerLoad } from "./$types";
import { redirect, fail } from "@sveltejs/kit";
import { db } from "#lib/server/db/index.js";
import { documents, packages, documentAssignments } from "#lib/server/db/schema.js";
import { supabaseAdmin } from "#lib/server/storage/supabase.js";
import { and, eq } from "drizzle-orm";
import { logger } from "#lib/server/logger.js";
import { convertToPdf, DOCX_MIME, type ConvertedPdf } from "#lib/server/ingest/convert-to-pdf.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
// Types we can normalize to a PDF at ingest (PDF kept as-is, JPG/PNG converted).
// DOCX is accepted only to give a tailored "not yet supported" message.
const CONVERTIBLE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        logger.debug("docNew", "Not authenticated, redirecting to login");
        redirect(302, "/login");
    }

    logger.debug("docNew", "Serving document upload page");
    return {};
};

export const actions: Actions = {
    uploadFile: async ({ request, locals }) => {
        if (!locals.user) {
            logger.warn("uploadFile", "Rejected: not authenticated");
            return fail(401, { error: "You must be signed in to upload documents" });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const title = (formData.get("title") as string | null)?.trim();

        if (!file || file.size === 0) {
            logger.warn("uploadFile", "Rejected: no file or empty file");
            return fail(400, { error: "Please select a file to upload" });
        }

        if (!title) {
            logger.warn("uploadFile", "Rejected: missing title");
            return fail(400, { error: "Document title is required" });
        }
        if (![...CONVERTIBLE_TYPES, DOCX_MIME].includes(file.type)) {
            logger.warn("uploadFile", "Rejected: disallowed type", { type: file.type });
            return fail(400, { error: "Only PDF, JPG, or PNG files are allowed" });
        }
        if (file.type === DOCX_MIME) {
            logger.warn("uploadFile", "Rejected: DOCX conversion not yet supported", {
                type: file.type,
            });
            return fail(400, {
                error: "DOCX conversion isn't supported yet — please upload a PDF, JPG, or PNG.",
            });
        }

        if (file.size > MAX_FILE_SIZE) {
            logger.warn("uploadFile", "Rejected: file too large", { size: file.size });
            return fail(400, { error: "File size exceeds the 50 MB limit" });
        }

        try {
            // Normalize to PDF at ingest (JPG/PNG → single-page PDF; PDF kept as-is).
            const buffer = await file.arrayBuffer();
            // bytes are guaranteed ArrayBuffer-backed (see convertToPdf) so Web
            // Crypto's BufferSource accepts them without a defensive copy.
            const { bytes, pageCount }: ConvertedPdf = await convertToPdf(buffer, file.type);

            // Compute SHA-256 over the CONVERTED PDF — the bytes actually stored.
            const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

            // Upload the normalized PDF to Supabase Storage.
            const filePath = `${crypto.randomUUID()}.pdf`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from("drafts")
                .upload(filePath, bytes, {
                    contentType: "application/pdf",
                    upsert: false,
                });

            if (uploadError) {
                logger.error("uploadFile", "Storage upload failed", uploadError);
                return fail(500, { error: "Failed to upload file. Please try again." });
            }

            logger.info("uploadFile", "File stored as PDF", {
                path: filePath,
                size: bytes.byteLength,
                type: file.type,
                converted: file.type !== "application/pdf",
                pageCount,
            });

            // Create document record in database (pageCount is server-computed).
            const [document] = await db
                .insert(documents)
                .values({
                    title,
                    owner: locals.user.id,
                    hash: hashHex,
                    status: "draft",
                    detailedViewAccess: "restricted",
                    pageCount,
                    fileSize: bytes.byteLength,
                    storagePath: filePath,
                })
                .returning();

            logger.info("uploadFile", "Document record created", {
                documentId: document.id,
                title,
                hash: hashHex.slice(0, 16) + "…",
            });

            return {
                documentId: document.id,
                storagePath: filePath,
                pageCount,
            };
        } catch (err) {
            logger.error("uploadFile", "Unexpected error", err);
            return fail(500, {
                error: err instanceof Error ? err.message : "An unexpected error occurred",
            });
        }
    },

    saveTemplate: async ({ request, locals }) => {
        if (!locals.user) {
            logger.warn("saveTemplate", "Rejected: not authenticated");
            return fail(401, { error: "You must be signed in" });
        }

        const formData = await request.formData();
        const docId = (formData.get("docId") as string | null)?.trim();
        const name = (formData.get("name") as string | null)?.trim() || "Untitled template";

        if (!docId) {
            logger.warn("saveTemplate", "Rejected: missing docId");
            return fail(400, { error: "Document id is required" });
        }

        try {
            const { templateId } = await createTemplateFromDocument({
                userId: locals.user.id,
                name,
                sourceDocumentId: docId,
            });
            logger.info("saveTemplate", "Template created from uploaded document", {
                documentId: docId,
                templateId,
            });
            return { success: true, templateId };
        } catch (err) {
            logger.error("saveTemplate", "Failed to save template", err);
            return fail(500, {
                error: err instanceof Error ? err.message : "Failed to save template",
            });
        }
    },

    removeFile: async ({ request, locals }) => {
        if (!locals.user) {
            logger.warn("removeFile", "Rejected: not authenticated");
            return fail(401, { error: "You must be signed in to remove documents" });
        }

        const formData = await request.formData();
        const docId = (formData.get("docId") as string | null)?.trim();

        if (!docId) {
            logger.warn("removeFile", "Rejected: missing docId");
            return fail(400, { error: "Document id is required" });
        }

        // Load the document and verify ownership
        const [doc] = await db
            .select({
                id: documents.id,
                title: documents.title,
                storagePath: documents.storagePath,
            })
            .from(documents)
            .where(and(eq(documents.id, docId), eq(documents.owner, locals.user.id)))
            .limit(1);

        if (!doc) {
            logger.warn("removeFile", "Rejected: document not found or not owned", { docId });
            return fail(404, { error: "Document not found" });
        }

        // Only "unused" documents (not yet assigned to a package) can be removed here.
        const [assignment] = await db
            .select({ id: documentAssignments.id })
            .from(documentAssignments)
            .where(eq(documentAssignments.documentId, docId))
            .limit(1);

        if (assignment) {
            logger.warn("removeFile", "Rejected: document already in a package", { docId });
            return fail(400, {
                error: "Document is already part of a package and cannot be removed here",
            });
        }

        // Best-effort storage cleanup — never block DB removal on storage errors.
        if (doc.storagePath) {
            const { error: removeError } = await supabaseAdmin.storage
                .from("drafts")
                .remove([doc.storagePath]);
            if (removeError) {
                logger.warn("removeFile", "Storage removal failed (continuing)", {
                    docId,
                    path: doc.storagePath,
                    error: removeError,
                });
            }
        }

        // Delete the DB row so it no longer lingers as an unused orphan.
        await db.delete(documents).where(eq(documents.id, docId));

        logger.info("removeFile", "Document removed", {
            documentId: docId,
            title: doc.title,
        });

        return { ok: true, documentId: docId };
    },

    createPackage: async ({ request, locals }) => {
        if (!locals.user) {
            logger.warn("createPackage", "Rejected: not authenticated");
            return fail(401, { error: "You must be signed in to create a package" });
        }

        const formData = await request.formData();
        const docIds = formData.getAll("docId") as string[];

        if (docIds.length === 0) {
            logger.warn("createPackage", "Rejected: no docIds in form data");
            return fail(400, { error: "No documents selected" });
        }

        const isUsers = await Promise.all(
            docIds.map(
                async (id) =>
                    await db
                        .select()
                        .from(documents)
                        .where(and(eq(documents.id, id), eq(documents.owner, locals.user.id)))
                        .limit(1),
            ),
        );

        logger.debug("createPackage", "Ownership check results", { isUsers });

        if (isUsers.some((res) => res.length === 0)) {
            logger.warn("createPackage", "Rejected: some documents not owned by user", {
                submitted: docIds,
            });
            return fail(403, { error: "You do not own one or more of the selected documents" });
        }

        // Verify documents are not already assigned
        const isAssigned = await Promise.all(
            docIds.map(
                async (id) =>
                    await db
                        .select()
                        .from(documentAssignments)
                        .where(eq(documentAssignments.documentId, id))
                        .limit(1),
            ),
        );

        if (isAssigned.some((res) => res.length > 0)) {
            logger.warn("createPackage", "Rejected: some documents are already assigned", {
                submitted: docIds,
            });
            return fail(400, {
                error: "One or more selected documents are already assigned to a package",
            });
        }

        const [userDocs] = await Promise.all(
            docIds.map(
                async (id) =>
                    await db.select().from(documents).where(eq(documents.id, id)).limit(1),
            ),
        );

        // Generate package name from the first document title
        const firstDoc = userDocs.find((d) => d.id === docIds[0]);
        const packageName = firstDoc?.title ?? "Untitled Package";

        let pkg: { id: string };

        try {
            // Create the package
            const [created] = await db
                .insert(packages)
                .values({
                    name: packageName,
                    owner: locals.user.id,
                })
                .returning();
            pkg = created;

            // Assign documents to the package
            if (userDocs.length > 0) {
                await db.insert(documentAssignments).values(
                    docIds.map((docId) => ({
                        documentId: docId,
                        packageId: pkg.id,
                    })),
                );
            }

            logger.info("createPackage", "Package created with documents", {
                packageId: pkg.id,
                name: packageName,
                documentCount: userDocs.length,
            });
        } catch (err) {
            logger.error("createPackage", "Unexpected error", err);
            return fail(500, {
                error: err instanceof Error ? err.message : "Failed to create package",
            });
        }

        redirect(303, `/doc/new/${pkg.id}`);
    },
};
