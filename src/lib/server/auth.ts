import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { passkey } from "@better-auth/passkey";
import { env } from "$env/dynamic/private";
import { getRequestEvent } from "$app/server";
import { db } from "$lib/server/db";
import { user as userTable } from "$lib/server/db/auth.schema";

export const auth = betterAuth({
    baseURL: env.ORIGIN,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg" }),
    emailAndPassword: { enabled: true },
    plugins: [
        passkey({
            registration: {
                requireSession: false,
                resolveUser: async ({ context }) => {
                    const username = context as string;

                    const existingUser = await db.query.user
                        .findFirst({
                            where: (fields, { eq }) => eq(fields.username, username),
                        })
                        .catch(() => null);

                    if (existingUser) {
                        return existingUser;
                    }

                    const newUser = await db
                        .insert(userTable)
                        .values({
                            username,
                            name: username,
                            email: `${username}@localhost`,
                            emailVerified: false,
                        })
                        .returning()
                        .then((rows) => rows[0]);

                    return newUser;
                },
            },
        }),
        sveltekitCookies(getRequestEvent), // make sure this is the last plugin in the array
    ],
});
