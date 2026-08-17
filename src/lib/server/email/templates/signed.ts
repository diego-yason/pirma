import { emailShell, escapeHtml, BUTTON } from "./shell.js";

export interface SignedData {
    signerName: string | null;
    signerEmail?: string | null;
    packageName: string;
    documentCount: number;
    dashboardUrl: string;
}

export function renderSigned(data: SignedData): string {
    const who = data.signerName?.trim() ? data.signerName : data.signerEmail ?? "A signer";
    const docs = data.documentCount === 1 ? "a document" : `${data.documentCount} documents`;
    return emailShell({
        title: `${data.packageName} — signed`,
        body: `
            <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;"><strong>${escapeHtml(who)}</strong> just signed <strong>${escapeHtml(data.packageName)}</strong> (${docs}).</p>
            <p style="margin:24px 0;">
                <a href="${escapeHtml(data.dashboardUrl)}" style="${BUTTON}">View in dashboard</a>
            </p>
        `,
        footer: "You're receiving this because you own this signing request.",
    });
}

export function signedSubject(packageName: string): string {
    return `${packageName} — signed`;
}
