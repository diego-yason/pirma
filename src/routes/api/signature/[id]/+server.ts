import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { userSignatures } from "$lib/server/db/schema";
import { supabaseAdmin } from "$lib/server/storage/supabase";
import { eq, and, isNull } from "drizzle-orm";

export const GET: RequestHandler = async ({ params }) => {
    const [sig] = await db
        .select({
            storagePath: userSignatures.storagePath,
            mimeType: userSignatures.mimeType,
        })
        .from(userSignatures)
        .where(
            and(
                eq(userSignatures.id, params.id),
                isNull(userSignatures.removedAt),
            ),
        )
        .limit(1);

    if (!sig) {
        error(404, "Signature not found");
    }

    const { data } = await supabaseAdmin.storage
        .from("signatures")
        .download(sig.storagePath);

    if (!data) {
        error(404, "Signature file not found");
    }

    return new Response(data, {
        headers: {
            "Content-Type": sig.mimeType,
            "Cache-Control": "public, max-age=3600",
        },
    });
};
