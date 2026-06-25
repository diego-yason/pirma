import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { logger } from "$lib/server/logger";

export const load: PageServerLoad = async ({ locals }) => {
    // If user is already logged in, redirect to home
    if (locals.user) {
        logger.debug("register", "Already authenticated, redirecting to home");
        redirect(302, "/");
    }

    logger.debug("register", "Serving registration page");
    return {};
};

export const actions = {};
