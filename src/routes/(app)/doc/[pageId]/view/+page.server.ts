import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { db } from "#lib/server/db/index.js";
import {
    packages,
    documents,
    documentAssignments,
    packageRecipients,
    signatures,
    cryptoKeys,
    userSignatures,
    user,
} from "#lib/server/db/schema.js";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { supabaseAdmin } from "#lib/server/storage/supabase.js";
import { getSignedUrl, setSignedUrl } from "#lib/server/storage/url-cache.js";
import { logger } from "#lib/server/logger.js";

export const load: PageServerLoad = async ({ params, locals }) => {
    if (!locals.user) {
        redirect(302, "/login");
    }

    const packageId = params.pageId;

    // Fetch package info
    const [pkg] = await db
        .select({
            id: packages.id,
            name: packages.name,
            owner: packages.owner,
            signingOrderEnabled: packages.signingOrderEnabled,
            expirationDate: packages.expirationDate,
        })
        .from(packages)
        .where(eq(packages.id, packageId));

    if (!pkg) {
        redirect(302, "/doc/list");
    }

    // Only allow access if the user is the owner, a recipient, or a viewer
    const isOwner = pkg.owner === locals.user.id;

    const [recipientRow] = await db
        .select({ id: packageRecipients.id })
        .from(packageRecipients)
        .where(
            and(
                eq(packageRecipients.packageId, packageId),
                eq(packageRecipients.userId, locals.user.id),
            ),
        )
        .limit(1);

    if (!isOwner && !recipientRow) {
        redirect(302, "/doc/list");
    }

    // Fetch documents in this package
    const packageDocs = await db
        .select({
            id: documents.id,
            title: documents.title,
            status: documents.status,
            storagePath: documents.storagePath,
            placementFields: documents.placementFields,
            pageCount: documents.pageCount,
        })
        .from(documents)
        .innerJoin(documentAssignments, eq(documents.id, documentAssignments.documentId))
        .where(eq(documentAssignments.packageId, packageId));

    // Build signed URLs for each document
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
            return {
                id: doc.id,
                title: doc.title,
                url,
                status: doc.status,
                pageCount: doc.pageCount ?? 0,
            };
        }),
    );

    const docIds = packageDocs.map((d) => d.id);

    // Fetch all signatures for these documents, with signer info
    const sigRows =
        docIds.length > 0
            ? await db
                  .select({
                      id: signatures.id,
                      documentId: signatures.documentId,
                      signedFields: signatures.signedFields,
                      status: signatures.status,
                      signedAt: signatures.signedAt,
                      signerUserId: signatures.signerUserId,
                      signerName: user.name,
                  })
                  .from(signatures)
                  .innerJoin(user, eq(signatures.signerUserId, user.id))
                  .where(
                      and(
                          inArray(signatures.documentId, docIds),
                          inArray(signatures.status, ["signed", "anchored"]),
                      ),
                  )
            : [];

    // Fetch signature images for each signer
    const signerIds = [...new Set(sigRows.map((s) => s.signerUserId))];
    const sigImages =
        signerIds.length > 0
            ? await db
                  .select({
                      userId: userSignatures.userId,
                      storagePath: userSignatures.storagePath,
                  })
                  .from(userSignatures)
                  .where(
                      and(
                          inArray(userSignatures.userId, signerIds),
                          isNull(userSignatures.removedAt),
                      ),
                  )
            : [];

    // Generate signed URLs for signature images
    const sigImageUrls = new Map<string, string>();
    for (const img of sigImages) {
        if (!sigImageUrls.has(img.userId)) {
            const { data } = await supabaseAdmin.storage
                .from("signatures")
                .createSignedUrl(img.storagePath, 3600);
            if (data?.signedUrl) {
                sigImageUrls.set(img.userId, data.signedUrl);
            }
        }
    }

    // Fetch recipients for name lookups
    const recipients = await db
        .select({
            id: packageRecipients.id,
            name: packageRecipients.name,
            email: packageRecipients.email,
            role: packageRecipients.role,
            userId: packageRecipients.userId,
        })
        .from(packageRecipients)
        .where(eq(packageRecipients.packageId, packageId));

    // Build lookup: assignedTo value → display name
    const assigneeNames = new Map<string, string>();
    for (const r of recipients) {
        if (r.id) assigneeNames.set(r.id, r.name ?? "—");
        if (r.userId) assigneeNames.set(r.userId, r.name ?? "—");
    }
    // Owner "me" fields — use the owner's name
    if (locals.user) {
        assigneeNames.set("me", locals.user.name ?? "Me");
    }

    // Build field-level status from signatures: fieldId → { status, signerName, signatureImageUrl }
    const fieldStatus = new Map<
        string,
        { status: string; signerName: string | null; signatureImageUrl: string | null }
    >();
    for (const s of sigRows) {
        const fields = s.signedFields as string[];
        for (const fieldId of fields) {
            fieldStatus.set(fieldId, {
                status: s.status,
                signerName: s.signerName,
                signatureImageUrl: sigImageUrls.get(s.signerUserId) ?? null,
            });
        }
    }

    // Collect signed field IDs BEFORE seeding pending fields below
    const signedFieldIds = new Set(fieldStatus.keys());

    // Seed all placement fields so unsigned fields appear as "pending"
    // with the assigned recipient's name
    for (const doc of packageDocs) {
        const fields = (doc.placementFields ?? []) as Array<{ id: string; assignedTo?: string }>;
        for (const f of fields) {
            if (!fieldStatus.has(f.id)) {
                const name = f.assignedTo ? (assigneeNames.get(f.assignedTo) ?? null) : null;
                fieldStatus.set(f.id, {
                    status: "pending",
                    signerName: name,
                    signatureImageUrl: null,
                });
            }
        }
    }

    logger.info("docView", "View page loaded", {
        packageId,
        userId: locals.user.id,
        documentCount: docList.length,
        signedFieldCount: sigRows.length,
        signerCount: signerIds.length,
        signersWithSignatureImage: sigImageUrls.size,
    });

    return {
        pkg: {
            id: pkg.id,
            name: pkg.name,
            signingOrderEnabled: pkg.signingOrderEnabled,
            expirationDate: pkg.expirationDate?.toISOString() ?? null,
        },
        documents: docList.map((d) => {
            const doc = packageDocs.find((pd) => pd.id === d.id);
            const fields = (doc?.placementFields ?? []) as Array<{
                id: string;
                page: number;
                x: number;
                y: number;
                width: number;
                height: number;
                label?: string;
            }>;
            return {
                ...d,
                fields,
                signedStatus: Object.fromEntries(
                    fields.map((f) => [f.id, signedFieldIds.has(f.id)]),
                ),
                fieldSignatureUrls: Object.fromEntries(
                    fields
                        .filter((f) => signedFieldIds.has(f.id))
                        .map((f) => [f.id, fieldStatus.get(f.id)?.signatureImageUrl ?? ""]),
                ),
            };
        }),
        recipients: recipients.map((r) => ({
            id: r.id,
            name: r.name ?? "—",
            email: r.email ?? "—",
            role: r.role as "signer" | "viewer",
        })),
        fieldStatus: Object.fromEntries(fieldStatus),
        isOwner,
    };
};
