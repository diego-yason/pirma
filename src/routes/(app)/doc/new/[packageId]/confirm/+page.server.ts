import type { PageServerLoad, Actions } from "./$types";
import { redirect, fail } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { packageRecipients, documents, documentAssignments, packages } from "$lib/server/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requirePackageOwnership } from "$lib/server/package-guard";

export const load: PageServerLoad = async ({ params, locals }) => {
    if (!locals.user) {
        redirect(302, "/login");
    }

    const pkg = await requirePackageOwnership(params.packageId, locals.user.id);
    if (!pkg) {
        redirect(302, "/doc/new");
    }

    // Fetch package workflow settings
    const [pkgData] = await db
        .select({
            signingOrderEnabled: packages.signingOrderEnabled,
            mfaRequired: packages.mfaRequired,
            expirationDate: packages.expirationDate,
        })
        .from(packages)
        .where(eq(packages.id, params.packageId));

    // Fetch all documents for this package
    const packageDocs = await db
        .select({
            id: documents.id,
            title: documents.title,
            pageCount: documents.pageCount,
            fileSize: documents.fileSize,
            placementFields: documents.placementFields,
        })
        .from(documents)
        .innerJoin(documentAssignments, eq(documents.id, documentAssignments.documentId))
        .where(eq(documentAssignments.packageId, params.packageId));

    // Fetch recipients
    const rows = await db
        .select({
            id: packageRecipients.id,
            name: packageRecipients.name,
            email: packageRecipients.email,
            role: packageRecipients.role,
            signingGroup: packageRecipients.signingGroup,
        })
        .from(packageRecipients)
        .where(eq(packageRecipients.packageId, params.packageId));

    // Build groups from signing groups
    const groupMap = new Map<number, string[]>();
    for (const r of rows) {
        if (r.signingGroup != null) {
            const existing = groupMap.get(r.signingGroup) ?? [];
            existing.push(r.id);
            groupMap.set(r.signingGroup, existing);
        }
    }
    const savedGroups = Array.from(groupMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([groupNum, signerIds]) => ({
            id: crypto.randomUUID(),
            name: `Group ${groupNum}`,
            signerIds,
        }));

    return {
        packageId: params.packageId,
        documents: packageDocs.map((d) => ({
            id: d.id,
            title: d.title,
            pageCount: d.pageCount ?? 0,
            fileSize: d.fileSize ?? 0,
            fieldCount: Array.isArray(d.placementFields) ? d.placementFields.length : 0,
        })),
        recipients: rows.map((r) => ({
            id: r.id,
            name: r.name ?? "—",
            email: r.email ?? "—",
            role: r.role as "signer" | "viewer",
        })),
        signingOrderEnabled: pkgData?.signingOrderEnabled ?? false,
        mfaRequired: pkgData?.mfaRequired ?? false,
        expirationDate: pkgData?.expirationDate ?? "",
        savedGroups,
    };
};

export const actions: Actions = {
    finalize: async ({ request, params, locals }) => {
        if (!locals.user) return fail(401);

        const pkg = await requirePackageOwnership(params.packageId, locals.user.id);
        if (!pkg) return fail(403);

        const formData = await request.formData();

        const signingOrderEnabled = formData.get("signingOrderEnabled") === "true";
        const mfaRequired = formData.get("mfaRequired") === "true";
        const expirationDate = formData.get("expirationDate") as string | null;
        const groupsRaw = formData.get("groups") as string | null;

        // Save workflow settings to packages
        await db
            .update(packages)
            .set({
                signingOrderEnabled,
                mfaRequired,
                expirationDate: expirationDate ? new Date(expirationDate) : null,
                updatedAt: new Date(),
            })
            .where(eq(packages.id, params.packageId));

        // Save signing groups to recipients
        if (signingOrderEnabled && groupsRaw) {
            try {
                const groups: { id: string; signerIds: string[] }[] = JSON.parse(groupsRaw);
                // Clear existing groups
                await db
                    .update(packageRecipients)
                    .set({ signingGroup: null })
                    .where(eq(packageRecipients.packageId, params.packageId));

                // Assign each signer to their group (1-indexed)
                for (let i = 0; i < groups.length; i++) {
                    if (groups[i].signerIds.length > 0) {
                        await db
                            .update(packageRecipients)
                            .set({ signingGroup: i + 1 })
                            .where(
                                inArray(packageRecipients.id, groups[i].signerIds),
                            );
                    }
                }
            } catch {
                return fail(400, { error: "Invalid groups data" });
            }
        } else {
            // Clear groups if signing order is disabled
            await db
                .update(packageRecipients)
                .set({ signingGroup: null })
                .where(eq(packageRecipients.packageId, params.packageId));
        }

        return { success: true };
    },
};
