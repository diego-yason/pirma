import { z } from "zod";
import { command } from "$app/server";
import { db } from "$lib/server/db";
import { cryptoKeys } from "$lib/server/db/schema";
import { getRequestEvent } from "$app/server";
import { logger } from "$lib/server/logger";

const uploadKeysInput = z.object({
    pkey: z.string().min(1),
    pubkey: z.string().min(1),
});

export const uploadKeys = command(uploadKeysInput, async ({ pubkey, pkey }) => {
    // TODO: Resolve userId from the authenticated session/request context
    const { locals } = getRequestEvent();

    if (!locals.user) {
        logger.warn("uploadKeys", "Unauthorized attempt — no session");
        throw new Error("Unauthorized: user must be logged in to upload keys");
    }

    logger.debug("uploadKeys", "Storing keys for user", { userId: locals.user.id });

    try {
        const [record] = await db
            .insert(cryptoKeys)
            .values({
                userId: locals.user.id,
                pkey,
                pubkey,
            })
            .returning();

        logger.info("uploadKeys", "Keys stored successfully", {
            userId: locals.user.id,
            keyId: record.id,
        });

        return record;
    } catch (err) {
        logger.error("uploadKeys", "DB insert failed", err);
        throw err;
    }
});
