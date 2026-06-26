import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { eq, desc, inArray, and, count } from "drizzle-orm";
import {
    documents,
    completedDocumentsView,
    packageViewers,
    packages,
    documentAssignments,
    packageRecipients,
    user,
} from "$lib/server/db/schema";
import { logger } from "$lib/server/logger";

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        logger.debug("dashboard", "Not authenticated, redirecting to login");
        redirect(302, "/login");
    }

    // ── "Waiting for You" ──────────────────────────────────────────
    // Packages where the user is a signer and the package is finalized
    // (i.e. waiting for their signature).
    // ─────────────────────────────────────────────────────────────────
    const pendingPkgs = db
        .select({
            id: packages.id,
            name: packages.name,
            owner: packages.owner,
            expirationDate: packages.expirationDate,
            updatedAt: packages.updatedAt,
            docCount: count(documentAssignments.documentId).as("doc_count"),
        })
        .from(packages)
        .innerJoin(packageRecipients, eq(packages.id, packageRecipients.packageId))
        .innerJoin(
            documentAssignments,
            eq(packages.id, documentAssignments.packageId),
        )
        .where(
            and(
                eq(packageRecipients.userId, locals.user.id),
                eq(packageRecipients.role, "signer"),
                eq(packages.owner, locals.user.id),
            ),
        )
        .groupBy(packages.id)
        .orderBy(desc(packages.updatedAt))
        .limit(10);

    // ── "Recently Completed" ───────────────────────────────────────
    // View: completed_documents
    // Indexes: signatures_status_idx, signatures_crypto_key_idx
    // ─────────────────────────────────────────────────────────────────
    const completedDocs = db
        .select({
            id: completedDocumentsView.id,
            title: completedDocumentsView.title,
            status: completedDocumentsView.status,
            updatedAt: completedDocumentsView.updatedAt,
        })
        .from(completedDocumentsView)
        .where(eq(completedDocumentsView.signatoryUserId, locals.user.id))
        .orderBy(desc(completedDocumentsView.updatedAt))
        .limit(5);

    // ── "My Recent Documents" ──────────────────────────────────────
    // Uses documents_owner_idx → WHERE owner = ?
    // ─────────────────────────────────────────────────────────────────
    const recentDocs = db
        .select({
            id: documents.id,
            title: documents.title,
            status: documents.status,
            createdAt: documents.createdAt,
            updatedAt: documents.updatedAt,
            packageId: documentAssignments.packageId,
        })
        .from(documents)
        .leftJoin(documentAssignments, eq(documents.id, documentAssignments.documentId))
        .where(eq(documents.owner, locals.user.id))
        .orderBy(desc(documents.updatedAt))
        .limit(10);

    // ── "Packages I Can View" ──────────────────────────────────────
    // Uses package_viewers_user_id_idx → WHERE user_id = ?
    // ─────────────────────────────────────────────────────────────────
    const viewablePackages = db
        .select({
            id: packages.id,
            name: packages.name,
            owner: packages.owner,
        })
        .from(packages)
        .innerJoin(packageViewers, eq(packages.id, packageViewers.packageId))
        .where(eq(packageViewers.userId, locals.user.id))
        .limit(10);

    const [pending, completed, recent, viewable] = await Promise.all([
        pendingPkgs,
        completedDocs,
        recentDocs,
        viewablePackages,
    ]);

    // Build expiration date map and owner map for pending packages
    const pendingPkgIds = pending.map((p) => p.id);
    const expirationMap = new Map<string, string | null>();
    const ownerMap = new Map<string, { name: string; email: string }>();
    if (pendingPkgIds.length > 0) {
        // Owner info
        const ownerRows = await db
            .select({
                packageId: packages.id,
                name: user.name,
                email: user.email,
            })
            .from(packages)
            .innerJoin(user, eq(packages.owner, user.id))
            .where(inArray(packages.id, pendingPkgIds));
        for (const row of ownerRows) {
            ownerMap.set(row.packageId, { name: row.name, email: row.email });
        }

        // Expiration dates already on the pending rows
        for (const p of pending) {
            expirationMap.set(
                p.id,
                p.expirationDate?.toISOString().split("T")[0] ?? null,
            );
        }
    }

    logger.debug("dashboard", "Dashboard data loaded", {
        userId: locals.user.id,
        pendingCount: pending.length,
        completedCount: completed.length,
        recentCount: recent.length,
        viewableCount: viewable.length,
    });

    return {
        pendingPackages: pending.map((p) => ({
            id: p.id,
            name: p.name,
            docCount: Number(p.docCount),
        })),
        completedDocuments: completed,
        recentDocuments: recent,
        viewablePackages: viewable,
        expirationDates: expirationMap,
        ownerInfo: ownerMap,
    };
};
