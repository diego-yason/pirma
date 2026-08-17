import { emailShell, escapeHtml, BUTTON } from "./shell.js";

export interface ExecutedData {
    recipientName?: string | null;
    packageName: string;
    documentCount: number;
    /** "owner" (sender) or "signer" copy */
    role: "owner" | "signer";
    dashboardUrl?: string;
}

export function renderExecuted(data: ExecutedData): string {
    const name = data.recipientName?.trim() ? data.recipientName : "there";
    const docs = data.documentCount === 1 ? "document" : "documents";

    const intro =
        data.role === "owner"
            ? `<p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">Good news — <strong>${escapeHtml(data.packageName)}</strong> is fully signed. All parties have completed their signatures.</p>`
            : `<p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">Hi ${escapeHtml(name)}, all parties have signed <strong>${escapeHtml(data.packageName)}</strong>. It's complete (${data.documentCount} ${docs}).</p>`;

    const action = data.dashboardUrl
        ? `<p style="margin:24px 0;"><a href="${escapeHtml(data.dashboardUrl)}" style="${BUTTON}">View in dashboard</a></p>`
        : "";

    return emailShell({
        title: `${data.packageName} — fully signed`,
        body: `${intro}${action}`,
        footer:
            data.role === "owner"
                ? "You're receiving this because you own this signing request."
                : "You're receiving this because you were a signer on this request.",
    });
}

export function executedSubject(packageName: string): string {
    return `${packageName} — fully signed`;
}
