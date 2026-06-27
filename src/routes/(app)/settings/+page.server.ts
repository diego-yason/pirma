import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { userSignatures } from "$lib/server/db/schema";
import { supabaseAdmin } from "$lib/server/supabase";
import { eq, and } from "drizzle-orm";
import { logger } from "$lib/server/logger";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        return { signatures: [] };
    }

    const rows = await db
        .select({
            id: userSignatures.id,
            name: userSignatures.name,
            storagePath: userSignatures.storagePath,
            mimeType: userSignatures.mimeType,
            createdAt: userSignatures.createdAt,
        })
        .from(userSignatures)
        .where(eq(userSignatures.userId, locals.user.id))
        .orderBy(userSignatures.createdAt);

    const signatures = await Promise.all(
        rows.map(async (sig) => {
            const { data } = await supabaseAdmin.storage
                .from("signatures")
                .createSignedUrl(sig.storagePath, 3600);
            return {
                ...sig,
                url: data?.signedUrl ?? null,
            };
        }),
    );

    return { signatures };
};

export const actions: Actions = {
    uploadSignature: async ({ request, locals }) => {
        if (!locals.user) {
            logger.warn("uploadSignature", "Rejected: not authenticated");
            return fail(401, { error: "You must be signed in" });
        }

        const formData = await request.formData();
        const file = formData.get("signature") as File | null;
        const name = (formData.get("name") as string | null)?.trim() || "My Signature";

        if (!file || file.size === 0) {
            return fail(400, { error: "Please select an image file" });
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return fail(400, { error: "Only PNG, JPEG, GIF, or WebP images are allowed" });
        }

        if (file.size > MAX_FILE_SIZE) {
            return fail(400, { error: "File size exceeds the 5 MB limit" });
        }

        try {
            const buffer = await file.arrayBuffer();
            const ext = file.type.split("/")[1] ?? "png";
            const filePath = `signatures/${locals.user.id}/${crypto.randomUUID()}.${ext}`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from("signatures")
                .upload(filePath, buffer, {
                    contentType: file.type,
                    upsert: false,
                });

            if (uploadError) {
                logger.error("uploadSignature", "Storage upload failed", uploadError);
                return fail(500, { error: "Failed to upload signature. Please try again." });
            }

            await db.insert(userSignatures).values({
                userId: locals.user.id,
                name,
                storagePath: filePath,
                mimeType: file.type,
            });

            logger.info("uploadSignature", "Signature saved", {
                path: filePath,
                userId: locals.user.id,
            });

            return { success: true, message: "Signature uploaded successfully" };
        } catch (err) {
            logger.error("uploadSignature", "Upload failed", err);
            return fail(500, { error: "An unexpected error occurred" });
        }
    },

    deleteSignature: async ({ request, locals }) => {
        if (!locals.user) {
            return fail(401, { error: "You must be signed in" });
        }

        const formData = await request.formData();
        const signatureId = formData.get("signatureId") as string | null;

        if (!signatureId) {
            return fail(400, { error: "Signature ID is required" });
        }

        try {
            const [sig] = await db
                .select({ storagePath: userSignatures.storagePath })
                .from(userSignatures)
                .where(
                    and(
                        eq(userSignatures.id, signatureId),
                        eq(userSignatures.userId, locals.user.id),
                    ),
                )
                .limit(1);

            if (sig) {
                await supabaseAdmin.storage.from("signatures").remove([sig.storagePath]);
                await db
                    .delete(userSignatures)
                    .where(
                        and(
                            eq(userSignatures.id, signatureId),
                            eq(userSignatures.userId, locals.user.id),
                        ),
                    );
            }

            return { success: true };
        } catch (err) {
            logger.error("deleteSignature", "Delete failed", err);
            return fail(500, { error: "Failed to delete signature" });
        }
    },
};
