import type { PageServerLoad, Actions } from "./$types";
import { redirect, fail } from "@sveltejs/kit";
import { auth } from "#lib/server/auth/index.js";
import { logger } from "#lib/server/logger.js";

/** Map Better Auth errors to vague messages — never reveal which field is wrong. */
function mapAuthError(err: unknown): { formError: string } {
    const message = err instanceof Error ? err.message : "";

    // Rate limiting — still safe to reveal since it doesn't leak user existence
    if (/too many requests/i.test(message) || /rate limit/i.test(message)) {
        return { formError: "Too many attempts. Please try again later." };
    }

    // Log the real error server-side for debugging
    logger.error("login", "Auth API error", message);

    // Never distinguish between "email not found" and "wrong password"
    return { formError: "Invalid email or password." };
}

export const load: PageServerLoad = async ({ locals }) => {
    // If user is already logged in, redirect to home
    if (locals.user) {
        logger.debug("login", "Already authenticated, redirecting to home");
        redirect(302, "/");
    }

    logger.debug("login", "Serving login page");
    return {};
};

export const actions: Actions = {
    default: async ({ request }) => {
        const formData = await request.formData();
        const email = formData.get("email")?.toString().trim() ?? "";
        const password = formData.get("password")?.toString();

        // Field-level validation
        if (!email && !password) {
            return fail(400, {
                emailError: "Email is required",
                passwordError: "Password is required",
                email: "",
            });
        }

        if (!email) {
            return fail(400, { emailError: "Email is required", email: "" });
        }

        if (!password) {
            return fail(400, { passwordError: "Password is required", email });
        }

        logger.debug("login", "Login attempt", { email });

        try {
            await auth.api.signInEmail({
                body: { email, password },
                headers: request.headers,
            });
            logger.info("login", "Login successful", { email });
        } catch (err) {
            const fieldErrors = mapAuthError(err);
            return fail(401, { ...fieldErrors, email });
        }

        redirect(302, "/");
    },
};
