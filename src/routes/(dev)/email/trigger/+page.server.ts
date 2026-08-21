import { fail } from "@sveltejs/kit";
import { EMAIL_PROVIDER } from "$app/env/private";
import { logger } from "#lib/server/logger.js";
import { sendEmail } from "#lib/server/email/index.js";
import {
    renderSignerInvite,
    signerInviteSubject,
    type SignerInviteData,
    renderSigned,
    signedSubject,
    type SignedData,
    renderRejected,
    rejectedSubject,
    type RejectedData,
    renderExecuted,
    executedSubject,
    type ExecutedData,
    renderPasswordReset,
    passwordResetSubject,
    type PasswordResetData,
    renderReminder,
    reminderSubject,
    type ReminderData,
    renderGuestOtp,
    guestOtpSubject,
    type GuestOtpData,
} from "#lib/server/email/templates/index.js";

/** One editable field on the manual-trigger form. */
interface FieldDef {
    key: string;
    label: string;
    type: "text" | "number" | "select";
    options?: string[];
    placeholder?: string;
    sample: string | number;
}

interface TemplateDef {
    key: string;
    label: string;
    description: string;
    fields: FieldDef[];
    render(data: Record<string, unknown>): string;
    subject(data: Record<string, unknown>): string;
}

/** Registry of templates exposed on the manual-trigger page. */
const TEMPLATES: TemplateDef[] = [
    {
        key: "signer-invite",
        label: "Signer invite",
        description: "Sent to a recipient when they're added to a package.",
        fields: [
            {
                key: "recipientName",
                label: "Recipient name",
                type: "text",
                sample: "Juan Dela Cruz",
            },
            { key: "senderName", label: "Sender name", type: "text", sample: "Acme Corporation" },
            {
                key: "packageName",
                label: "Package name",
                type: "text",
                sample: "Vendor Service Agreement",
            },
            {
                key: "signUrl",
                label: "Sign URL",
                type: "text",
                sample: "https://app.example.com/doc/00000000-0000-0000-0000-000000000000/sign?token=dev-token",
            },
            {
                key: "deadline",
                label: "Deadline (optional, ISO date)",
                type: "text",
                sample: "2026-09-15",
            },
        ],
        render: (d) => renderSignerInvite(d as unknown as SignerInviteData),
        subject: (d) => signerInviteSubject(String(d.packageName)),
    },
    {
        key: "signed",
        label: "Signed notification",
        description: "Sent to the owner when a signer signs a document.",
        fields: [
            { key: "signerName", label: "Signer name", type: "text", sample: "Juan Dela Cruz" },
            { key: "signerEmail", label: "Signer email", type: "text", sample: "juan@example.com" },
            {
                key: "packageName",
                label: "Package name",
                type: "text",
                sample: "Vendor Service Agreement",
            },
            { key: "documentCount", label: "Document count", type: "number", sample: 1 },
            {
                key: "dashboardUrl",
                label: "Dashboard URL",
                type: "text",
                sample: "https://app.example.com",
            },
        ],
        render: (d) => renderSigned(d as unknown as SignedData),
        subject: (d) => signedSubject(String(d.packageName)),
    },
    {
        key: "rejected",
        label: "Rejected notification",
        description: "Sent to the owner when a signer declines with a reason.",
        fields: [
            { key: "signerName", label: "Signer name", type: "text", sample: "Juan Dela Cruz" },
            { key: "signerEmail", label: "Signer email", type: "text", sample: "juan@example.com" },
            {
                key: "packageName",
                label: "Package name",
                type: "text",
                sample: "Vendor Service Agreement",
            },
            {
                key: "reason",
                label: "Rejection reason",
                type: "text",
                sample: "Clause 4 is unacceptable",
            },
            {
                key: "dashboardUrl",
                label: "Dashboard URL",
                type: "text",
                sample: "https://app.example.com",
            },
        ],
        render: (d) => renderRejected(d as unknown as RejectedData),
        subject: (d) => rejectedSubject(String(d.packageName)),
    },
    {
        key: "executed",
        label: "Executed summary",
        description: "Sent when every signer has signed every document (owner + signers).",
        fields: [
            {
                key: "recipientName",
                label: "Recipient name",
                type: "text",
                sample: "Juan Dela Cruz",
            },
            {
                key: "packageName",
                label: "Package name",
                type: "text",
                sample: "Vendor Service Agreement",
            },
            { key: "documentCount", label: "Document count", type: "number", sample: 1 },
            {
                key: "role",
                label: "Recipient role",
                type: "select",
                options: ["owner", "signer"],
                sample: "owner",
            },
            {
                key: "dashboardUrl",
                label: "Dashboard URL (optional)",
                type: "text",
                sample: "https://app.example.com",
            },
        ],
        render: (d) => renderExecuted(d as unknown as ExecutedData),
        subject: (d) => executedSubject(String(d.packageName)),
    },
    {
        key: "password-reset",
        label: "Password reset",
        description: "Sent via the Better Auth reset-password hook.",
        fields: [
            { key: "name", label: "Name", type: "text", sample: "Juan Dela Cruz" },
            {
                key: "resetUrl",
                label: "Reset URL",
                type: "text",
                sample: "https://app.example.com/reset-password?token=dev-token",
            },
        ],
        render: (d) => renderPasswordReset(d as unknown as PasswordResetData),
        subject: () => passwordResetSubject(),
    },
    {
        key: "reminder",
        label: "Reminder",
        description: "Sent by the reminders cron to outstanding signers.",
        fields: [
            {
                key: "recipientName",
                label: "Recipient name",
                type: "text",
                sample: "Juan Dela Cruz",
            },
            { key: "senderName", label: "Sender name", type: "text", sample: "Acme Corporation" },
            {
                key: "packageName",
                label: "Package name",
                type: "text",
                sample: "Vendor Service Agreement",
            },
            {
                key: "signUrl",
                label: "Sign URL",
                type: "text",
                sample: "https://app.example.com/doc/00000000-0000-0000-0000-000000000000/sign?token=dev-token",
            },
            {
                key: "deadline",
                label: "Deadline (optional, ISO date)",
                type: "text",
                sample: "2026-09-15",
            },
        ],
        render: (d) => renderReminder(d as unknown as ReminderData),
        subject: (d) => reminderSubject(String(d.packageName)),
    },
    {
        key: "guest-otp",
        label: "Guest OTP",
        description: "Sent to a guest with their one-time sign-in code.",
        fields: [
            { key: "name", label: "Name", type: "text", sample: "Juan Dela Cruz" },
            { key: "code", label: "OTP code", type: "text", sample: "123456" },
            {
                key: "packageName",
                label: "Package name",
                type: "text",
                sample: "Vendor Service Agreement",
            },
            { key: "expiresInMinutes", label: "Expires in (minutes)", type: "number", sample: 10 },
        ],
        render: (d) => renderGuestOtp(d as unknown as GuestOtpData),
        subject: () => guestOtpSubject(),
    },
];

export const load = async () => {
    logger.debug("devEmail", "Manual trigger page loaded", {
        templateCount: TEMPLATES.length,
    });
    return {
        provider: EMAIL_PROVIDER || "console",
        templates: TEMPLATES.map(({ key, label, description, fields }) => ({
            key,
            label,
            description,
            fields,
        })),
    };
};

export const actions = {
    /** Render a preview of the selected template with current field values. */
    preview: async ({ request }) => {
        const form = await request.formData();
        const template = resolveTemplate(form);
        if (template instanceof Error) {
            logger.warn("devEmail", "Preview rejected — unknown template", {
                error: template.message,
            });
            return fail(400, { error: template.message });
        }
        const data = collectFields(template, form);
        if (data instanceof Error) {
            logger.warn("devEmail", "Preview rejected — invalid fields", {
                template: template.key,
                error: data.message,
            });
            return fail(400, { error: data.message });
        }
        try {
            const subject = template.subject(data);
            const html = template.render(data);
            logger.info("devEmail", "Preview rendered", {
                template: template.key,
                subject,
                htmlBytes: html.length,
            });
            return { ok: true, preview: { subject, html } };
        } catch (err) {
            logger.error("devEmail", "Template render failed", {
                template: template.key,
                error: err,
            });
            return fail(400, {
                error:
                    err instanceof Error
                        ? `Template render failed: ${err.message}`
                        : "Template render failed",
            });
        }
    },

    /** Actually send the email through the normal pipeline (idempotent eventId). */
    send: async ({ request }) => {
        const form = await request.formData();
        const template = resolveTemplate(form);
        if (template instanceof Error) {
            logger.warn("devEmail", "Send rejected — unknown template", {
                error: template.message,
            });
            return fail(400, { error: template.message });
        }

        const to = String(form.get("to") ?? "")
            .trim()
            .toLowerCase();
        if (!to) {
            logger.warn("devEmail", "Send rejected — no recipient", {
                template: template.key,
            });
            return fail(400, { error: "Recipient email is required." });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
            logger.warn("devEmail", "Send rejected — invalid recipient", {
                template: template.key,
                to,
            });
            return fail(400, { error: "Recipient email looks invalid." });
        }

        const data = collectFields(template, form);
        if (data instanceof Error) {
            return fail(400, { error: data.message });
        }

        const eventId = `dev-trigger:${template.key}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

        try {
            const subject = template.subject(data);
            const html = template.render(data);
            logger.info("devEmail", "Manual send requested", {
                eventId,
                template: template.key,
                to,
                provider: EMAIL_PROVIDER || "console",
                htmlBytes: html.length,
            });

            const ok = await sendEmail({ eventId, template: template.key, to, subject, html });
            if (ok) {
                logger.info("devEmail", "Manual send completed", {
                    eventId,
                    template: template.key,
                    to,
                    provider: EMAIL_PROVIDER || "console",
                });
            } else {
                logger.warn("devEmail", "Manual send did not complete", {
                    eventId,
                    template: template.key,
                    to,
                });
            }
            return { ok, eventId, to, provider: EMAIL_PROVIDER || "console" };
        } catch (err) {
            logger.error("devEmail", "Manual send failed", {
                eventId,
                template: template.key,
                to,
                error: err,
            });
            return fail(500, {
                error: err instanceof Error ? `Send failed: ${err.message}` : "Send failed",
            });
        }
    },
};

function resolveTemplate(form: FormData): TemplateDef | Error {
    const key = String(form.get("template") ?? "");
    const template = TEMPLATES.find((t) => t.key === key);
    if (!template) return new Error("Unknown template.");
    return template;
}

function collectFields(template: TemplateDef, form: FormData): Record<string, unknown> | Error {
    const data: Record<string, unknown> = {};
    for (const field of template.fields) {
        const raw = String(form.get(field.key) ?? "").trim();
        if (raw === "" && field.type !== "number") {
            data[field.key] = "";
            continue;
        }
        if (field.type === "number") {
            const n = Number(raw);
            if (!Number.isFinite(n)) {
                return new Error(`"${field.label}" must be a number.`);
            }
            data[field.key] = n;
        } else {
            data[field.key] = raw;
        }
    }
    return data;
}
