import type { PageServerLoad, Actions } from "./$types";
import { redirect, fail } from "@sveltejs/kit";
import { db } from "#lib/server/db/index.js";
import {
    guestTokens,
    packageRecipients,
    documents,
    documentAssignments,
    packages,
    user,
} from "#lib/server/db/schema.js";
import { eq, inArray, and } from "drizzle-orm";
import { requirePackageOwnership } from "#lib/server/package-guard.js";
import { createGuestToken } from "#lib/server/auth/guest-token.js";
import { ORIGIN } from "$app/env/private";
import { logger } from "#lib/server/logger.js";

export const load: PageServerLoad = async ({ params, locals }) => {
    if (!locals.user) {
        logger.debug("confirm", "Not authenticated, redirecting to login");
        redirect(302, "/login");
    }

    const pkg = await requirePackageOwnership(params.packageId, locals.user.id);
    if (!pkg) {
        logger.warn("confirm", "Package not found or not owned", {
            packageId: params.packageId,
            userId: locals.user.id,
        });
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
            userId: packageRecipients.userId,
        })
        .from(packageRecipients)
        .where(eq(packageRecipients.packageId, params.packageId));

    // Check if any document has fields assigned to "me"
    let hasMeField = false;
    for (const doc of packageDocs) {
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

    const recipients = rows.map((r) => ({
        id: r.id,
        name: r.name ?? "—",
        email: r.email ?? "—",
        role: r.role as "signer" | "viewer",
        isMe: false,
    }));

    // If any field is assigned to the current user, ensure "Me" appears as a signer.
    // If the user already has a package_recipients row, mark it; otherwise prepend a synthetic entry.
    if (hasMeField) {
        const meRow = rows.find((r) => r.userId === locals.user.id);
        if (meRow) {
            // Mark the existing row as "me" for the client
            const idx = recipients.findIndex((r) => r.id === meRow.id);
            if (idx !== -1) {
                recipients[idx] = { ...recipients[idx], isMe: true, role: "signer" as const };
            }
        } else {
            recipients.unshift({
                id: "me",
                name: locals.user.name ?? "Me",
                email: locals.user.email ?? "",
                role: "signer" as const,
                isMe: true,
            });
        }
    }

    logger.debug("confirm", "Confirm page data loaded", {
        packageId: params.packageId,
        documentCount: packageDocs.length,
        recipientCount: recipients.length,
    });

    return {
        packageId: params.packageId,
        documents: packageDocs.map((d) => ({
            id: d.id,
            title: d.title,
            pageCount: d.pageCount ?? 0,
            fileSize: d.fileSize ?? 0,
            fieldCount: Array.isArray(d.placementFields) ? d.placementFields.length : 0,
        })),
        recipients,
        signingOrderEnabled: pkgData?.signingOrderEnabled ?? false,
        mfaRequired: pkgData?.mfaRequired ?? false,
        expirationDate: pkgData?.expirationDate ?? "",
        savedGroups,
    };
};

export const actions: Actions = {
    finalize: async ({ request, params, locals }) => {
        if (!locals.user) {
            logger.warn("confirm", "Finalize rejected: not authenticated");
            return fail(401);
        }

        const pkg = await requirePackageOwnership(params.packageId, locals.user.id);
        if (!pkg) {
            logger.warn("confirm", "Finalize rejected: package not owned", {
                packageId: params.packageId,
                userId: locals.user.id,
            });
            return fail(403);
        }

        logger.debug("confirm", "Finalize action started", {
            packageId: params.packageId,
            userId: locals.user.id,
        });

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

                // Ensure "me" (the sender) has a package_recipients row so their
                // signing group can be persisted.
                let meRecipientId: string | null = null;
                const hasMe = groups.some((g) => g.signerIds.includes("me"));
                if (hasMe) {
                    const existing = await db
                        .select({ id: packageRecipients.id })
                        .from(packageRecipients)
                        .where(
                            and(
                                eq(packageRecipients.packageId, params.packageId),
                                eq(packageRecipients.userId, locals.user!.id),
                            ),
                        )
                        .limit(1);

                    if (existing.length > 0) {
                        meRecipientId = existing[0].id;
                    } else {
                        const [inserted] = await db
                            .insert(packageRecipients)
                            .values({
                                packageId: params.packageId,
                                userId: locals.user!.id,
                                name: locals.user!.name,
                                email: locals.user!.email,
                                role: "signer",
                            })
                            .returning({ id: packageRecipients.id });

                        meRecipientId = inserted.id;
                    }
                }

                // Clear existing groups
                await db
                    .update(packageRecipients)
                    .set({ signingGroup: null })
                    .where(eq(packageRecipients.packageId, params.packageId));

                // Assign each signer to their group (1-indexed)
                for (let i = 0; i < groups.length; i++) {
                    const signerIds = groups[i].signerIds
                        .map((sid) => (sid === "me" ? meRecipientId : sid))
                        .filter((sid): sid is string => sid != null);

                    if (signerIds.length > 0) {
                        await db
                            .update(packageRecipients)
                            .set({ signingGroup: i + 1 })
                            .where(inArray(packageRecipients.id, signerIds));
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

        // ── Finalize documents ──────────────────────────────────────
        // Mark all documents in this package as finalized so they are
        // locked for editing and no longer accessible via /doc/new.
        const assignedDocIds = await db
            .select({ documentId: documentAssignments.documentId })
            .from(documentAssignments)
            .where(eq(documentAssignments.packageId, params.packageId));

        if (assignedDocIds.length > 0) {
            await db
                .update(documents)
                .set({ status: "finalized", updatedAt: new Date() })
                .where(
                    inArray(
                        documents.id,
                        assignedDocIds.map((d) => d.documentId),
                    ),
                );
        }

        // ── Guest tokens & notifications ────────────────────────────
        // For recipients whose email doesn't match any registered user,
        // generate a signed guest token and persist it in the DB.
        const signers = await db
            .select({
                id: packageRecipients.id,
                name: packageRecipients.name,
                email: packageRecipients.email,
            })
            .from(packageRecipients)
            .where(
                and(
                    eq(packageRecipients.packageId, params.packageId),
                    eq(packageRecipients.role, "signer"),
                ),
            );

        // Collect known user emails for a single-query lookup
        const knownEmails = new Set(
            (
                await db
                    .select({ email: user.email })
                    .from(user)
                    .where(
                        inArray(
                            user.email,
                            signers.map((s) => s.email).filter((e): e is string => !!e),
                        ),
                    )
            ).map((u) => u.email),
        );

        const signingBase = `${ORIGIN}/doc/${params.packageId}/sign`;

        for (const signer of signers) {
            const isGuest = !signer.email || !knownEmails.has(signer.email);

            if (isGuest) {
                // Generate a signed guest token
                const token = createGuestToken(signer.id, params.packageId);

                // Persist token in the guest_tokens table
                await db.insert(guestTokens).values({
                    recipientId: signer.id,
                    packageId: params.packageId,
                    token,
                    email: signer.email,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                });

                const signingUrl = `${signingBase}?token=${token}`;
                logger.info("confirm", "Guest signing link generated", {
                    recipientId: signer.id,
                    name: signer.name,
                    email: signer.email,
                    signingUrl,
                });
                // TODO: Send email to signer.email with the signingUrl
            } else {
                // Known user — they'll see it on their dashboard
                logger.debug("confirm", "Registered signer notified", {
                    recipientId: signer.id,
                    name: signer.name,
                    email: signer.email,
                });
                // TODO: Send in-app / email notification with link to
                // the signing page (no token needed, they log in normally)
            }
        }

        logger.info("confirm", "Package finalized", {
            packageId: params.packageId,
            documentCount: assignedDocIds.length,
            signingOrderEnabled,
            mfaRequired,
            expirationDate: expirationDate ?? "none",
            guestCount: signers.filter((s) => !s.email || !knownEmails.has(s.email)).length,
        });

        redirect(302, "/dashboard");
    },

    saveSettings: async ({ request, params, locals }) => {
        if (!locals.user) {
            return fail(401);
        }

        const pkg = await requirePackageOwnership(params.packageId, locals.user.id);
        if (!pkg) {
            return fail(403);
        }

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

                let meRecipientId: string | null = null;
                const hasMe = groups.some((g) => g.signerIds.includes("me"));
                if (hasMe) {
                    const existing = await db
                        .select({ id: packageRecipients.id })
                        .from(packageRecipients)
                        .where(
                            and(
                                eq(packageRecipients.packageId, params.packageId),
                                eq(packageRecipients.userId, locals.user.id),
                            ),
                        )
                        .limit(1);
                    if (existing.length > 0) {
                        meRecipientId = existing[0].id;
                    } else {
                        const [inserted] = await db
                            .insert(packageRecipients)
                            .values({
                                packageId: params.packageId,
                                userId: locals.user.id,
                                name: locals.user.name,
                                email: locals.user.email,
                                role: "signer",
                            })
                            .returning({ id: packageRecipients.id });
                        meRecipientId = inserted.id;
                    }
                }

                await db
                    .update(packageRecipients)
                    .set({ signingGroup: null })
                    .where(eq(packageRecipients.packageId, params.packageId));

                for (let i = 0; i < groups.length; i++) {
                    const signerIds = groups[i].signerIds
                        .map((sid) => (sid === "me" ? meRecipientId : sid))
                        .filter((sid): sid is string => sid != null);

                    if (signerIds.length > 0) {
                        await db
                            .update(packageRecipients)
                            .set({ signingGroup: i + 1 })
                            .where(inArray(packageRecipients.id, signerIds));
                    }
                }
            } catch {
                return fail(400, { error: "Invalid groups data" });
            }
        } else {
            await db
                .update(packageRecipients)
                .set({ signingGroup: null })
                .where(eq(packageRecipients.packageId, params.packageId));
        }

        return { success: true };
    },
};
