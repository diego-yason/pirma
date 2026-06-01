import { z } from "zod";
import { command } from "$app/server";
import { db } from "$lib/server/db";
import { cryptoKeys } from "$lib/server/db/schema";
import { getRequestEvent } from "$app/server";

const uploadKeysInput = z.object({
    pkey: z.string().min(1),
    pubkey: z.string().min(1),
});

export const uploadKeys = command(uploadKeysInput, async ({ pubkey, pkey }) => {
    // TODO: Resolve userId from the authenticated session/request context
    const { locals } = getRequestEvent();

    if (!locals.user) {
        throw new Error("Unauthorized: user must be logged in to upload keys");
    }

    const [record] = await db
        .insert(cryptoKeys)
        .values({
            userId: locals.user.id,
            pkey,
            pubkey,
        })
        .returning();

    return record;
});
