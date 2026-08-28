import type { PageServerLoad, Actions } from "./$types";
import { redirect, fail } from "@sveltejs/kit";
import { db } from "#lib/server/db/index.js";
import { templates, documents } from "#lib/server/db/schema.js";
import { eq, and } from "drizzle-orm";
import { logger } from "#lib/server/logger.js";
import { supabaseAdmin } from "#lib/server/storage/supabase.js";
import { getSignedUrl, setSignedUrl } from "#lib/server/storage/url-cache.js";
import { TEMPLATES_BUCKET, type TemplateSignatory } from "#lib/server/templates.js";
import type { PlacedRect } from "#lib/client/types/SignatureBoxTypes.d.ts";

const PREVIEW_TTL = 3_600_000; // 1 hour

export const load: PageServerLoad = async ({ params, locals }) => {
    if (!locals.user) {
        redirect(302, "/login");
    }
    const me = locals.user.id;

    const [row] = await db
        .select({
            templateId: templates.id,
            name: templates.name,
            documentId: documents.id,
            placementFields: documents.placementFields,
            storagePath: documents.storagePath,
            pageCount: documents.pageCount,
            signatories: templates.signatories,
        })
        .from(templates)
        .innerJoin(documents, eq(documents.id, templates.documentId))
        .where(and(eq(templates.id, params.templateId), eq(templates.userId, me)))
        .limit(1);

    if (!row) {
        logger.warn("templateEdit", "Template not found or not owned", {
            templateId: params.templateId,
            userId: me,
        });
        redirect(302, "/templates");
    }

    let pdfUrl = "";
    if (row.storagePath) {
        pdfUrl =
            getSignedUrl(row.storagePath) ??
            (
                await supabaseAdmin.storage
                    .from(TEMPLATES_BUCKET)
                    .createSignedUrl(row.storagePath, PREVIEW_TTL)
            ).data?.signedUrl ??
            "";
        if (pdfUrl) setSignedUrl(row.storagePath, pdfUrl);
    }

    return {
        templateId: row.templateId,
        name: row.name,
        pdfUrl,
        pageCount: row.pageCount ?? 0,
        placementFields: (row.placementFields as PlacedRect[] | null) ?? [],
        signatories: (row.signatories as TemplateSignatory[] | null) ?? [],
    };
};

export const actions: Actions = {
    saveFields: async ({ request, params, locals }) => {
        if (!locals.user) {
            return fail(401, { error: "You must be signed in" });
        }

        const [tmpl] = await db
            .select({ documentId: templates.documentId })
            .from(templates)
            .where(and(eq(templates.id, params.templateId), eq(templates.userId, locals.user.id)))
            .limit(1);
        if (!tmpl) {
            return fail(404, { error: "Template not found" });
        }

        const formData = await request.formData();
        const raw = formData.get("placementFields");
        if (!raw || typeof raw !== "string") {
            return fail(400, { error: "No placement fields data" });
        }
        const rawSignatories = formData.get("signatories");

        let placementFields: PlacedRect[];
        try {
            placementFields = JSON.parse(raw);
        } catch {
            return fail(400, { error: "Invalid placement fields data" });
        }

        let signatories: TemplateSignatory[] | undefined;
        if (rawSignatories && typeof rawSignatories === "string") {
            try {
                signatories = JSON.parse(rawSignatories);
            } catch {
                return fail(400, { error: "Invalid signatories data" });
            }
        }

        await db
            .update(documents)
            .set({ placementFields, updatedAt: new Date() })
            .where(eq(documents.id, tmpl.documentId));

        if (signatories !== undefined) {
            await db
                .update(templates)
                .set({ signatories, updatedAt: new Date() })
                .where(eq(templates.id, params.templateId));
        }

        logger.info("templateEdit", "Template fields saved", {
            templateId: params.templateId,
            documentId: tmpl.documentId,
            boxCount: placementFields.length,
        });

        return { success: true };
    },
};
