import { emailShell, escapeHtml, BUTTON } from "./shell.js";

export interface PasswordResetData {
    name: string | null;
    resetUrl: string;
}

export function renderPasswordReset(data: PasswordResetData): string {
    const name = data.name?.trim() ? data.name : "there";
    return emailShell({
        title: "Reset your password",
        body: `
            <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">Hi ${escapeHtml(name)},</p>
            <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">We received a request to reset your password. Click the button below to choose a new one. This link expires shortly.</p>
            <p style="margin:24px 0;">
                <a href="${escapeHtml(data.resetUrl)}" style="${BUTTON}">Reset password</a>
            </p>
            <p style="margin:0 0 16px;color:#71717a;font-size:13px;line-height:1.5;">If the button doesn't work, copy and paste this link into your browser:<br /><a href="${escapeHtml(data.resetUrl)}" style="color:#2563eb;">${escapeHtml(data.resetUrl)}</a></p>
            <p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
        `,
    });
}

export function passwordResetSubject(): string {
    return "Reset your password";
}
