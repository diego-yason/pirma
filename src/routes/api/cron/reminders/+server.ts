import type { RequestHandler } from "./$types";
import { CRON_SECRET } from "$app/env/private";
import { sendDueReminders } from "#lib/server/email/reminders.js";
import { logger } from "#lib/server/logger.js";

/**
 * POST /api/cron/reminders
 * Triggered by an external scheduler (e.g. a cron hitting this URL daily).
 * Requires the `x-cron-secret` header to match CRON_SECRET.
 * Disabled (503) when CRON_SECRET is not set.
 */
export const POST: RequestHandler = async ({ request }) => {
    if (!CRON_SECRET) {
        logger.warn("reminders", "Cron endpoint disabled — CRON_SECRET not set");
        return Response.json({ error: "Not configured" }, { status: 503 });
    }

    const supplied = request.headers.get("x-cron-secret");
    if (!supplied || supplied !== CRON_SECRET) {
        logger.warn("reminders", "Cron endpoint rejected — bad secret");
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sent = await sendDueReminders();
    return Response.json({ ok: true, sent });
};
