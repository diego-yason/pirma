import { describe, it, expect } from "vitest";
import { escapeHtml, emailShell } from "./shell.js";
import { renderSignerInvite, signerInviteSubject } from "./signer-invite.js";
import { renderGuestOtp, guestOtpSubject } from "./guest-otp.js";
import { renderSigned, signedSubject } from "./signed.js";
import { renderRejected, rejectedSubject } from "./rejected.js";
import { renderExecuted, executedSubject } from "./executed.js";
import { renderPasswordReset, passwordResetSubject } from "./password-reset.js";
import { renderReminder, reminderSubject } from "./reminder.js";

describe("escapeHtml", () => {
    it("escapes &, <, >, double and single quotes", () => {
        expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
    });

    it("escapes HTML injected via user-controlled fields", () => {
        expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
            "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
        );
    });

    it("leaves plain text untouched", () => {
        expect(escapeHtml("plain text 123")).toBe("plain text 123");
    });

    it("neutralises ampersands before other entities (no double-escape of &amp;)", () => {
        expect(escapeHtml("a & b")).toBe("a &amp; b");
    });
});

describe("emailShell", () => {
    it("wraps title in <title> and <h1> and includes the body", () => {
        const html = emailShell({ title: "Hello", body: "<p>World</p>" });
        expect(html).toContain("<title>Hello</title>");
        expect(html).toContain("<h1");
        expect(html).toContain("Hello</h1>");
        expect(html).toContain("<p>World</p>");
    });

    it("escapes the title to prevent injection into <title>/<h1>", () => {
        const html = emailShell({ title: `<script>x</script>`, body: "" });
        expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
        expect(html).not.toContain("<script>x</script>");
    });

    it("renders a footer when provided and omits it otherwise", () => {
        const withFooter = emailShell({ title: "t", body: "", footer: "small print" });
        expect(withFooter).toContain("small print");
        const without = emailShell({ title: "t", body: "" });
        expect(without).not.toContain("small print");
    });

    it("emits a valid <!doctype html> document", () => {
        expect(emailShell({ title: "t", body: "b" }).startsWith("<!doctype html>")).toBe(true);
    });
});

describe("signer-invite template", () => {
    it("renders recipient, sender and package name with an escaped sign URL", () => {
        const html = renderSignerInvite({
            recipientName: "Alice",
            senderName: "Bob",
            packageName: "NDA <2026>",
            signUrl: "https://example.com/doc/1/sign?token=abc",
        });
        expect(html).toContain("Hi Alice");
        expect(html).toContain("Bob has sent you");
        expect(html).toContain("NDA &lt;2026&gt;");
        expect(html).toContain("https://example.com/doc/1/sign?token=abc");
    });

    it("falls back to 'there' when the recipient name is blank", () => {
        const html = renderSignerInvite({
            recipientName: "",
            senderName: null,
            packageName: "P",
            signUrl: "https://x",
        });
        expect(html).toContain("Hi there");
    });

    it("includes the deadline line only when a deadline is present", () => {
        const withDeadline = renderSignerInvite({
            recipientName: null,
            senderName: null,
            packageName: "P",
            signUrl: "https://x",
            deadline: "2026-12-31",
        });
        expect(withDeadline).toContain("Please sign before <strong>2026-12-31</strong>");
        const without = renderSignerInvite({
            recipientName: null,
            senderName: null,
            packageName: "P",
            signUrl: "https://x",
        });
        expect(without).not.toContain("Please sign before");
    });

    it("produces the expected subject", () => {
        expect(signerInviteSubject("NDA")).toBe("Signature requested: NDA");
    });
});

describe("guest-otp template", () => {
    it("renders the code prominently and escapes the name", () => {
        const html = renderGuestOtp({
            name: "O'Reilly",
            code: "123456",
            packageName: "Contract",
            expiresInMinutes: 10,
        });
        expect(html).toContain("Hi O&#39;Reilly");
        expect(html).toContain("123456");
        expect(html).toContain("Contract");
        expect(html).toContain("expires in 10 minutes");
    });

    it("does not echo the code into an attribute unescaped (stays visible but escaped)", () => {
        const html = renderGuestOtp({
            name: null,
            code: "999111",
            packageName: "P",
            expiresInMinutes: 5,
        });
        expect(html).toContain("999111");
    });

    it("produces the expected subject", () => {
        expect(guestOtpSubject()).toBe("Your sign-in code");
    });
});

describe("signed template", () => {
    it("uses signer name, singular vs plural doc count and dashboard link", () => {
        const html = renderSigned({
            signerName: "Alice",
            packageName: "NDA",
            documentCount: 1,
            dashboardUrl: "https://example.com/dash",
        });
        expect(html).toContain("Alice</strong> just signed");
        expect(html).toContain("a document");
        expect(html).toContain("https://example.com/dash");
    });

    it("falls back to signer email / 'A signer' when the name is blank", () => {
        const byEmail = renderSigned({
            signerName: "",
            signerEmail: "alice@x.com",
            packageName: "P",
            documentCount: 2,
            dashboardUrl: "https://x",
        });
        expect(byEmail).toContain("alice@x.com");
        const neither = renderSigned({
            signerName: null,
            packageName: "P",
            documentCount: 2,
            dashboardUrl: "https://x",
        });
        expect(neither).toContain("A signer</strong> just signed");
        expect(neither).toContain("2 documents");
    });

    it("produces the expected subject", () => {
        expect(signedSubject("NDA")).toBe("NDA — signed");
    });
});

describe("rejected template", () => {
    it("renders the rejection reason in a blockquote when present", () => {
        const html = renderRejected({
            signerName: "Alice",
            packageName: "NDA",
            reason: "Clause 4 is unacceptable",
            dashboardUrl: "https://x",
        });
        expect(html).toContain("declined to sign");
        expect(html).toContain("<blockquote");
        expect(html).toContain("Clause 4 is unacceptable");
    });

    it("omits the reason blockquote when there is no reason", () => {
        const html = renderRejected({
            signerName: "Alice",
            packageName: "NDA",
            dashboardUrl: "https://x",
        });
        expect(html).not.toContain("<blockquote");
    });

    it("escapes a reason containing markup", () => {
        const html = renderRejected({
            signerName: "Alice",
            packageName: "NDA",
            reason: `<img src=x onerror=alert(1)>`,
            dashboardUrl: "https://x",
        });
        expect(html).not.toContain("<img src=x onerror=alert(1)>");
        expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    });

    it("produces the expected subject", () => {
        expect(rejectedSubject("NDA")).toBe("NDA — rejected");
    });
});

describe("executed template", () => {
    it("renders the owner copy with 'fully signed' phrasing", () => {
        const html = renderExecuted({
            packageName: "NDA",
            documentCount: 3,
            role: "owner",
            dashboardUrl: "https://x",
        });
        expect(html).toContain("is fully signed");
        expect(html).toContain("All parties have completed");
        expect(html).toContain("https://x");
    });

    it("renders the signer copy with recipient name and doc count", () => {
        const html = renderExecuted({
            recipientName: "Alice",
            packageName: "NDA",
            documentCount: 1,
            role: "signer",
        });
        expect(html).toContain("Hi Alice");
        expect(html).toContain("It's complete (1 document)");
        expect(html).not.toContain("View in dashboard"); // no dashboardUrl → no button
    });

    it("escapes the recipient name", () => {
        const html = renderExecuted({
            recipientName: "<b>Bob</b>",
            packageName: "NDA",
            documentCount: 1,
            role: "signer",
        });
        expect(html).not.toContain("<b>Bob</b>");
        expect(html).toContain("&lt;b&gt;Bob&lt;/b&gt;");
    });

    it("produces the expected subject", () => {
        expect(executedSubject("NDA")).toBe("NDA — fully signed");
    });
});

describe("password-reset template", () => {
    it("renders the reset URL in both button and text link", () => {
        const html = renderPasswordReset({
            name: "Alice",
            resetUrl: "https://example.com/reset?token=abc",
        });
        expect(html).toContain("Reset your password");
        expect(html).toContain("https://example.com/reset?token=abc");
        expect(html).toContain("Hi Alice");
    });

    it("escapes a hostile reset URL value", () => {
        const html = renderPasswordReset({
            name: null,
            resetUrl: `https://evil.com/" onmouseover="alert(1)`,
        });
        expect(html).not.toContain(`" onmouseover="alert(1)`);
    });

    it("produces the expected subject", () => {
        expect(passwordResetSubject()).toBe("Reset your password");
    });
});

describe("reminder template", () => {
    it("renders recipient, package name, sign URL and sender footer", () => {
        const html = renderReminder({
            recipientName: "Alice",
            senderName: "Bob",
            packageName: "NDA",
            signUrl: "https://example.com/doc/1/sign?token=abc",
        });
        expect(html).toContain("Hi Alice");
        expect(html).toContain("still waiting on your signature");
        expect(html).toContain("NDA");
        expect(html).toContain("https://example.com/doc/1/sign?token=abc");
        expect(html).toContain("Bob sent you a signing request");
    });

    it("includes the deadline only when present", () => {
        const withDeadline = renderReminder({
            recipientName: null,
            senderName: null,
            packageName: "P",
            signUrl: "https://x",
            deadline: "2026-12-31",
        });
        expect(withDeadline).toContain("2026-12-31");
        const without = renderReminder({
            recipientName: null,
            senderName: null,
            packageName: "P",
            signUrl: "https://x",
        });
        expect(without).not.toContain("2026-12-31");
    });

    it("escapes the sender name in the footer", () => {
        const html = renderReminder({
            recipientName: null,
            senderName: `<script>`,
            packageName: "P",
            signUrl: "https://x",
        });
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
    });

    it("produces the expected subject", () => {
        expect(reminderSubject("NDA")).toBe("Reminder: please sign NDA");
    });
});
