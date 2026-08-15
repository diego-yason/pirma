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
    userSignatures,
    user,
} from "$lib/server/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { supabaseAdmin } from "$lib/server/storage/supabase";
import { getSignedUrl, setSignedUrl } from "$lib/server/storage/url-cache";
import { verifyGuestToken } from "$lib/server/auth/guest-token";
import { logger } from "$lib/server/logger";
import { verifyEcdsaSignature } from "$lib/server/crypto/verify-signature";
import { buildSigningPayload } from "$lib/shared/signing-payload";
import type { PlacedRect } from "$lib/client/types/SignatureBoxTypes";

export const load: PageServerLoad = async ({ params, locals, url }) => {
    const packageId = params.pageId;

    // ── Guest token flow ────────────────────────────────────────
    const token = url.searchParams.get("token");
    if (token) {
        logger.debug("sign", "Guest token present in URL", { packageId });

        const payload = verifyGuestToken(token);
        if (!payload) {
            logger.warn("sign", "Guest token verification failed — redirecting to login", {
                packageId,
                tokenPreview: token.slice(0, 16) + "…",
                stack: new Error().stack?.split("\n")[2]?.trim(),
            });
            redirect(302, "/login");
        }

        logger.debug("sign", "Guest token verified", {
            packageId,
            recipientId: payload.recipientId,
        });

        // Fetch recipient (including userId to check if already linked)
        const [recipient] = await db
            .select({
                id: packageRecipients.id,
                recipientId: packageRecipients.recipientId,
                name: packageRecipients.name,
                email: packageRecipients.email,
                signingGroup: packageRecipients.signingGroup,
                userId: packageRecipients.userId,
            })
            .from(packageRecipients)
            .where(
                and(
                    eq(packageRecipients.id, payload.recipientId),
                    eq(packageRecipients.packageId, payload.packageId),
                    eq(packageRecipients.role, "signer"),
                ),
            )
            .limit(1);

        if (!recipient) {
            logger.warn("sign", "Recipient from guest token not found in DB", {
                packageId,
                recipientId: payload.recipientId,
                stack: new Error().stack?.split("\n")[2]?.trim(),
            });
            redirect(302, "/login");
        }

        // Check for account conflict: user is logged in with a real account
        // but this token is for a different recipient.
        if (locals.user && recipient.userId !== locals.user.id) {
            // Check if the logged-in user is a real account or anonymous
            const [sessionUser] = await db
                .select({ isAnonymous: user.isAnonymous })
                .from(user)
                .where(eq(user.id, locals.user.id))
                .limit(1);

            const isRealAccount = !sessionUser?.isAnonymous;

            if (isRealAccount) {
                // A real (non-anonymous) account is logged in — they can't
                // sign as this guest. Redirect to logout so they can switch.
                logger.warn("sign", "Real account logged in with guest token — redirecting", {
                    packageId,
                    sessionUserId: locals.user.id,
                    recipientId: payload.recipientId,
                    stack: new Error().stack?.split("\n")[2]?.trim(),
                });
                redirect(302, "/logout");
            }
            // Anonymous session that doesn't match — fall through to guest flow below
        }

        // If already linked to an anonymous user who's currently logged in,
        // fall through to the authenticated flow below
        if (!recipient.userId || locals.user?.id !== recipient.userId) {
            logger.info("sign", "Guest not yet linked — serving guest load", {
                recipientId: recipient.id,
                packageId,
                hasExistingLink: !!recipient.userId,
                currentSessionMatches: locals.user?.id === recipient.userId,
            });
            return handleGuestLoad(packageId, recipient, locals.user?.id);
        }

        logger.info(
            "sign",
            "Guest already linked and authenticated — falling through to user flow",
            {
                recipientId: recipient.id,
                packageId,
                userId: locals.user?.id,
            },
        );
        // Otherwise linked + session matched → continue to authenticated flow
    }

    // ── Authenticated user flow ─────────────────────────────────
    if (!locals.user) {
        logger.warn("sign", "Not authenticated — redirecting to login", {
            packageId,
            stack: new Error().stack?.split("\n")[2]?.trim(),
        });
        redirect(302, "/login");
    }

    logger.debug("sign", "Loading signing page for authenticated user", {
        userId: locals.user.id,
        packageId,
    });

    // ── Fetch package info (needed for owner check) ────────────
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
        logger.warn("sign", "Package not found for authenticated user", {
            packageId,
            stack: new Error().stack?.split("\n")[2]?.trim(),
        });
        redirect(302, "/doc/list");
    }

    // ── Verify user is a signatory of this package ──────────────
    const [signatoryRow] = await db
        .select({
            id: packageRecipients.id,
            recipientId: packageRecipients.recipientId,
            name: packageRecipients.name,
            email: packageRecipients.email,
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

    const isOwner = pkg.owner === locals.user.id;
    let syntheticSignatory:
        | {
              id: string;
              recipientId: number | null;
              name: string | null;
              email: string | null;
              signingGroup: number | null;
          }
        | undefined;

    if (!signatoryRow) {
        if (isOwner) {
            // Owner may not have a packageRecipients row if they only
            // assigned fields to "me". Check for "me" fields.
            const docsWithMeFields = await db
                .select({ placementFields: documents.placementFields })
                .from(documents)
                .innerJoin(documentAssignments, eq(documents.id, documentAssignments.documentId))
                .where(eq(documentAssignments.packageId, packageId));

            const hasMeField = docsWithMeFields.some(
                (d) =>
                    Array.isArray(d.placementFields) &&
                    (d.placementFields as Array<{ assignedTo?: string }>).some(
                        (f) => f.assignedTo === "me",
                    ),
            );

            if (hasMeField) {
                // Create a synthetic signatory entry for the owner
                syntheticSignatory = {
                    id: "me",
                    recipientId: null,
                    name: locals.user.name ?? "Me",
                    email: locals.user.email ?? "",
                    signingGroup: null,
                };
                logger.info("sign", "Owner has 'me' fields — using synthetic signatory", {
                    userId: locals.user.id,
                    packageId,
                });
            } else {
                logger.warn("sign", "Owner is not a signatory and has no 'me' fields", {
                    userId: locals.user.id,
                    packageId,
                    stack: new Error().stack?.split("\n")[2]?.trim(),
                });
                redirect(302, `/doc/${packageId}`);
            }
        } else {
            logger.warn("sign", "User is not a signatory of this package", {
                userId: locals.user.id,
                packageId,
                stack: new Error().stack?.split("\n")[2]?.trim(),
            });
            redirect(302, `/doc/${packageId}`);
        }
    }

    const activeSignatory = signatoryRow ?? syntheticSignatory!;

    logger.debug("sign", "User verified as signatory", {
        userId: locals.user.id,
        packageId,
        recipientId: activeSignatory.id,
        isSynthetic: !!syntheticSignatory,
    });

    // ── Ensure the user has a registered public key ──────────────
    // The private key is generated client-side (Web Crypto, non-extractable)
    // and the public key is sent here for storage.
    // If no active key exists, the client should generate one and register it
    // via a dedicated endpoint before signing.
    const [activeKey] = await db
        .select({ id: cryptoKeys.id })
        .from(cryptoKeys)
        .where(and(eq(cryptoKeys.userId, locals.user.id), isNull(cryptoKeys.revokedAt)))
        .limit(1);

    // TODO: if no active key, redirect or prompt to create one client-side
    void activeKey;

    // Fetch documents
    const packageDocs = await db
        .select({
            id: documents.id,
            title: documents.title,
            storagePath: documents.storagePath,
            placementFields: documents.placementFields,
            pageCount: documents.pageCount,
            hash: documents.hash,
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
                hash: doc.hash,
                pageCount: doc.pageCount ?? 0,
                allFields: ((doc.placementFields ?? []) as PlacedRect[]).map((f) => ({
                    id: f.id,
                    page: f.page,
                    x: f.x,
                    y: f.y,
                    width: f.width,
                    height: f.height,
                    label: f.label,
                })),
                allSignedStatus: {},
            };
        }),
    );

    // Fetch existing signatures by this user for these documents
    const docIds = packageDocs.map((d) => d.id);
    const sigRows =
        docIds.length > 0
            ? await db
                  .select({
                      documentId: signatures.documentId,
                      signedFields: signatures.signedFields,
                      status: signatures.status,
                  })
                  .from(signatures)
                  .where(
                      and(
                          eq(signatures.signerUserId, locals.user.id),
                          inArray(signatures.documentId, docIds),
                      ),
                  )
            : [];

    // Build signature status per field ID from document-level signatures
    const sigStatusByDoc = new Map<string, Map<string, string>>();
    for (const s of sigRows) {
        if (!sigStatusByDoc.has(s.documentId)) {
            sigStatusByDoc.set(s.documentId, new Map());
        }
        const fields = s.signedFields as string[];
        for (const fieldId of fields) {
            sigStatusByDoc.get(s.documentId)!.set(fieldId, s.status);
        }
    }

    // Collect all signature fields assigned to this user
    const userRecipientId = activeSignatory.id;
    const userPersonNum = activeSignatory.recipientId;
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
            if (
                (isOwner && f.assignedTo === "me") ||
                f.assignedTo === userRecipientId ||
                (userPersonNum != null && f.assignedTo === String(userPersonNum))
            ) {
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
        activeSignatory.signingGroup != null &&
        activeSignatory.signingGroup > 1
    ) {
        // TODO: check if all earlier groups have completed signing
        canSign = false;
    }

    // Fetch the user's first saved signature (if any) to use as default
    let defaultSignature: string | null = null;
    const [userSig] = await db
        .select({ storagePath: userSignatures.storagePath })
        .from(userSignatures)
        .where(and(eq(userSignatures.userId, locals.user.id), isNull(userSignatures.removedAt)))
        .limit(1);
    if (userSig) {
        const { data } = await supabaseAdmin.storage
            .from("signatures")
            .createSignedUrl(userSig.storagePath, 3600);
        defaultSignature = data?.signedUrl ?? null;
    }

    // Check if the current user is an anonymous Better Auth account
    const [userRow] = await db
        .select({ isAnonymous: user.isAnonymous })
        .from(user)
        .where(eq(user.id, locals.user.id))
        .limit(1);
    const isAnonymous = userRow?.isAnonymous ?? false;

    logger.info("sign", "Authenticated user page data loaded", {
        userId: locals.user.id,
        packageId,
        documentCount: docList.length,
        fieldCount: userFields.length,
        canSign,
        hasDefaultSignature: !!defaultSignature,
        hasActiveKey: !!activeKey,
        isAnonymous,
    });

    // Fetch ALL signatures across all users for these documents (for greyed-out field display)
    const allSigRows =
        docIds.length > 0
            ? await db
                  .select({
                      signedFields: signatures.signedFields,
                      status: signatures.status,
                  })
                  .from(signatures)
                  .where(
                      and(
                          inArray(signatures.status, ["signed", "anchored"]),
                          inArray(signatures.documentId, docIds),
                      ),
                  )
            : [];
    const allSignedFieldIds = new Set<string>();
    for (const s of allSigRows) {
        const fields = s.signedFields as string[];
        for (const fieldId of fields) {
            allSignedFieldIds.add(fieldId);
        }
    }

    // Build per-document allFields (for greyed-out display of others' fields)
    const docsWithAllFields = docList.map((d) => {
        const doc = packageDocs.find((pd) => pd.id === d.id);
        const fields = (doc?.placementFields ?? []) as PlacedRect[];
        return {
            ...d,
            allFields: fields.map((f) => ({
                id: f.id,
                page: f.page,
                x: f.x,
                y: f.y,
                width: f.width,
                height: f.height,
                label: f.label,
            })),
            allSignedStatus: Object.fromEntries(
                fields.map((f) => [f.id, allSignedFieldIds.has(f.id)]),
            ),
        };
    });

    return {
        pkg: {
            id: pkg.id,
            name: pkg.name,
            signingOrderEnabled: pkg.signingOrderEnabled,
            expirationDate: pkg.expirationDate?.toISOString() ?? null,
        },
        documents: docsWithAllFields,
        userFields,
        canSign,
        defaultSignature,
        isGuest: false as const,
        needsAnonymousSignIn: false as const,
        isAnonymous,
        guestName: isAnonymous ? (activeSignatory.name ?? locals.user.name ?? "Guest") : undefined,
        guestEmail: isAnonymous ? (activeSignatory.email ?? locals.user.email ?? "") : undefined,
    };
};

/**
 * Load handler for guest signers that haven't yet linked an anonymous user.
 * Returns full page data + a flag telling the client to create an anonymous
 * Better Auth session first, then reload to enter the authenticated flow.
 */
async function handleGuestLoad(
    packageId: string,
    recipient: {
        id: string;
        recipientId: number | null;
        name: string | null;
        email: string | null;
        signingGroup: number | null;
    },
    sessionUserId?: string,
) {
    logger.info("sign", "Loading signing page for guest", {
        recipientId: recipient.id,
        packageId,
        guestName: recipient.name,
        guestEmail: recipient.email,
        hasSession: !!sessionUserId,
    });

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
        logger.warn("sign", "Package not found for guest", {
            packageId,
            stack: new Error().stack?.split("\n")[2]?.trim(),
        });
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
            hash: documents.hash,
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
                hash: doc.hash,
                pageCount: doc.pageCount ?? 0,
                allFields: ((doc.placementFields ?? []) as PlacedRect[]).map((f) => ({
                    id: f.id,
                    page: f.page,
                    x: f.x,
                    y: f.y,
                    width: f.width,
                    height: f.height,
                    label: f.label,
                })),
                allSignedStatus: {},
            };
        }),
    );

    // No existing signatures for guests — always start fresh
    const guestRecipientId = recipient.id;
    const guestPersonNum = recipient.recipientId;

    // Collect all signature fields assigned to this guest recipient
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
        for (const f of fields) {
            if (
                f.assignedTo === guestRecipientId ||
                (guestPersonNum != null && f.assignedTo === String(guestPersonNum))
            ) {
                userFields.push({
                    fieldId: f.id,
                    documentId: doc.id,
                    documentTitle: doc.title,
                    page: (f.page ?? 0) + 1,
                    label: f.label,
                    status: "pending",
                    rect: f,
                });
            }
        }
    }

    // Determine if earlier signing groups are complete (sequential signing)
    let canSign = true;
    if (pkg.signingOrderEnabled && recipient.signingGroup != null && recipient.signingGroup > 1) {
        // TODO: check if all earlier groups have completed signing
        canSign = false;
    }

    logger.info("sign", "Guest page data loaded successfully", {
        recipientId: recipient.id,
        packageId,
        documentCount: docList.length,
        fieldCount: userFields.length,
        canSign,
    });

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
        defaultSignature: null,
        isGuest: true as const,
        needsAnonymousSignIn: true as const,
        isAnonymous: true,
        guestName: recipient.name ?? "Guest",
        guestEmail: recipient.email ?? "",
    };
}

/**
 * Helper: resolve the active party — either an authenticated user or a guest
 * from a token passed in the form body.
 */
async function resolveParty(formData: FormData, locals: App.Locals, packageId: string) {
    // Authenticated user
    if (locals.user) {
        logger.debug("sign", "Action resolved as authenticated user", {
            userId: locals.user.id,
            packageId,
        });
        return { type: "user" as const, userId: locals.user.id };
    }

    // Guest with token
    const guestToken = formData.get("guestToken") as string | null;
    if (guestToken) {
        logger.debug("sign", "Attempting guest token resolution", { packageId });

        const payload = verifyGuestToken(guestToken);
        if (!payload) {
            logger.warn("sign", "Guest token in action body is invalid or expired", {
                packageId,
            });
            return null;
        }

        const [recipient] = await db
            .select({ id: packageRecipients.id })
            .from(packageRecipients)
            .where(
                and(
                    eq(packageRecipients.id, payload.recipientId),
                    eq(packageRecipients.packageId, payload.packageId),
                    eq(packageRecipients.role, "signer"),
                ),
            )
            .limit(1);

        if (!recipient) {
            logger.warn("sign", "Guest token valid but recipient not found in DB", {
                packageId,
                recipientId: payload.recipientId,
            });
            return null;
        }

        logger.info("sign", "Action resolved as guest", {
            recipientId: recipient.id,
            packageId,
        });
        return {
            type: "guest" as const,
            recipientId: recipient.id,
            packageId: payload.packageId,
        };
    }

    logger.warn("sign", "Action — no auth party found (no session, no guest token)", { packageId });
    return null;
}

export const actions: Actions = {
    finalize: async ({ request, params, locals }) => {
        const packageId = params.pageId;
        const formData = await request.formData();
        const party = await resolveParty(formData, locals, packageId);
        if (!party) {
            logger.warn("sign", "Finalize rejected — no valid party", { packageId });
            return fail(401);
        }

        const signedFieldsRaw = formData.get("signedFields") as string | null;

        let signedFieldIds: string[] = [];
        if (signedFieldsRaw) {
            try {
                signedFieldIds = JSON.parse(signedFieldsRaw);
            } catch {
                logger.warn("sign", "Finalize — invalid signedFields JSON", {
                    packageId,
                    partyType: party.type,
                });
                return fail(400, { error: "Invalid signed fields data" });
            }
        }

        logger.info("sign", "Finalize action called", {
            packageId,
            partyType: party.type,
            partyId: party.type === "user" ? party.userId : party.recipientId,
            signedFieldCount: signedFieldIds.length,
        });

        if (party.type !== "user") {
            logger.warn("sign", "Finalize — only authenticated users can sign cryptographically", {
                packageId,
                partyType: party.type,
            });
            return fail(400, { error: "Guest finalize not yet supported" });
        }

        // Read crypto signature data from form
        const signaturesRaw = formData.get("signatures") as string | null;
        const kid = formData.get("kid") as string | null;
        const keyLevelRaw = formData.get("keyLevel") as string | null;
        const keyLevel = keyLevelRaw ? Number(keyLevelRaw) : 1;

        if (!signaturesRaw || !kid) {
            logger.warn("sign", "Finalize — missing signatures or kid", { packageId });
            return fail(400, { error: "Missing signature data" });
        }

        let sigMap: Record<string, string>;
        try {
            sigMap = JSON.parse(signaturesRaw);
        } catch {
            return fail(400, { error: "Invalid signatures JSON" });
        }

        // Fetch the signing key identified by `kid` (owned by this user, not revoked)
        const [activeKey] = await db
            .select({
                id: cryptoKeys.id,
                pubkey: cryptoKeys.pubkey,
                keyLevel: cryptoKeys.keyLevel,
            })
            .from(cryptoKeys)
            .where(
                and(
                    eq(cryptoKeys.userId, party.userId),
                    eq(cryptoKeys.kid, kid),
                    isNull(cryptoKeys.revokedAt),
                ),
            )
            .limit(1);

        if (!activeKey) {
            logger.warn("sign", "Finalize — no matching active key found", {
                packageId,
                userId: party.userId,
                keyLevel,
                kid,
                hasSignatures: signedFieldIds.length > 0,
            });
            return fail(400, { error: "Signing key not found or has been revoked" });
        }

        // Enforce the requested key level (level-1 session vs level-2 persistent)
        if (activeKey.keyLevel !== keyLevel) {
            logger.warn("sign", "Finalize — kid/keyLevel mismatch", {
                packageId,
                userId: party.userId,
                kid,
                expected: keyLevel,
                actual: activeKey.keyLevel,
            });
            return fail(400, { error: "Signing key level mismatch" });
        }

        // Fetch documents to get hashes and placement fields
        const packageDocs = await db
            .select({
                id: documents.id,
                hash: documents.hash,
                placementFields: documents.placementFields,
            })
            .from(documents)
            .innerJoin(documentAssignments, eq(documents.id, documentAssignments.documentId))
            .where(eq(documentAssignments.packageId, packageId));

        const docMap = new Map(packageDocs.map((d) => [d.id, d]));
        const allFieldIds = new Set(signedFieldIds);
        const sigFieldDoc = new Map<string, string>(); // fieldId → documentId

        // Build a map of fieldId → documentId from placementFields
        for (const doc of packageDocs) {
            const fields = (doc.placementFields ?? []) as Array<{ id: string }>;
            for (const f of fields) {
                if (allFieldIds.has(f.id)) {
                    sigFieldDoc.set(f.id, doc.id);
                }
            }
        }

        // Group signed fields by document for per-document verification
        const docGroups = new Map<string, { docHash: string; fieldIds: string[] }>();
        for (const fieldId of signedFieldIds) {
            const sigB64 = sigMap[fieldId];
            if (!sigB64) {
                logger.warn("sign", "Finalize — missing signature for field", { fieldId });
                return fail(400, { error: `Missing signature for field ${fieldId}` });
            }

            const docId = sigFieldDoc.get(fieldId);
            if (!docId) {
                logger.warn("sign", "Finalize — field not found in any document", { fieldId });
                return fail(400, { error: `Field ${fieldId} not found in documents` });
            }

            let group = docGroups.get(docId);
            if (!group) {
                const doc = docMap.get(docId)!;
                group = { docHash: doc.hash, fieldIds: [] };
                docGroups.set(docId, group);
            }
            group.fieldIds.push(fieldId);
        }

        // Verify ONE signature per document, then store one row per doc
        const now = new Date();
        const sigInserts: Array<typeof signatures.$inferInsert> = [];

        for (const [docId, group] of docGroups) {
            const doc = docMap.get(docId)!;
            const sigB64 = sigMap[group.fieldIds[0]]!; // all fields share same sig

            const payload = buildSigningPayload(doc.hash, group.fieldIds.length);

            if (!verifyEcdsaSignature(activeKey.pubkey, payload, sigB64)) {
                logger.warn("sign", "Finalize — signature verification failed", {
                    fieldCount: group.fieldIds.length,
                    docHash: doc.hash,
                    pubkey: activeKey.pubkey,
                    signature: sigB64,
                });
                return fail(400, { error: `Signature verification failed for document ${docId}` });
            }

            logger.info("sign", "Finalize — document signature verified", {
                documentId: docId,
                fieldCount: group.fieldIds.length,
            });

            // One row per document — signedFields lists which field IDs were signed
            sigInserts.push({
                documentId: docId,
                signerUserId: party.userId,
                signedFields: group.fieldIds,
                documentHash: doc.hash,
                status: "signed",
                signedAt: now,
                cryptoKey: activeKey.id,
                signaturePayload: sigB64,
                signatureAlgorithm: "ECDSA-P256-SHA256",
            });
        }

        // All signatures verified — upsert one row per document
        if (sigInserts.length > 0) {
            for (const sig of sigInserts) {
                await db
                    .insert(signatures)
                    .values(sig)
                    .onConflictDoUpdate({
                        target: [signatures.documentId, signatures.signerUserId],
                        set: {
                            signedFields: sig.signedFields,
                            status: sig.status,
                            signedAt: sig.signedAt,
                            cryptoKey: sig.cryptoKey,
                            signaturePayload: sig.signaturePayload,
                            signatureAlgorithm: sig.signatureAlgorithm,
                        },
                    });
            }

            // Update lastUsedAt on the key
            await db
                .update(cryptoKeys)
                .set({ lastUsedAt: now })
                .where(eq(cryptoKeys.id, activeKey.id));

            logger.info("sign", "Finalize — signatures stored", {
                packageId,
                userId: party.userId,
                count: sigInserts.length,
            });
        }

        // TODO: check if all signers are done → mark documents as executed

        logger.info("sign", "Finalize completed successfully", {
            packageId,
            userId: party.userId,
            signedFieldCount: sigInserts.length,
        });
        return { success: true };
    },

    reject: async ({ request, params, locals }) => {
        const packageId = params.pageId;
        const formData = await request.formData();
        const party = await resolveParty(formData, locals, packageId);
        if (!party) {
            logger.warn("sign", "Reject rejected — no valid party", { packageId });
            return fail(401);
        }

        const reason = (formData.get("reason") as string)?.trim() || null;

        logger.info("sign", "Reject action called", {
            packageId,
            partyType: party.type,
            partyId: party.type === "user" ? party.userId : party.recipientId,
            hasReason: !!reason,
        });

        // TODO: verify the user is a signatory of this package

        // ── Your logic here ─────────────────────────────────────
        // e.g. mark signatures as rejected, store rejection reason,
        //      notify document owner, optionally cancel the package
        // ─────────────────────────────────────────────────────────

        // TODO: mark signatures as rejected in the database
        // TODO: store reason if provided

        logger.info("sign", "Reject completed successfully", {
            packageId,
            partyType: party.type,
        });
        return { success: true };
    },
};
