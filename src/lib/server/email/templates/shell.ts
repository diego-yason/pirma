/** Minimal shared HTML shell for transactional emails. Inline CSS only (email-safe). */

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export interface EmailShellOptions {
    /** Used for the <title> and the page <h1> */
    title: string;
    /** Inner HTML for the body of the email */
    body: string;
    /** Optional footer text (e.g. small print) */
    footer?: string;
}

export function emailShell({ title, body, footer }: EmailShellOptions): string {
    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
                    <tr>
                        <td style="padding:32px;">
                            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#18181b;">${escapeHtml(title)}</h1>
                            ${body}
                        </td>
                    </tr>
                    ${
                        footer
                            ? `<tr><td style="padding:16px 32px;background-color:#fafafa;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;line-height:1.5;">${footer}</td></tr>`
                            : ""
                    }
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

/** Inline button style usable inside body markup. */
export const BUTTON =
    "display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;";
