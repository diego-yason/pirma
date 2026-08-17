import { emailShell, escapeHtml } from "./shell.js";

export interface GuestOtpData {
    name: string | null;
    code: string;
    packageName: string;
    expiresInMinutes: number;
}

export function renderGuestOtp(data: GuestOtpData): string {
    const name = data.name?.trim() ? data.name : "there";
    return emailShell({
        title: `Your sign-in code: ${data.code}`,
        body: `
            <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">Hi ${escapeHtml(name)},</p>
            <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">Use the code below to sign <strong>${escapeHtml(data.packageName)}</strong>. It expires in ${data.expiresInMinutes} minutes.</p>
            <p style="margin:24px 0;text-align:center;">
                <span style="display:inline-block;padding:16px 24px;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;font-size:28px;font-weight:700;letter-spacing:8px;color:#18181b;">${escapeHtml(data.code)}</span>
            </p>
            <p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">If you didn't request this code, you can safely ignore this email.</p>
        `,
    });
}

export function guestOtpSubject(): string {
    return "Your sign-in code";
}
