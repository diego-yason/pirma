import type { Actions, PageServerLoad } from "./$types";
import { redirect, fail } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { documents } from "$lib/server/db/schema";
import { supabaseAdmin } from "$lib/server/supabase";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_TYPES = ["application/pdf"];

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        redirect(302, "/login");
    }

    return {};
};

export const actions: Actions = {
    default: async ({ request, locals }) => {
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
            const filePath = `${locals.user.id}/${crypto.randomUUID()}.pdf`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from("documents")
                .upload(filePath, buffer, {
                    contentType: "application/pdf",
                    upsert: false,
                });

            if (uploadError) {
                console.error("Storage upload error:", uploadError);
                return fail(500, { error: "Failed to upload file. Please try again." });
            }

            // Create document record in database
            const [document] = await db
                .insert(documents)
                .values({
                    title,
                    owner: locals.user.id,
                    hash: hashHex,
                    status: "draft",
                    detailedViewAccess: "restricted",
                })
                .returning();

            // Redirect to the document page
            redirect(302, `/doc/${document.id}`);
        } catch (err) {
            console.error("Upload error:", err);
            return fail(500, {
                error: err instanceof Error ? err.message : "An unexpected error occurred",
            });
        }
    },
};
