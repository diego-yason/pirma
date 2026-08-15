import type { RequestHandler } from "./$types";
import { eq, and, desc, isNull } from "drizzle-orm";
import { db } from "#lib/server/db/index.js";
import { documents, documentAssignments } from "#lib/server/db/schema.js";
import { logger } from "#lib/server/logger.js";

const PAGE_SIZE = 10;

export const GET: RequestHandler = async ({ locals, url }) => {
    if (!locals.user) {
        logger.warn("docList", "Unauthorized access attempt");
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pageParam = Number(url.searchParams.get("page"));
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
    const offset = (page - 1) * PAGE_SIZE;

    // Optional status filter – leverages documents_status_idx
    const statusFilter = url.searchParams.get("status");
    const conditions = [eq(documents.owner, locals.user.id)];

    if (statusFilter) {
        // Validate against enum values
        const validStatuses = ["draft", "finalized", "executed"] as const;
        if (validStatuses.includes(statusFilter as (typeof validStatuses)[number])) {
            conditions.push(
                eq(documents.status, statusFilter as "draft" | "finalized" | "executed"),
            );
        }
    }

    logger.debug("docList", "Fetching documents", {
        userId: locals.user.id,
        page,
        status: statusFilter ?? "any",
    });

    try {
        const userDocuments = await db
            .select({
                id: documents.id,
                title: documents.title,
                status: documents.status,
                pageCount: documents.pageCount,
                fileSize: documents.fileSize,
                createdAt: documents.createdAt,
                updatedAt: documents.updatedAt,
            })
            .from(documents)
            .leftJoin(documentAssignments, eq(documents.id, documentAssignments.documentId))
            .where(and(...conditions, isNull(documentAssignments.id)))
            .orderBy(desc(documents.updatedAt))
            .limit(PAGE_SIZE)
            .offset(offset);

        logger.info("docList", "Returning documents", {
            userId: locals.user.id,
            count: userDocuments.length,
            page,
        });

        return Response.json(
            {
                documents: userDocuments,
                pagination: {
                    page,
                    pageSize: PAGE_SIZE,
                },
            },
            { status: 200 },
        );
    } catch (err) {
        logger.error("docList", "Query failed", err);
        return Response.json({ error: "Failed to fetch documents" }, { status: 500 });
    }
};
