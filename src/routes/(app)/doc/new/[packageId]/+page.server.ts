import type { PageServerLoad, Actions } from "./$types";
import { redirect, fail } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { packageRecipients } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { requirePackageOwnership } from "$lib/server/package-guard";
import { PUBLIC_MAX_RECIPIENTS } from "$env/static/public";

const MAX_RECIPIENTS = Number(PUBLIC_MAX_RECIPIENTS) || 100;

export const load: PageServerLoad = async ({ params, locals }) => {
    if (!locals.user) {
        redirect(302, "/login");
    }

    // Verify the package belongs to the current user
    const pkg = await requirePackageOwnership(params.packageId, locals.user.id);
    if (!pkg) {
        redirect(302, "/doc/new");
    }

    // Fetch existing recipients
    const rows = await db
        .select({
            id: packageRecipients.id,
            name: packageRecipients.name,
            email: packageRecipients.email,
            role: packageRecipients.role,
            recipientId: packageRecipients.recipientId,
            userId: packageRecipients.userId,
        })
        .from(packageRecipients)
        .where(eq(packageRecipients.packageId, params.packageId));

    const recipients = rows.map((r) => ({
        id: r.id,
        name: r.name ?? "",
        email: r.email ?? "",
        personNum: r.recipientId ?? 0,
        role: r.role as "signer" | "viewer",
    }));

    return {
        packageId: params.packageId,
        recipients,
    };
};

export const actions: Actions = {
    syncRecipients: async ({ request, params, locals }) => {
        if (!locals.user) {
            return fail(401, { error: "Unauthorized" });
        }

        // Verify package ownership
        const pkg = await requirePackageOwnership(params.packageId, locals.user.id);
        if (!pkg) {
            return fail(403, { error: "You do not own this package" });
        }

        const formData = await request.formData();
        const raw = formData.get("recipients");
        if (!raw || typeof raw !== "string") {
            return fail(400, { error: "No recipients data" });
        }

        let recipients: {
            id: string;
            name: string;
            email: string;
            personNum: number;
            role: "signer" | "viewer";
        }[];
        try {
            recipients = JSON.parse(raw);
        } catch {
            return fail(400, { error: "Invalid recipients data" });
        }

        // Validate recipient count
        if (recipients.length > MAX_RECIPIENTS) {
            return fail(400, { error: `Maximum ${MAX_RECIPIENTS} recipients per package` });
        }

        // Delete all existing recipients for this package
        await db.delete(packageRecipients).where(eq(packageRecipients.packageId, params.packageId));

        if (recipients.length > 0) {
            await db.insert(packageRecipients).values(
                recipients.map((r) => {
                    const email = r.email.trim();
                    return {
                        packageId: params.packageId,
                        name: r.name.trim() || null,
                        email: email || null, // null avoids unique-constraint conflicts on blanks
                        role: r.role,
                        recipientId: r.personNum,
                    };
                }),
            );
        }

        return { success: true };
    },
};
