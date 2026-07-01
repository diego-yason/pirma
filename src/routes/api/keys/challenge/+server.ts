import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createChallenge } from "$lib/server/key-challenge";
import { logger } from "$lib/server/logger";

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user) {
        logger.warn("challengeEndpoint", "Challenge requested without session");
        return json({ error: "Unauthorized" }, { status: 401 });
    }

    const challenge = createChallenge(locals.user.id);
    logger.info("challengeEndpoint", "Challenge issued", {
        userId: locals.user.id,
        nonce: challenge.nonce,
    });

    return json(challenge);
};
