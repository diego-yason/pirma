import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { db } from "#lib/server/db/index.js";
import {
    packages,
    documents,
    documentAssignments,
    packageRecipients,
    packageViewers,
    signatures,
    cryptoKeys,
} from "#lib/server/db/schema.js";
import { eq, and, isNull, inArray } from "drizzle-orm";

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
            mfaRequired: packages.mfaRequired,
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

    const [viewerRow] = await db
        .select({ id: packageViewers.id })
        .from(packageViewers)
        .where(
            and(
                eq(packageViewers.packageId, packageId),
                eq(packageViewers.userId, locals.user.id),
            ),
        )
        .limit(1);

    if (!isOwner && !recipientRow && !viewerRow) {
        redirect(302, "/doc/list");
    }

    // Fetch documents in this package
    const docs = await db
        .select({
            id: documents.id,
            title: documents.title,
            status: documents.status,
            pageCount: documents.pageCount,
            fileSize: documents.fileSize,
            placementFields: documents.placementFields,
        })
        .from(documents)
        .innerJoin(documentAssignments, eq(documents.id, documentAssignments.documentId))
        .where(eq(documentAssignments.packageId, packageId));

    // Fetch recipients with their signing status per document
    const recipients = await db
        .select({
            id: packageRecipients.id,
            name: packageRecipients.name,
            email: packageRecipients.email,
            role: packageRecipients.role,
            signingGroup: packageRecipients.signingGroup,
            userId: packageRecipients.userId,
        })
        .from(packageRecipients)
        .where(eq(packageRecipients.packageId, packageId))
        .orderBy(packageRecipients.signingGroup);

    // Fetch signatures for all documents in this package
    const sigRows = await db
        .select({
            documentId: signatures.documentId,
            userId: signatures.signerUserId,
            status: signatures.status,
        })
        .from(signatures)
        .where(inArray(signatures.status, ["signed", "anchored"]));

    const docIds = new Set(docs.map((d) => d.id));
    const sigsByDoc = new Map<string, Map<string, string>>();
    for (const s of sigRows) {
        if (!docIds.has(s.documentId)) continue;
        if (!sigsByDoc.has(s.documentId)) sigsByDoc.set(s.documentId, new Map());
        sigsByDoc.get(s.documentId)!.set(s.userId, s.status);
    }

    // Check if any document has fields assigned to "me" (the owner)
    let hasMeField = false;
    for (const doc of docs) {
        if (Array.isArray(doc.placementFields)) {
            if (
                (doc.placementFields as Array<{ assignedTo?: string }>).some(
                    (f) => f.assignedTo === "me",
                )
            ) {
                hasMeField = true;
                break;
            }
        }
    }

    // Ensure the owner appears as a recipient if they have "me" fields
    if (hasMeField && isOwner) {
        const ownerInList = recipients.some((r) => r.userId === locals.user.id);
        if (!ownerInList) {
            recipients.unshift({
                id: "me" as unknown as (typeof recipients)[number]["id"],
                name: locals.user.name ?? "Me",
                email: locals.user.email ?? "",
                role: "signer",
                signingGroup: null,
                userId: locals.user.id,
            });
        }
    }

    // Build recipient status per document
    const recipientStatus = recipients.map((r) => {
        const docStatuses = docs.map((d) => {
            const sigMap = sigsByDoc.get(d.id);
            const sig = sigMap?.get(r.userId ?? "");
            return {
                documentId: d.id,
                documentTitle: d.title,
                signed: sig === "signed" || sig === "anchored",
                status: sig ?? "pending",
            };
        });

        return {
            id: r.id,
            name: r.name ?? "—",
            email: r.email ?? "—",
            role: r.role as "signer" | "viewer",
            signingGroup: r.signingGroup,
            isMe: r.userId === locals.user.id,
            docStatuses,
        };
    });

    return {
        pkg: {
            id: pkg.id,
            name: pkg.name,
            signingOrderEnabled: pkg.signingOrderEnabled,
            mfaRequired: pkg.mfaRequired,
            expirationDate: pkg.expirationDate?.toISOString() ?? null,
        },
        documents: docs.map((d) => ({
            id: d.id,
            title: d.title,
            status: d.status,
            pageCount: d.pageCount ?? 0,
            fileSize: d.fileSize ?? 0,
        })),
        recipients: recipientStatus,
        isOwner,
        isRecipient: !!recipientRow || hasMeField,
    };
};
