import { logger } from "#lib/server/logger.js";
import { renderSignerInvite, signerInviteSubject } from "#lib/server/email/templates/index.js";

/** Dev-only preview of the signer-invite email template. */
export const load = () => {
    logger.debug("devEmail", "Static email preview page loaded", {
        template: "signer-invite",
    });

    const sample = {
        recipientName: "Juan Dela Cruz",
        senderName: "Acme Corporation",
        packageName: "Vendor Service Agreement",
        signUrl: "https://app.example.com/doc/00000000-0000-0000-0000-000000000000/sign?token=…",
        deadline: "2026-09-15",
    };

    return {
        subject: signerInviteSubject(sample.packageName),
        html: renderSignerInvite(sample),
    };
};
