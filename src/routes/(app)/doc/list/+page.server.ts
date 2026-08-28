import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { db } from "#lib/server/db/index.js";
import {
    documents,
    documentAssignments,
    packageRecipients,
    packageViewers,
    packages,
    pendingDocumentsView,
    signatures,
} from "#lib/server/db/schema.js";
import {
    aliasedTable,
    and,
    count,
    desc,
    eq,
    exists,
    ilike,
    inArray,
    isNotNull,
    isNull,
    ne,
    not,
    or,
    type SQL,
} from "drizzle-orm";
import { logger } from "#lib/server/logger.js";

const PAGE_SIZE = 10;
const DRAFTS_SECTION_LIMIT = 5;

const SEGMENTS = ["all", "sent", "shared", "waiting", "drafts"] as const;
type Segment = (typeof SEGMENTS)[number];
const STATUSES = ["all", "draft", "finalized", "executed"] as const;
type Status = (typeof STATUSES)[number];

function isSegment(value: unknown): value is Segment {
    return typeof value === "string" && (SEGMENTS as readonly string[]).includes(value);
}
function isStatus(value: unknown): value is Status {
    return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

interface EnvelopeDoc {
    id: string;
    title: string;
    status: string;
    updatedAt: string;
}

interface EnvelopeItem {
    id: string;
    name: string;
    owner: string;
    expirationDate: string | null;
    updatedAt: string;
    documents: EnvelopeDoc[];
    signedCount: number;
    totalSignatures: number;
    needsMe: boolean;
}

interface DraftItem {
    id: string;
    title: string;
    status: string;
    pageCount: number;
    fileSize: number;
    updatedAt: string;
}

export const load: PageServerLoad = async ({ locals, url }) => {
    if (!locals.user) {
        logger.warn("docListPage", "Unauthenticated load attempt");
        redirect(302, "/login");
    }
    const me = locals.user.id;

    const segmentRaw = url.searchParams.get("segment");
    const segment: Segment = isSegment(segmentRaw) ? segmentRaw : "all";
    const statusRaw = url.searchParams.get("status");
    const status: Status = isStatus(statusRaw) ? statusRaw : "all";
    const q = (url.searchParams.get("q") ?? "").trim();
    const pageParam = Number(url.searchParams.get("page"));
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
    const offset = (page - 1) * PAGE_SIZE;

    // ── Package-level filters (derived from its documents) ─────────
    const daS = aliasedTable(documentAssignments, "da_s");
    const dS = aliasedTable(documents, "d_s");
    const packageHasDoc = (docCond: SQL): SQL =>
        exists(
            db
                .select({ id: daS.id })
                .from(daS)
                .innerJoin(dS, eq(dS.id, daS.documentId))
                .where(and(eq(daS.packageId, packages.id), docCond)),
        );

    const hasDraft = packageHasDoc(eq(dS.status, "draft"));
    const hasNonExecuted = packageHasDoc(ne(dS.status, "executed"));
    const pkgStatusCond: SQL | undefined =
        status === "draft"
            ? hasDraft
            : status === "executed"
              ? not(hasNonExecuted)
              : status === "finalized"
                ? and(not(hasDraft), hasNonExecuted)
                : undefined;

    // Search matches a package when any of its documents match the title.
    const daQ = aliasedTable(documentAssignments, "da_q");
    const dQ = aliasedTable(documents, "d_q");
    const pkgSearchCond: SQL | undefined = q
        ? exists(
              db
                  .select({ id: daQ.id })
                  .from(daQ)
                  .innerJoin(dQ, eq(dQ.id, daQ.documentId))
                  .where(and(eq(daQ.packageId, packages.id), ilike(dQ.title, `%${q}%`))),
          )
        : undefined;

    // ── Package ID sets per segment ────────────────────────────────
    // "Shared with me": a package the user doesn't own but is a recipient or viewer of.
    const sharedPkgs = db
        .selectDistinct({ id: packages.id })
        .from(packages)
        .leftJoin(packageRecipients, eq(packageRecipients.packageId, packages.id))
        .leftJoin(packageViewers, eq(packageViewers.packageId, packages.id))
        .where(
            and(
                ne(packages.owner, me),
                or(
                    and(eq(packageRecipients.userId, me), isNotNull(packageRecipients.id)),
                    and(eq(packageViewers.userId, me), isNotNull(packageViewers.id)),
                ),
            ),
        );

    // "Waiting on me": packages containing a finalized doc where I'm a pending signer.
    const waitingPkgs = db
        .selectDistinct({ id: documentAssignments.packageId })
        .from(pendingDocumentsView)
        .innerJoin(documentAssignments, eq(documentAssignments.documentId, pendingDocumentsView.id))
        .where(
            and(
                eq(pendingDocumentsView.signatoryUserId, me),
                eq(pendingDocumentsView.status, "finalized"),
            ),
        );

    let pkgIdCond: SQL | undefined;
    switch (segment) {
        case "sent":
            pkgIdCond = eq(packages.owner, me);
            break;
        case "shared":
            pkgIdCond = inArray(packages.id, sharedPkgs);
            break;
        case "waiting":
            pkgIdCond = inArray(packages.id, waitingPkgs);
            break;
        case "drafts":
            pkgIdCond = undefined;
            break;
        default:
            pkgIdCond = or(eq(packages.owner, me), inArray(packages.id, sharedPkgs));
    }

    const pkgWhere = and(pkgIdCond, pkgStatusCond, pkgSearchCond);
    const isDraftsSegment = segment === "drafts";

    // ── Envelope (package) list ────────────────────────────────────
    let envelopes: EnvelopeItem[] = [];
    let envelopeTotal = 0;

    if (!isDraftsSegment && pkgWhere) {
        const [countRows, rows] = await Promise.all([
            db
                .select({ c: count(packages.id) })
                .from(packages)
                .where(pkgWhere),
            db
                .select({
                    id: packages.id,
                    name: packages.name,
                    owner: packages.owner,
                    expirationDate: packages.expirationDate,
                    updatedAt: packages.updatedAt,
                })
                .from(packages)
                .where(pkgWhere)
                .orderBy(desc(packages.updatedAt))
                .limit(PAGE_SIZE)
                .offset(offset),
        ]);
        envelopeTotal = countRows[0]?.c ?? 0;

        if (rows.length > 0) {
            const pkgIds = rows.map((r) => r.id);
            const docRows = await db
                .select({
                    id: documents.id,
                    title: documents.title,
                    status: documents.status,
                    updatedAt: documents.updatedAt,
                    packageId: documentAssignments.packageId,
                })
                .from(documents)
                .innerJoin(documentAssignments, eq(documents.id, documentAssignments.documentId))
                .where(inArray(documentAssignments.packageId, pkgIds))
                .orderBy(desc(documents.updatedAt));
            const docIds = docRows.map((d) => d.id);

            const [recipRows, sigRows, myPendingRows] = await Promise.all([
                db
                    .select({
                        packageId: packageRecipients.packageId,
                        userId: packageRecipients.userId,
                        role: packageRecipients.role,
                    })
                    .from(packageRecipients)
                    .where(inArray(packageRecipients.packageId, pkgIds)),
                docIds.length > 0
                    ? db
                          .select({
                              documentId: signatures.documentId,
                              signerUserId: signatures.signerUserId,
                          })
                          .from(signatures)
                          .where(
                              and(
                                  inArray(signatures.documentId, docIds),
                                  inArray(signatures.status, ["signed", "anchored"]),
                              ),
                          )
                    : Promise.resolve([] as { documentId: string; signerUserId: string }[]),
                db
                    .select({ id: pendingDocumentsView.id })
                    .from(pendingDocumentsView)
                    .where(
                        and(
                            eq(pendingDocumentsView.signatoryUserId, me),
                            eq(pendingDocumentsView.status, "finalized"),
                        ),
                    ),
            ]);

            const docsByPkg = new Map<string, typeof docRows>();
            for (const d of docRows) {
                const list = docsByPkg.get(d.packageId) ?? [];
                list.push(d);
                docsByPkg.set(d.packageId, list);
            }

            // Signer count = recipient rows with the signer role (guests without a
            // linked account included — they still need to sign).
            const signersByPkg = new Map<string, number>();
            for (const r of recipRows) {
                if (r.role !== "signer") continue;
                signersByPkg.set(r.packageId, (signersByPkg.get(r.packageId) ?? 0) + 1);
            }

            const pkgOfDoc = new Map<string, string>();
            for (const d of docRows) pkgOfDoc.set(d.id, d.packageId);
            const signedByPkg = new Map<string, number>();
            for (const s of sigRows) {
                const pid = pkgOfDoc.get(s.documentId);
                if (!pid) continue;
                signedByPkg.set(pid, (signedByPkg.get(pid) ?? 0) + 1);
            }

            const myPendingIds = new Set(myPendingRows.map((r) => r.id));

            envelopes = rows.map((p) => {
                const docs = docsByPkg.get(p.id) ?? [];
                const signerCount = signersByPkg.get(p.id) ?? 0;
                const signedCount = signedByPkg.get(p.id) ?? 0;
                return {
                    id: p.id,
                    name: p.name,
                    owner: p.owner,
                    expirationDate: p.expirationDate?.toISOString() ?? null,
                    updatedAt: p.updatedAt.toISOString(),
                    documents: docs.map((d) => ({
                        id: d.id,
                        title: d.title,
                        status: d.status,
                        updatedAt: d.updatedAt.toISOString(),
                    })),
                    signedCount,
                    // Owner-as-signer (no packageRecipients row) can sign without
                    // being counted, so never let the denominator drop below the
                    // number of recorded signatures.
                    totalSignatures: Math.max(signerCount * docs.length, signedCount),
                    needsMe: docs.some((d) => myPendingIds.has(d.id)),
                };
            });
        }
    }

    // ── Standalone drafts (documents not in any package) ───────────
    const wantsDrafts = segment === "all" || isDraftsSegment;
    const draftStatusCond: SQL | undefined =
        status === "all" ? undefined : eq(documents.status, status);
    const draftSearchCond: SQL | undefined = q ? ilike(documents.title, `%${q}%`) : undefined;
    const draftWhere = and(
        eq(documents.owner, me),
        eq(documents.isTemplate, false),
        isNull(documentAssignments.id),
        draftStatusCond,
        draftSearchCond,
    );

    const draftsLimit = isDraftsSegment ? PAGE_SIZE : DRAFTS_SECTION_LIMIT;
    const draftsOffset = isDraftsSegment ? offset : 0;

    let draftCount = 0;
    let drafts: DraftItem[] = [];
    if (wantsDrafts && draftWhere) {
        const [countRows, rows] = await Promise.all([
            db
                .select({ c: count(documents.id) })
                .from(documents)
                .leftJoin(documentAssignments, eq(documents.id, documentAssignments.documentId))
                .where(draftWhere),
            db
                .select({
                    id: documents.id,
                    title: documents.title,
                    status: documents.status,
                    pageCount: documents.pageCount,
                    fileSize: documents.fileSize,
                    updatedAt: documents.updatedAt,
                })
                .from(documents)
                .leftJoin(documentAssignments, eq(documents.id, documentAssignments.documentId))
                .where(draftWhere)
                .orderBy(desc(documents.updatedAt))
                .limit(draftsLimit)
                .offset(draftsOffset),
        ]);
        draftCount = countRows[0]?.c ?? 0;
        drafts = rows.map((d) => ({
            id: d.id,
            title: d.title,
            status: d.status,
            pageCount: d.pageCount ?? 0,
            fileSize: d.fileSize ?? 0,
            updatedAt: d.updatedAt.toISOString(),
        }));
    }

    // Header count: every document the user can see in this segment.
    const envelopeDocCount =
        !isDraftsSegment && pkgWhere
            ? ((
                  await db
                      .select({ c: count(documents.id) })
                      .from(packages)
                      .innerJoin(
                          documentAssignments,
                          eq(documentAssignments.packageId, packages.id),
                      )
                      .innerJoin(documents, eq(documents.id, documentAssignments.documentId))
                      .where(pkgWhere)
              )[0]?.c ?? 0)
            : 0;
    const totalDocuments = envelopeDocCount + draftCount;

    logger.debug("docListPage", "Document list loaded", {
        userId: me,
        segment,
        status,
        q: q || undefined,
        page,
        envelopes: envelopes.length,
        envelopeTotal,
        drafts: drafts.length,
        draftCount,
    });

    return {
        segment,
        status,
        q,
        page,
        pageSize: PAGE_SIZE,
        envelopes,
        envelopeTotal,
        hasMoreEnvelopes: offset + envelopes.length < envelopeTotal,
        drafts,
        draftTotal: draftCount,
        isDraftsSegment,
        showDraftsSection: segment === "all" && drafts.length > 0,
        totalDocuments,
    };
};
