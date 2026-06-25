import { redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import type { PageServerLoad } from "./$types";
import { auth } from "$lib/server/auth";
import { logger } from "$lib/server/logger";

export const load: PageServerLoad = (event) => {
    if (!event.locals.user) {
        logger.debug("demoAuth", "Redirecting unauthenticated user to login");
        return redirect(302, "/demo/better-auth/login");
    }
    logger.debug("demoAuth", "User authenticated", { userId: event.locals.user.id });
    return { user: event.locals.user };
};

export const actions: Actions = {
    signOut: async (event) => {
        const userId = event.locals.user?.id;
        logger.info("demoAuth", "User signing out", { userId });
        try {
            await auth.api.signOut({
                headers: event.request.headers,
            });
            logger.info("demoAuth", "Sign out successful", { userId });
        } catch (err) {
            logger.error("demoAuth", "Sign out failed", err);
        }
        return redirect(302, "/demo/better-auth/login");
    },
};
