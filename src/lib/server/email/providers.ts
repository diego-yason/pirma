import { EMAIL_PROVIDER, EMAIL_FROM, RESEND_API_KEY } from "$app/env/private";
import { logger } from "#lib/server/logger.js";

export interface EmailMessage {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export interface EmailProvider {
    send(message: EmailMessage): Promise<void>;
}

/**
 * Console provider — logs the email instead of sending. Used as the default
 * so the app works locally without an API key or SMTP config.
 */
const consoleProvider: EmailProvider = {
    async send(message) {
        // Do NOT log the HTML/text body — it can contain signing tokens,
        // OTP codes, and reset links. Log metadata only.
        logger.info("email", "Console email (not sent)", {
            to: message.to,
            subject: message.subject,
            htmlBytes: message.html.length,
            textBytes: message.text?.length ?? 0,
        });
    },
};

/** Resend provider — thin REST client (no extra dependency). */
const resendProvider: EmailProvider = {
    async send(message) {
        if (!RESEND_API_KEY) {
            throw new Error("RESEND_API_KEY is not set");
        }
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: EMAIL_FROM,
                to: [message.to],
                subject: message.subject,
                html: message.html,
                ...(message.text ? { text: message.text } : {}),
            }),
        });

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Resend error ${res.status}: ${body}`);
        }
    },
};

/**
 * Resolve the active provider from EMAIL_PROVIDER.
 * Unknown/empty values fall back to the console provider so nothing breaks.
 */
export function getProvider(): EmailProvider {
    switch (EMAIL_PROVIDER) {
        case "resend":
            return resendProvider;
        case "console":
            return consoleProvider;
        default:
            if (EMAIL_PROVIDER) {
                logger.warn("email", `Unknown EMAIL_PROVIDER "${EMAIL_PROVIDER}" — falling back to console`, {
                    provider: EMAIL_PROVIDER,
                });
            }
            return consoleProvider;
    }
}
