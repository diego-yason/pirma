import type { LayoutServerLoad } from "./$types";
import { logger } from "#lib/server/logger.js";

export const load: LayoutServerLoad = async ({ locals }) => {
    logger.debug("publicLayout", "Serving public page", {
        authenticated: !!locals.user,
        userId: locals.user?.id,
    });

    return {
        user: locals.user ?? null,
    };
};
