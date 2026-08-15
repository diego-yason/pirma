import type { LayoutServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { db } from "#lib/server/db/index.js";
import { user } from "#lib/server/db/auth.schema.js";
import { packageRecipients, cryptoKeys } from "#lib/server/db/schema.js";
import { eq, and, isNull } from "drizzle-orm";
import { checkKeyRotation } from "#lib/server/crypto/key-rotation.js";

export const load: LayoutServerLoad = async ({ locals, url }) => {
    if (!locals.user && !url.pathname.includes("/sign")) {
        redirect(302, "/login");
    }

    let isAnonymous = false;
    let hasLevel2 = false;
    let keyRotation: { reason: string; check: string } | null = null;
    let recipientName: string | null = null;
    let recipientEmail: string | null = null;

    if (locals.user) {
        const [row] = await db
            .select({ isAnonymous: user.isAnonymous })
            .from(user)
            .where(eq(user.id, locals.user.id))
            .limit(1);
        isAnonymous = row?.isAnonymous ?? false;

        // Check whether the user has an active persistent (level-2) signing key.
        // Level-1 session keys are ephemeral and auto-generated — they never
        // require a password prompt, so only level-2 drives the UI prompt.
        const [keyRow] = await db
            .select({ id: cryptoKeys.id })
            .from(cryptoKeys)
            .where(
                and(
                    eq(cryptoKeys.userId, locals.user.id),
                    eq(cryptoKeys.keyLevel, 2),
                    isNull(cryptoKeys.revokedAt),
                ),
            )
            .limit(1);
        hasLevel2 = !!keyRow;

        // Rotation policy applies to the persistent level-2 key only.
        if (hasLevel2) {
            const rotation = await checkKeyRotation(locals.user.id, 2);
            if (rotation) {
                keyRotation = { reason: rotation.reason!, check: rotation.check! };
            }
        }

        // For anonymous users, fetch the linked recipient's actual name/email
        if (isAnonymous) {
            const [recipient] = await db
                .select({ name: packageRecipients.name, email: packageRecipients.email })
                .from(packageRecipients)
                .where(
                    and(
                        eq(packageRecipients.userId, locals.user.id),
                        eq(packageRecipients.role, "signer"),
                    ),
                )
                .limit(1);
            if (recipient) {
                recipientName = recipient.name;
                recipientEmail = recipient.email;
            }
        }
    }

    return {
        user: {
            id: locals.user?.id,
            name: recipientName ?? locals.user?.name,
            email: recipientEmail ?? locals.user?.email,
        },
        isAnonymous,
        hasLevel2,
        keyRotation,
    };
};
