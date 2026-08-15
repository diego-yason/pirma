import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { db } from "#lib/server/db/index.js";
import { eq, desc, inArray, and, count } from "drizzle-orm";
import {
    documents,
    completedDocumentsView,
    packageViewers,
    packages,
    documentAssignments,
    packageRecipients,
    user,
} from "#lib/server/db/schema.js";
import { logger } from "#lib/server/logger.js";

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        logger.debug("dashboard", "Not authenticated, redirecting to login");
        redirect(302, "/login");
    }

    // ── "Waiting for You" ──────────────────────────────────────────
    // Packages where the user is a signer, the package has been sent
    // (documents finalized), and signatures are pending.
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
        .innerJoin(documentAssignments, eq(packages.id, documentAssignments.packageId))
        .innerJoin(documents, eq(documentAssignments.documentId, documents.id))
        .where(
            and(
                eq(packageRecipients.userId, locals.user.id),
                eq(packageRecipients.role, "signer"),
                eq(packages.owner, locals.user.id),
                eq(documents.status, "finalized"),
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

    // ── "My Recent Documents" (grouped by package/envelope) ───────
    const recentPkgs = db
        .select({
            id: packages.id,
            name: packages.name,
            updatedAt: packages.updatedAt,
        })
        .from(packages)
        .where(eq(packages.owner, locals.user.id))
        .orderBy(desc(packages.updatedAt))
        .limit(10);

    // ── "Packages I Can View" ──────────────────────────────────────
    const viewablePkgs = db
        .select({
            id: packages.id,
            name: packages.name,
            owner: packages.owner,
        })
        .from(packages)
        .innerJoin(packageViewers, eq(packages.id, packageViewers.packageId))
        .where(eq(packageViewers.userId, locals.user.id))
        .limit(10);

    const [pending, completed, recentPkgRows, viewable] = await Promise.all([
        pendingPkgs,
        completedDocs,
        recentPkgs,
        viewablePkgs,
    ]);

    // Fetch documents for each recent package
    const recentPkgIds = recentPkgRows.map((p) => p.id);
    const recentDocRows =
        recentPkgIds.length > 0
            ? await db
                  .select({
                      id: documents.id,
                      title: documents.title,
                      status: documents.status,
                      createdAt: documents.createdAt,
                      updatedAt: documents.updatedAt,
                      packageId: documentAssignments.packageId,
                  })
                  .from(documents)
                  .innerJoin(documentAssignments, eq(documents.id, documentAssignments.documentId))
                  .where(inArray(documentAssignments.packageId, recentPkgIds))
                  .orderBy(desc(documents.updatedAt))
            : [];
    const docsByPkg = new Map<string, typeof recentDocRows>();
    for (const doc of recentDocRows) {
        const list = docsByPkg.get(doc.packageId) ?? [];
        list.push(doc);
        docsByPkg.set(doc.packageId, list);
    }
    const recentPackages = recentPkgRows.map((p) => ({
        id: p.id,
        name: p.name,
        documents: docsByPkg.get(p.id) ?? [],
    }));

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
            expirationMap.set(p.id, p.expirationDate?.toISOString().split("T")[0] ?? null);
        }
    }

    logger.debug("dashboard", "Dashboard data loaded", {
        userId: locals.user.id,
        pendingCount: pending.length,
        completedCount: completed.length,
        recentCount: recentPackages.length,
        viewableCount: viewable.length,
    });

    return {
        pendingPackages: pending.map((p) => ({
            id: p.id,
            name: p.name,
            docCount: Number(p.docCount),
        })),
        completedDocuments: completed,
        recentDocuments: recentPackages,
        viewablePackages: viewable,
        expirationDates: expirationMap,
        ownerInfo: ownerMap,
    };
};
