import { fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import type { PageServerLoad } from "./$types";
import { auth } from "#lib/server/auth/index.js";
import { APIError } from "better-auth/api";
import { logger } from "#lib/server/logger.js";

export const load: PageServerLoad = (event) => {
    if (event.locals.user) {
        logger.debug("demoLogin", "Already authenticated, redirecting");
        return redirect(302, "/demo/better-auth");
    }
    return {};
};

export const actions: Actions = {
    signInEmail: async (event) => {
        const formData = await event.request.formData();
        const email = formData.get("email")?.toString() ?? "";
        const password = formData.get("password")?.toString() ?? "";

        logger.debug("demoLogin", "Sign-in attempt", { email });

        try {
            await auth.api.signInEmail({
                body: {
                    email,
                    password,
                    callbackURL: "/auth/verification-success",
                },
            });
            logger.info("demoLogin", "Sign-in successful", { email });
        } catch (error) {
            if (error instanceof APIError) {
                logger.warn("demoLogin", "Sign-in failed", {
                    email,
                    status: error.status,
                    message: error.message,
                });
                return fail(400, { message: error.message || "Signin failed" });
            }
            logger.error("demoLogin", "Sign-in unexpected error", error);
            return fail(500, { message: "Unexpected error" });
        }

        return redirect(302, "/demo/better-auth");
    },
    signUpEmail: async (event) => {
        const formData = await event.request.formData();
        const email = formData.get("email")?.toString() ?? "";
        const password = formData.get("password")?.toString() ?? "";
        const name = formData.get("name")?.toString() ?? "";

        logger.debug("demoLogin", "Sign-up attempt", { email, name });

        try {
            await auth.api.signUpEmail({
                body: {
                    email,
                    password,
                    name,
                    callbackURL: "/auth/verification-success",
                },
            });
            logger.info("demoLogin", "Sign-up successful", { email, name });
        } catch (error) {
            if (error instanceof APIError) {
                logger.warn("demoLogin", "Sign-up failed", {
                    email,
                    status: error.status,
                    message: error.message,
                });
                return fail(400, { message: error.message || "Registration failed" });
            }
            logger.error("demoLogin", "Sign-up unexpected error", error);
            return fail(500, { message: "Unexpected error" });
        }

        return redirect(302, "/demo/better-auth");
    },
};
