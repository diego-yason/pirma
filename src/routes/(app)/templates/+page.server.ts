import type { Actions, PageServerLoad } from "./$types";
import { redirect, fail } from "@sveltejs/kit";
import { db } from "#lib/server/db/index.js";
import { templates, documents } from "#lib/server/db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "#lib/server/logger.js";
import { supabaseAdmin } from "#lib/server/storage/supabase.js";
import { getSignedUrl, setSignedUrl } from "#lib/server/storage/url-cache.js";
import {
    TEMPLATES_BUCKET,
    createTemplateFromUpload,
    instantiateTemplate,
    deleteTemplate,
} from "#lib/server/templates.js";

const PREVIEW_TTL = 3_600_000; // 1 hour

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        redirect(302, "/login");
    }
    const me = locals.user.id;

    const rows = await db
        .select({
            id: templates.id,
            name: templates.name,
            createdAt: templates.createdAt,
            lastUsedAt: templates.lastUsedAt,
            useCount: templates.useCount,
            documentId: documents.id,
            pageCount: documents.pageCount,
            fileSize: documents.fileSize,
            storagePath: documents.storagePath,
        })
        .from(templates)
        .innerJoin(documents, eq(documents.id, templates.documentId))
        .where(eq(templates.userId, me))
        .orderBy(desc(templates.createdAt));

    const items = await Promise.all(
        rows.map(async (r) => {
            let previewUrl = "";
            if (r.storagePath) {
                previewUrl =
                    getSignedUrl(r.storagePath) ??
                    (await supabaseAdmin.storage
                        .from(TEMPLATES_BUCKET)
                        .createSignedUrl(r.storagePath, PREVIEW_TTL)).data?.signedUrl ??
                    "";
                if (previewUrl) setSignedUrl(r.storagePath, previewUrl);
            }
            return {
                id: r.id,
                name: r.name,
                documentId: r.documentId,
                pageCount: r.pageCount ?? 0,
                fileSize: r.fileSize ?? 0,
                useCount: r.useCount,
                lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
                createdAt: r.createdAt.toISOString(),
                previewUrl,
            };
        }),
    );

    logger.debug("templates", "Templates page loaded", { userId: me, count: items.length });
    return { templates: items };
};

export const actions: Actions = {
    uploadTemplate: async ({ request, locals }) => {
        if (!locals.user) {
            return fail(401, { error: "You must be signed in" });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const name = (formData.get("name") as string | null)?.trim() || "Untitled template";

        if (!file || file.size === 0) {
            return fail(400, { error: "Please select a file to use as a template" });
        }
        if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
            return fail(400, { error: "Only PDF, JPG, or PNG files are supported" });
        }

        try {
            await createTemplateFromUpload({ userId: locals.user.id, name, file });
            return { success: true };
        } catch (err) {
            logger.error("templates", "uploadTemplate failed", err);
            return fail(500, {
                error: err instanceof Error ? err.message : "Failed to create the template",
            });
        }
    },

    startFromTemplate: async ({ request, locals }) => {
        if (!locals.user) {
            return fail(401, { error: "You must be signed in" });
        }

        const formData = await request.formData();
        const templateId = (formData.get("templateId") as string | null)?.trim();
        if (!templateId) {
            return fail(400, { error: "Template id is required" });
        }

        try {
            const { packageId } = await instantiateTemplate({
                userId: locals.user.id,
                templateId,
            });
            redirect(303, `/doc/new/${packageId}`);
        } catch (err) {
            logger.error("templates", "startFromTemplate failed", err);
            return fail(500, {
                error: err instanceof Error ? err.message : "Failed to start from this template",
            });
        }
    },

    renameTemplate: async ({ request, locals }) => {
        if (!locals.user) {
            return fail(401, { error: "You must be signed in" });
        }

        const formData = await request.formData();
        const templateId = (formData.get("templateId") as string | null)?.trim();
        const name = (formData.get("name") as string | null)?.trim();

        if (!templateId) {
            return fail(400, { error: "Template id is required" });
        }
        if (!name) {
            return fail(400, { error: "Template name is required" });
        }

        const [updated] = await db
            .update(templates)
            .set({ name, updatedAt: new Date() })
            .where(and(eq(templates.id, templateId), eq(templates.userId, locals.user.id)))
            .returning({ id: templates.id });

        if (!updated) {
            return fail(404, { error: "Template not found" });
        }
        return { success: true };
    },

    deleteTemplate: async ({ request, locals }) => {
        if (!locals.user) {
            return fail(401, { error: "You must be signed in" });
        }

        const formData = await request.formData();
        const templateId = (formData.get("templateId") as string | null)?.trim();
        if (!templateId) {
            return fail(400, { error: "Template id is required" });
        }

        try {
            await deleteTemplate({ userId: locals.user.id, templateId });
            return { success: true };
        } catch (err) {
            logger.error("templates", "deleteTemplate failed", err);
            return fail(500, {
                error: err instanceof Error ? err.message : "Failed to delete the template",
            });
        }
    },
};
