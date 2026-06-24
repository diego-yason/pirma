import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { eq, and, desc } from "drizzle-orm";
import { db } from "$lib/server/db";
import { documents } from "$lib/server/db/schema";

const PAGE_SIZE = 10;

export const GET: RequestHandler = async ({ locals, url }) => {
    if (!locals.user) {
        return json({ error: "Unauthorized" }, { status: 401 });
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
            conditions.push(eq(documents.status, statusFilter as "draft" | "finalized" | "executed"));
        }
    }

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
        .where(and(...conditions))
        .orderBy(desc(documents.updatedAt))
        .limit(PAGE_SIZE)
        .offset(offset);

    return json(
        {
            documents: userDocuments,
            pagination: {
                page,
                pageSize: PAGE_SIZE,
            },
        },
        { status: 200 },
    );
};
