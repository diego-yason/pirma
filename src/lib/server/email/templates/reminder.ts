import { emailShell, escapeHtml, BUTTON } from "./shell.js";

export interface ReminderData {
    recipientName: string | null;
    senderName: string | null;
    packageName: string;
    signUrl: string;
    deadline?: string | null;
}

export function renderReminder(data: ReminderData): string {
    const recipient = data.recipientName?.trim() ? data.recipientName : "there";
    const deadline = data.deadline
        ? `<p style="margin:0 0 16px;color:#3f3f46;font-size:15px;">Please sign before <strong>${escapeHtml(data.deadline)}</strong>.</p>`
        : "";
    return emailShell({
        title: `Reminder: ${data.packageName} is waiting on your signature`,
        body: `
            <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">Hi ${escapeHtml(recipient)},</p>
            <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">Just a friendly reminder that <strong>${escapeHtml(data.packageName)}</strong> is still waiting on your signature.</p>
            ${deadline}
            <p style="margin:24px 0;">
                <a href="${escapeHtml(data.signUrl)}" style="${BUTTON}">Review &amp; sign</a>
            </p>
            <p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">If the button doesn't work, copy and paste this link into your browser:<br /><a href="${escapeHtml(data.signUrl)}" style="color:#2563eb;">${escapeHtml(data.signUrl)}</a></p>
        `,
        footer: `You're receiving this because ${escapeHtml(data.senderName ?? "someone")} sent you a signing request.`,
    });
}

export function reminderSubject(packageName: string): string {
    return `Reminder: please sign ${packageName}`;
}
