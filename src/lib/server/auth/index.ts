import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { passkey } from "@better-auth/passkey";
import { anonymous } from "better-auth/plugins";
import { ORIGIN, BETTER_AUTH_SECRET, OPAQUE_SERVER_KEY } from "$app/env/private";
import { getRequestEvent } from "$app/server";
import { db } from "#lib/server/db/index.js";
import { opaque } from "$plugins/better-auth-opaque/src/server";

export const auth = betterAuth({
    baseURL: ORIGIN,
    secret: BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg" }),
    emailAndPassword: { enabled: true },
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
