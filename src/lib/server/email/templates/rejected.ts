import { emailShell, escapeHtml, BUTTON } from "./shell.js";

export interface RejectedData {
    signerName: string | null;
    signerEmail?: string | null;
    packageName: string;
    reason?: string | null;
    dashboardUrl: string;
}

export function renderRejected(data: RejectedData): string {
    const who = data.signerName?.trim() ? data.signerName : data.signerEmail ?? "A signer";
    const reasonBlock = data.reason?.trim()
        ? `<blockquote style="margin:16px 0;padding:12px 16px;border-left:4px solid #e4e4e7;color:#3f3f46;font-size:14px;background:#fafafa;">${escapeHtml(data.reason)}</blockquote>`
        : "";
    return emailShell({
        title: `${data.packageName} — rejected`,
        body: `
            <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;"><strong>${escapeHtml(who)}</strong> declined to sign <strong>${escapeHtml(data.packageName)}</strong>.</p>
            ${reasonBlock}
            <p style="margin:24px 0;">
                <a href="${escapeHtml(data.dashboardUrl)}" style="${BUTTON}">View in dashboard</a>
            </p>
        `,
        footer: "You're receiving this because you own this signing request.",
    });
}

export function rejectedSubject(packageName: string): string {
    return `${packageName} — rejected`;
}
