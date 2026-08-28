import type { PageServerLoad, Actions } from "./$types";
import type { PlacedRect } from "#lib/client/types/SignatureBoxTypes.d.ts";
import { redirect, fail } from "@sveltejs/kit";
import { db } from "#lib/server/db/index.js";
import { packageRecipients, documents, documentAssignments } from "#lib/server/db/schema.js";
import { eq, and } from "drizzle-orm";
import { requirePackageOwnership } from "#lib/server/package-guard.js";
import { logger } from "#lib/server/logger.js";
import { PUBLIC_MAX_RECIPIENTS } from "$app/env/public";

import { supabaseAdmin } from "#lib/server/storage/supabase.js";
import { getSignedUrl, setSignedUrl } from "#lib/server/storage/url-cache.js";
import { createTemplateFromDocument } from "#lib/server/templates.js";

const MAX_RECIPIENTS = Number(PUBLIC_MAX_RECIPIENTS) || 100;

export const load: PageServerLoad = async ({ params, locals }) => {
    if (!locals.user) {
        redirect(302, "/login");
    }

    logger.debug("packageLoad", "Loading package page", {
        packageId: params.packageId,
        userId: locals.user.id,
    });

    try {
        // Verify the package belongs to the current user
        const pkg = await requirePackageOwnership(params.packageId, locals.user.id);
        if (!pkg) {
            redirect(302, "/doc/new");
        }

        // Guard: if any document in this package is already finalized,
        // it can no longer be edited via /doc/new.
        const [finalized] = await db
            .select({ id: documents.id })
            .from(documents)
            .innerJoin(documentAssignments, eq(documents.id, documentAssignments.documentId))
            .where(
                and(
                    eq(documentAssignments.packageId, params.packageId),
                    eq(documents.status, "finalized"),
                ),
            )
            .limit(1);
        if (finalized) {
            redirect(302, "/doc/list");
        }

        // Fetch all documents assigned to this package
        const packageDocs = await db
            .select({
                id: documents.id,
                title: documents.title,
                storagePath: documents.storagePath,
                placementFields: documents.placementFields,
            })
            .from(documents)
            .innerJoin(documentAssignments, eq(documents.id, documentAssignments.documentId))
            .where(eq(documentAssignments.packageId, params.packageId));

        const firstDoc = packageDocs[0];

        // Build document list for the selector (cached)
        const docList = await Promise.all(
            packageDocs.map(async (doc) => {
                let url = "";
                if (doc.storagePath) {
                    const cached = getSignedUrl(doc.storagePath);
                    if (cached) {
                        url = cached;
                    } else {
                        const signed =
                            (
                                await supabaseAdmin.storage
                                    .from("drafts")
                                    .createSignedUrl(doc.storagePath, 3_600_000)
                            ).data?.signedUrl ?? null;
                        if (signed) {
                            setSignedUrl(doc.storagePath, signed);
                            url = signed;
                        }
                    }
                }
                return { id: doc.id, title: doc.title, url };
            }),
        );

        let pdfUrl: string | null = null;
        if (firstDoc?.storagePath) {
            pdfUrl = getSignedUrl(firstDoc.storagePath);
            if (!pdfUrl) {
                pdfUrl =
                    (
                        await supabaseAdmin.storage
                            .from("drafts")
                            .createSignedUrl(firstDoc.storagePath, 3600)
                    ).data?.signedUrl ?? null;
                if (pdfUrl) setSignedUrl(firstDoc.storagePath, pdfUrl);
            }
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

        logger.info("packageLoad", "Package data loaded", {
            packageId: params.packageId,
            documentCount: packageDocs.length,
            recipientCount: recipients.length,
        });

        return {
            packageId: params.packageId,
            recipients,
            documents: docList,
            pdfUrl,
            firstDocTitle: firstDoc?.title ?? null,
            placementFields: packageDocs.map((doc) => doc.placementFields) as PlacedRect[][],
        };
    } catch (err) {
        logger.error("packageLoad", "Failed to load package data", {
            packageId: params.packageId,
            error: err,
        });
        throw err;
    }
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
        // then re-insert using the client-provided UUIDs so that
        // placementFields.assignedTo references remain valid.
        await db.delete(packageRecipients).where(eq(packageRecipients.packageId, params.packageId));

        if (recipients.length > 0) {
            await db.insert(packageRecipients).values(
                recipients.map((r) => {
                    const email = r.email.trim();
                    return {
                        id: r.id, // preserve client-side UUID so placementFields stay in sync
                        packageId: params.packageId,
                        name: r.name.trim() || null,
                        email: email || null, // null avoids unique-constraint conflicts on blanks
                        role: r.role,
                        recipientId: r.personNum,
                    };
                }),
            );
        }

        // Save placement fields to the first document in this package
        const rawFields = formData.get("placementFields");
        if (rawFields && typeof rawFields === "string") {
            try {
                const placementFields = JSON.parse(rawFields);
                const docId = formData.get("documentId")?.toString();

                if (docId) {
                    await db
                        .update(documents)
                        .set({ placementFields })
                        .where(eq(documents.id, docId));

                    logger.info("syncRecipients", "Placement fields updated", {
                        packageId: params.packageId,
                        documentId: docId,
                        boxCount: Array.isArray(placementFields) ? placementFields.length : 0,
                    });
                }
            } catch (err) {
                logger.warn("syncRecipients", "Failed to parse placement fields", err);
            }
        }

        logger.info("syncRecipients", "Sync complete", {
            packageId: params.packageId,
            recipientCount: recipients.length,
        });

        return { success: true };
    },

    saveTemplate: async ({ request, params, locals }) => {
        if (!locals.user) {
            return fail(401, { error: "You must be signed in" });
        }

        // Only the package owner can save a template from this package's docs.
        const pkg = await requirePackageOwnership(params.packageId, locals.user.id);
        if (!pkg) {
            return fail(403, { error: "You do not own this package" });
        }

        const formData = await request.formData();
        const documentId = (formData.get("documentId") as string | null)?.trim();
        const name = (formData.get("name") as string | null)?.trim() || "Untitled template";

        if (!documentId) {
            return fail(400, { error: "Document id is required" });
        }

        try {
            const { templateId } = await createTemplateFromDocument({
                userId: locals.user.id,
                name,
                sourceDocumentId: documentId,
            });
            logger.info("saveTemplate", "Template created from package document", {
                packageId: params.packageId,
                documentId,
                templateId,
            });
            return { success: true, templateId };
        } catch (err) {
            logger.error("saveTemplate", "Failed to save template", err);
            return fail(500, {
                error: err instanceof Error ? err.message : "Failed to save template",
            });
        }
    },
};
