import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { cryptoKeys } from "$lib/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) {
        return json({ error: "Unauthorized" }, { status: 401 });
    }

    let pubkey: string;
    try {
        const body = await request.json();
        pubkey = body.pubkey;
        if (!pubkey || typeof pubkey !== "string") {
            return json({ error: "Missing or invalid pubkey" }, { status: 400 });
        }
    } catch {
        return json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Check if user already has an active key
    const [existing] = await db
        .select({ id: cryptoKeys.id })
        .from(cryptoKeys)
        .where(and(eq(cryptoKeys.userId, locals.user.id), isNull(cryptoKeys.revokedAt)))
        .limit(1);

    if (existing) {
        return json({ id: existing.id, message: "Active key already exists" });
    }

    // Register new public key
    const [inserted] = await db
        .insert(cryptoKeys)
        .values({
            userId: locals.user.id,
            pubkey,
            keyLevel: 1,
        })
        .returning({ id: cryptoKeys.id });

    return json({ id: inserted.id });
};
