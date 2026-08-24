import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { passkey } from "@better-auth/passkey";
import { anonymous } from "better-auth/plugins";
import { ORIGIN, BETTER_AUTH_SECRET, OPAQUE_SERVER_KEY } from "$app/env/private";
import { getRequestEvent } from "$app/server";
import { db } from "#lib/server/db/index.js";
import { opaque } from "better-auth-opaque/server";
import { sendEmail } from "#lib/server/email/index.js";
import { renderPasswordReset, passwordResetSubject } from "#lib/server/email/templates/index.js";

export const auth = betterAuth({
    baseURL: ORIGIN,
    secret: BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg" }),
    emailAndPassword: {
        enabled: true,
        sendResetPassword: async ({ user, url, token }) => {
            await sendEmail({
                eventId: `password-reset:${user.id}:${token}`,
                template: "password-reset",
                to: user.email,
                subject: passwordResetSubject(),
                html: renderPasswordReset({ name: user.name, resetUrl: url }),
            });
        },
    },
    plugins: [
        passkey(),
        anonymous(),
        opaque({ OPAQUE_SERVER_KEY }),
        sveltekitCookies(getRequestEvent), // make sure this is the last plugin in the array
    ],
    user: {
        deleteUser: {
            enabled: true,
        },
    },
});
