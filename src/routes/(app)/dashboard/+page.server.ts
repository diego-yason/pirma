import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { eq, desc } from "drizzle-orm";
import {
    documents,
    pendingDocumentsView,
    completedDocumentsView,
    packageViewers,
    packages,
} from "$lib/server/db/schema";

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
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
        })
        .from(documents)
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

    return {
        pendingDocuments: pending,
        completedDocuments: completed,
        recentDocuments: recent,
        viewablePackages: viewable,
    };
};
