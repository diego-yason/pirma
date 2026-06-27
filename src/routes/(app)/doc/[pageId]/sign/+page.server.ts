import type { PageServerLoad, Actions } from "./$types";
import { redirect, fail } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import {
    packages,
    documents,
    documentAssignments,
    packageRecipients,
    signatures,
    cryptoKeys,
} from "$lib/server/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { supabaseAdmin } from "$lib/server/supabase";
import { getSignedUrl, setSignedUrl } from "$lib/server/url-cache";
import type { PlacedRect } from "$lib/client/SignatureBoxTypes";

export const load: PageServerLoad = async ({ params, locals }) => {
    if (!locals.user) {
        redirect(302, "/login");
    }

    // ── Ensure the user has a registered public key ──────────────
    // The private key is generated client-side (Web Crypto, non-extractable)
    // and the public key is sent here for storage.
    // If no active key exists, the client should generate one and register it
    // via a dedicated endpoint before signing.
    const [activeKey] = await db
        .select({ id: cryptoKeys.id })
        .from(cryptoKeys)
        .where(
            and(
                eq(cryptoKeys.userId, locals.user.id),
                isNull(cryptoKeys.revokedAt),
            ),
        )
        .limit(1);

    // TODO: if no active key, redirect or prompt to create one client-side
    void activeKey;

    const packageId = params.pageId;

    // Verify user is a signatory of this package
    const [signatoryRow] = await db
        .select({
            id: packageRecipients.id,
            signingGroup: packageRecipients.signingGroup,
        })
        .from(packageRecipients)
        .where(
            and(
                eq(packageRecipients.packageId, packageId),
                eq(packageRecipients.userId, locals.user.id),
                eq(packageRecipients.role, "signer"),
            ),
        )
        .limit(1);

    if (!signatoryRow) {
        redirect(302, `/doc/${packageId}`);
    }

    // Fetch package info
    const [pkg] = await db
        .select({
            id: packages.id,
            name: packages.name,
            signingOrderEnabled: packages.signingOrderEnabled,
            expirationDate: packages.expirationDate,
        })
        .from(packages)
        .where(eq(packages.id, packageId));

    if (!pkg) {
        redirect(302, "/doc/list");
    }

    // Fetch documents
    const packageDocs = await db
        .select({
            id: documents.id,
            title: documents.title,
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
            return { id: doc.id, title: doc.title, url, pageCount: doc.pageCount ?? 0 };
        }),
    );

    // Fetch existing signatures by this user for these documents
    const docIds = packageDocs.map((d) => d.id);
    const sigRows =
        docIds.length > 0
            ? await db
                  .select({
                      documentId: signatures.documentId,
                      txId: signatures.txId,
                      status: signatures.status,
                  })
                  .from(signatures)
                  .innerJoin(cryptoKeys, eq(signatures.cryptoKey, cryptoKeys.id))
                  .where(
                      and(
                          eq(cryptoKeys.userId, locals.user.id),
                          isNull(cryptoKeys.revokedAt),
                          inArray(signatures.documentId, docIds),
                      ),
                  )
            : [];

    // Build signature status per field ID (txId = fieldId)
    const sigStatusByDoc = new Map<string, Map<string, string>>();
    for (const s of sigRows) {
        if (!sigStatusByDoc.has(s.documentId)) {
            sigStatusByDoc.set(s.documentId, new Map());
        }
        sigStatusByDoc.get(s.documentId)!.set(s.txId, s.status);
    }

    // Collect all signature fields assigned to this user
    const userRecipientId = signatoryRow.id;
    interface SignatureField {
        fieldId: string;
        documentId: string;
        documentTitle: string;
        page: number;
        label?: string;
        status: string;
        rect: PlacedRect;
    }
    const userFields: SignatureField[] = [];

    for (const doc of packageDocs) {
        const fields = (doc.placementFields ?? []) as PlacedRect[];
        const docSigMap = sigStatusByDoc.get(doc.id);
        for (const f of fields) {
            if (f.assignedTo === "me" || f.assignedTo === userRecipientId) {
                userFields.push({
                    fieldId: f.id,
                    documentId: doc.id,
                    documentTitle: doc.title,
                    page: (f.page ?? 0) + 1,
                    label: f.label,
                    status: docSigMap?.get(f.id) ?? "pending",
                    rect: f,
                });
            }
        }
    }

    // Determine if earlier signing groups are complete (sequential signing)
    let canSign = true;
    if (
        pkg.signingOrderEnabled &&
        signatoryRow.signingGroup != null &&
        signatoryRow.signingGroup > 1
    ) {
        // TODO: check if all earlier groups have completed signing
        canSign = false;
    }

    return {
        pkg: {
            id: pkg.id,
            name: pkg.name,
            signingOrderEnabled: pkg.signingOrderEnabled,
            expirationDate: pkg.expirationDate?.toISOString() ?? null,
        },
        documents: docList,
        userFields,
        canSign,
    };
};

export const actions: Actions = {
    finalize: async ({ request, params, locals }) => {
        if (!locals.user) return fail(401);

        void params.pageId;
        const formData = await request.formData();
        const signedFieldsRaw = formData.get("signedFields") as string | null;

        let signedFieldIds: string[] = [];
        if (signedFieldsRaw) {
            try {
                signedFieldIds = JSON.parse(signedFieldsRaw);
            } catch {
                return fail(400, { error: "Invalid signed fields data" });
            }
        }
        void signedFieldIds;

        // TODO: verify the user is a signatory of this package
        // TODO: verify all signed fields belong to this user
        // TODO: verify all required fields are signed (no unsigned fields left)

        // ── Your logic here ─────────────────────────────────────
        // e.g. create signature records, update document status,
        //      notify next signer in sequence, etc.
        // ─────────────────────────────────────────────────────────

        // TODO: mark signatures as signed in the database
        // for (const fieldId of signedFieldIds) {
        //     await db.insert(signatures).values({ ... });
        // }

        // TODO: check if all signers are done → mark documents as executed

        return { success: true };
    },

    reject: async ({ request, params, locals }) => {
        if (!locals.user) return fail(401);

        void params.pageId;

        const formData = await request.formData();
        const reason = (formData.get("reason") as string)?.trim() || null;
        void reason;

        // TODO: verify the user is a signatory of this package

        // ── Your logic here ─────────────────────────────────────
        // e.g. mark signatures as rejected, store rejection reason,
        //      notify document owner, optionally cancel the package
        // ─────────────────────────────────────────────────────────

        // TODO: mark signatures as rejected in the database
        // TODO: store reason if provided

        return { success: true };
    },
};
