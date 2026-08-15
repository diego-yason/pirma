import type { RequestHandler } from "./$types";
import { createChallenge } from "#lib/server/crypto/key-challenge.js";
import { logger } from "#lib/server/logger.js";

export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user) {
        logger.warn("challengeEndpoint", "Challenge requested without session");
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const challenge = createChallenge(locals.user.id);
    logger.info("challengeEndpoint", "Challenge issued", {
        userId: locals.user.id,
        nonce: challenge.nonce,
    });

    return Response.json(challenge);
};
