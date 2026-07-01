import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { checkKeyRotation } from "$lib/server/crypto/key-rotation";

/**
 * Returns whether the authenticated user's active key needs rotation.
 * Used by the login page to proactively regenerate keys after sign-in.
 */
export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user) {
        return json({ needsRotation: false, reason: null });
    }

    const rotation = await checkKeyRotation(locals.user.id);
    return json({
        needsRotation: rotation !== null,
        reason: rotation?.reason ?? null,
    });
};
