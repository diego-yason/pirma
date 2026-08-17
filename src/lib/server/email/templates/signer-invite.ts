import { emailShell, escapeHtml, BUTTON } from "./shell.js";

export interface SignerInviteData {
    recipientName: string | null;
    senderName: string | null;
    packageName: string;
    signUrl: string;
    /** ISO date string or null */
    deadline?: string | null;
}

export function renderSignerInvite(data: SignerInviteData): string {
    const recipient = data.recipientName?.trim() ? data.recipientName : "there";
    const deadline = data.deadline
        ? `<p style="margin:0 0 16px;color:#3f3f46;font-size:15px;">Please sign before <strong>${escapeHtml(data.deadline)}</strong>.</p>`
        : "";
    return emailShell({
        title: `Signature requested: ${data.packageName}`,
        body: `
            <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">Hi ${escapeHtml(recipient)},</p>
            <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">${escapeHtml(data.senderName ?? "Someone")} has sent you <strong>${escapeHtml(data.packageName)}</strong> to review and sign.</p>
            ${deadline}
            <p style="margin:24px 0;">
                <a href="${escapeHtml(data.signUrl)}" style="${BUTTON}">Review &amp; sign</a>
            </p>
            <p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">If the button doesn't work, copy and paste this link into your browser:<br /><a href="${escapeHtml(data.signUrl)}" style="color:#2563eb;">${escapeHtml(data.signUrl)}</a></p>
        `,
    });
}

export function signerInviteSubject(packageName: string): string {
    return `Signature requested: ${packageName}`;
}
