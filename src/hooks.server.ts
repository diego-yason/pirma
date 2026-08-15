import { sequence, type Handle } from "@sveltejs/kit/hooks";
import { building } from "$app/env";
import { auth } from "#lib/server/auth/index.js";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { getTextDirection } from "#lib/paraglide/runtime.js";
import { paraglideMiddleware } from "#lib/paraglide/server.js";
import { logger } from "#lib/server/logger.js";

const handleParaglide: Handle = ({ event, resolve }) =>
    paraglideMiddleware(event.request, ({ request, locale }) => {
        event.request = request;

        return resolve(event, {
            transformPageChunk: ({ html }) =>
                html
                    .replace("%paraglide.lang%", locale)
                    .replace("%paraglide.dir%", getTextDirection(locale)),
        });
    });

const handleBetterAuth: Handle = async ({ event, resolve }) => {
    let session;
    try {
        session = await auth.api.getSession({ headers: event.request.headers });
    } catch (err) {
        logger.error("auth", "Session resolution failed", err);
        return svelteKitHandler({ event, resolve, auth, building });
    }

    if (session) {
        event.locals.session = session.session;
        event.locals.user = session.user;
        logger.debug("auth", "Session resolved", { userId: session.user.id });
    } else {
        logger.debug("auth", "No session");
    }

    return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handleParaglide, handleBetterAuth);
