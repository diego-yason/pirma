import type { Actions, PageServerLoad } from "./$types";
import { redirect, fail } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { documents, packages, documentAssignments } from "$lib/server/db/schema";
import { supabaseAdmin } from "$lib/server/supabase";
import { eq } from "drizzle-orm";

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
        redirect(302, "/login");
    }

    return {};
};

export const actions: Actions = {
    uploadFile: async ({ request, locals }) => {
        if (!locals.user) {
            return fail(401, { error: "You must be signed in to upload documents" });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const title = (formData.get("title") as string | null)?.trim();

        if (!file || file.size === 0) {
            return fail(400, { error: "Please select a file to upload" });
        }

        if (!title) {
            return fail(400, { error: "Document title is required" });
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            return fail(400, { error: "Only PDF files are allowed" });
        }

        if (file.size > MAX_FILE_SIZE) {
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
                console.error("Storage upload error:", uploadError);
                return fail(500, { error: "Failed to upload file. Please try again." });
            }

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
                })
                .returning();

            return {
                documentId: document.id,
            };
        } catch (err) {
            console.error("Upload error:", err);
            return fail(500, {
                error: err instanceof Error ? err.message : "An unexpected error occurred",
            });
        }
    },

    createPackage: async ({ request, locals }) => {
        if (!locals.user) {
            return fail(401, { error: "You must be signed in to create a package" });
        }

        const formData = await request.formData();
        const docIds = formData.getAll("docId") as string[];

        if (docIds.length === 0) {
            return fail(400, { error: "No documents selected" });
        }

        // Verify all documents belong to the current user and are not already assigned
        const userDocs = await db
            .select({ id: documents.id, title: documents.title })
            .from(documents)
            .leftJoin(documentAssignments, eq(documents.id, documentAssignments.documentId))
            .where(eq(documents.owner, locals.user.id));

        const userDocIds = new Set(userDocs.map((d) => d.id));
        const validIds = docIds.filter((id) => userDocIds.has(id));

        if (validIds.length === 0) {
            return fail(400, { error: "None of the selected documents are available" });
        }

        // Generate package name from the first document title
        const firstDoc = userDocs.find((d) => d.id === validIds[0]);
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
            if (validIds.length > 0) {
                await db.insert(documentAssignments).values(
                    validIds.map((docId) => ({
                        documentId: docId,
                        packageId: pkg.id,
                    })),
                );
            }
        } catch (err) {
            console.error("Create package error:", err);
            return fail(500, {
                error: err instanceof Error ? err.message : "Failed to create package",
            });
        }

        redirect(303, `/doc/new/${pkg.id}`);
    },
};
