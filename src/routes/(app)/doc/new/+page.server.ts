import type { Actions, PageServerLoad } from "./$types";
import { redirect, fail } from "@sveltejs/kit";
import { db } from "#lib/server/db/index.js";
import { documents, packages, documentAssignments } from "#lib/server/db/schema.js";
import { supabaseAdmin } from "#lib/server/storage/supabase.js";
import { and, eq } from "drizzle-orm";
import { logger } from "#lib/server/logger.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
];

const MIME_TO_EXT: Record<string, string> = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "image/jpeg": "jpg",
    "image/png": "png",
};

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
        if (!ALLOWED_TYPES.includes(file.type)) {
            logger.warn("uploadFile", "Rejected: disallowed type", { type: file.type });
            return fail(400, { error: "Only PDF files are allowed" });
        }

        if (file.size > MAX_FILE_SIZE) {
            logger.warn("uploadFile", "Rejected: file too large", { size: file.size });
            return fail(400, { error: "File size exceeds the 50 MB limit" });
        }

        try {
            // Compute SHA-256 hash of the file
            const buffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

            // Upload to Supabase Storage
            const ext = MIME_TO_EXT[file.type] ?? "bin";
            const filePath = `${crypto.randomUUID()}.${ext}`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from("drafts")
                .upload(filePath, buffer, {
                    contentType: file.type,
                    upsert: false,
                });

            if (uploadError) {
                logger.error("uploadFile", "Storage upload failed", uploadError);
                return fail(500, { error: "Failed to upload file. Please try again." });
            }

            logger.info("uploadFile", "File uploaded to storage", {
                path: filePath,
                size: file.size,
                type: file.type,
            });

            // Parse optional metadata from the client
            const pageCountRaw = formData.get("pageCount");
            const pageCount = pageCountRaw != null ? Number(pageCountRaw) || undefined : undefined;

            // Create document record in database
            const [document] = await db
                .insert(documents)
                .values({
                    title,
                    owner: locals.user.id,
                    hash: hashHex,
                    status: "draft",
                    detailedViewAccess: "restricted",
                    pageCount,
                    fileSize: file.size,
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
            };
        } catch (err) {
            logger.error("uploadFile", "Unexpected error", err);
            return fail(500, {
                error: err instanceof Error ? err.message : "An unexpected error occurred",
            });
        }
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
