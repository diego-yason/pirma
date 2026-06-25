import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { eq, desc, inArray } from "drizzle-orm";
import {
    documents,
    pendingDocumentsView,
    completedDocumentsView,
    packageViewers,
    packages,
    documentAssignments,
} from "$lib/server/db/schema";
import { logger } from "$lib/server/logger";

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        logger.debug("dashboard", "Not authenticated, redirecting to login");
        redirect(302, "/login");
    }

    // ── "Waiting for You" ──────────────────────────────────────────
    // View: pending_documents
    // Indexes: package_signatories_user_id_idx, documents PK
    // ─────────────────────────────────────────────────────────────────
    const pendingDocs = db
        .select({
            id: pendingDocumentsView.id,
            title: pendingDocumentsView.title,
            status: pendingDocumentsView.status,
            updatedAt: pendingDocumentsView.updatedAt,
        })
        .from(pendingDocumentsView)
        .where(eq(pendingDocumentsView.signatoryUserId, locals.user.id))
        .orderBy(desc(pendingDocumentsView.updatedAt))
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
        pendingDocs,
        completedDocs,
        recentDocs,
        viewablePackages,
    ]);

    // Fetch package expiration dates for pending documents
    const pendingDocIds = pending.map((d) => d.id);
    const expirationMap = new Map<string, string | null>();
    if (pendingDocIds.length > 0) {
        const expRows = await db
            .select({
                documentId: documentAssignments.documentId,
                expirationDate: packages.expirationDate,
            })
            .from(documentAssignments)
            .innerJoin(packages, eq(documentAssignments.packageId, packages.id))
            .where(inArray(documentAssignments.documentId, pendingDocIds));
        for (const row of expRows) {
            expirationMap.set(
                row.documentId,
                row.expirationDate?.toISOString().split("T")[0] ?? null,
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
        pendingDocuments: pending,
        completedDocuments: completed,
        recentDocuments: recent,
        viewablePackages: viewable,
        expirationDates: expirationMap,
    };
};
