import { describe, it, expect, vi, beforeEach } from "vitest";

// providers.ts reads EMAIL_PROVIDER / EMAIL_FROM / RESEND_API_KEY / SMTP_* from the
// $app/env/private virtual module. Mock it so each test can pick a provider.
const env = vi.hoisted(() => {
    let current: Record<string, string | undefined> = {};
    return {
        set(values: Record<string, string | undefined>) {
            current = values;
        },
        get values() {
            return current;
        },
    };
});

vi.mock("$app/env/private", () => ({
    get EMAIL_PROVIDER() {
        return env.values.EMAIL_PROVIDER;
    },
    get EMAIL_FROM() {
        return env.values.EMAIL_FROM;
    },
    get RESEND_API_KEY() {
        return env.values.RESEND_API_KEY;
    },
    get SMTP_HOST() {
        return env.values.SMTP_HOST;
    },
    get SMTP_PORT() {
        return env.values.SMTP_PORT;
    },
    get SMTP_USER() {
        return env.values.SMTP_USER;
    },
    get SMTP_PASS() {
        return env.values.SMTP_PASS;
    },
    get SMTP_SECURE() {
        return env.values.SMTP_SECURE;
    },
    get SMTP_IGNORE_TLS() {
        return env.values.SMTP_IGNORE_TLS;
    },
}));

const { loggerMock } = vi.hoisted(() => ({
    loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("#lib/server/logger.js", () => ({ logger: loggerMock }));

// Mock nodemailer so the SMTP provider never opens a real socket.
const { createTransportMock, transportMock } = vi.hoisted(() => {
    const transportMock = {
        sendMail: vi.fn().mockResolvedValue({ messageId: "test-id" }),
        close: vi.fn(),
    };
    const createTransportMock = vi.fn(() => transportMock);
    return { createTransportMock, transportMock };
});
vi.mock("nodemailer", () => ({ createTransport: createTransportMock }));

import { getProvider, type EmailProvider } from "./providers";

beforeEach(() => {
    vi.clearAllMocks();
    env.set({
        EMAIL_PROVIDER: undefined,
        EMAIL_FROM: undefined,
        RESEND_API_KEY: undefined,
        SMTP_HOST: undefined,
        SMTP_PORT: undefined,
        SMTP_USER: undefined,
        SMTP_PASS: undefined,
        SMTP_SECURE: undefined,
        SMTP_IGNORE_TLS: undefined,
    });
});

describe("getProvider", () => {
    it("returns the console provider when EMAIL_PROVIDER is unset", () => {
        const provider = getProvider();
        expect(provider).toBeTruthy();
        expect(typeof provider.send).toBe("function");
    });

    it("returns the console provider for the 'console' value", () => {
        env.set({ EMAIL_PROVIDER: "console" });
        expect(getProvider()).toBeTruthy();
    });

    it("returns the resend provider for the 'resend' value", () => {
        env.set({ EMAIL_PROVIDER: "resend" });
        expect(getProvider()).toBeTruthy();
    });

    it("falls back to console (with a warning) for an unknown provider", () => {
        env.set({ EMAIL_PROVIDER: "sendgrid" });
        expect(getProvider()).toBeTruthy();
        expect(loggerMock.warn).toHaveBeenCalledWith(
            "email",
            'Unknown EMAIL_PROVIDER "sendgrid" — falling back to console',
            { provider: "sendgrid" },
        );
    });

    it("does not warn for an empty/unset provider", () => {
        getProvider();
        expect(loggerMock.warn).not.toHaveBeenCalled();
    });
});

describe("console provider", () => {
    it("logs metadata only — never the html/text body (EMR-01)", async () => {
        env.set({ EMAIL_PROVIDER: "console" });
        const provider: EmailProvider = getProvider();
        const html = "<html><body>signingUrl=https://x/token=SECRET</body></html>";
        const text = "token=SECRET plain text";
        await provider.send({ to: "a@x.com", subject: "S", html, text });

        const call = loggerMock.info.mock.calls[0]!;
        expect(call[0]).toBe("email");
        expect(call[1]).toBe("Console email (not sent)");
        const fields = call[2] as Record<string, unknown>;
        expect(fields).toMatchObject({
            to: "a@x.com",
            subject: "S",
            htmlBytes: html.length,
            textBytes: text.length,
        });
        // Ensure the body content never leaks into the log record.
        expect(JSON.stringify(fields)).not.toContain("SECRET");
        expect(JSON.stringify(fields)).not.toContain("<html>");
    });
});

describe("resend provider", () => {
    it("throws when RESEND_API_KEY is missing", async () => {
        env.set({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: undefined });
        const provider: EmailProvider = getProvider();
        await expect(
            provider.send({ to: "a@x.com", subject: "S", html: "<p>hi</p>" }),
        ).rejects.toThrow("RESEND_API_KEY is not set");
    });

    it("POSTs to the Resend API with the auth header and payload", async () => {
        env.set({
            EMAIL_PROVIDER: "resend",
            RESEND_API_KEY: "re_test",
            EMAIL_FROM: "Pirma <noreply@pirma.test>",
        });
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
        });
        vi.stubGlobal("fetch", fetchMock);

        const provider: EmailProvider = getProvider();
        await provider.send({ to: "a@x.com", subject: "S", html: "<p>hi</p>", text: "hi" });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://api.resend.com/emails");
        expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
        const body = JSON.parse(init.body as string) as Record<string, unknown>;
        expect(body).toMatchObject({
            from: "Pirma <noreply@pirma.test>",
            to: ["a@x.com"],
            subject: "S",
            html: "<p>hi</p>",
            text: "hi",
        });
        vi.unstubAllGlobals();
    });

    it("throws a descriptive error on a non-OK response", async () => {
        env.set({
            EMAIL_PROVIDER: "resend",
            RESEND_API_KEY: "re_test",
            EMAIL_FROM: "x@x.test",
        });
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 422,
            text: async () => '{"message":"bad"}',
        });
        vi.stubGlobal("fetch", fetchMock);

        const provider: EmailProvider = getProvider();
        await expect(
            provider.send({ to: "a@x.com", subject: "S", html: "<p>hi</p>" }),
        ).rejects.toThrow(/Resend error 422/);
        vi.unstubAllGlobals();
    });
});

describe("getProvider (smtp)", () => {
    it("returns the smtp provider for the 'smtp' value", () => {
        env.set({ EMAIL_PROVIDER: "smtp" });
        expect(getProvider()).toBeTruthy();
    });
});

describe("smtp provider", () => {
    it("throws when SMTP_HOST is missing", async () => {
        env.set({ EMAIL_PROVIDER: "smtp", SMTP_HOST: undefined });
        const provider: EmailProvider = getProvider();
        await expect(
            provider.send({ to: "a@x.com", subject: "S", html: "<p>hi</p>" }),
        ).rejects.toThrow("SMTP_HOST is not set");
        expect(createTransportMock).not.toHaveBeenCalled();
    });

    it("creates a transport with the given host and sends the message", async () => {
        env.set({
            EMAIL_PROVIDER: "smtp",
            SMTP_HOST: "smtp.example.com",
            EMAIL_FROM: "Pirma <noreply@pirma.test>",
        });
        const provider: EmailProvider = getProvider();
        await provider.send({ to: "a@x.com", subject: "S", html: "<p>hi</p>", text: "hi" });

        expect(createTransportMock).toHaveBeenCalledTimes(1);
        expect(createTransportMock).toHaveBeenCalledWith(
            expect.objectContaining({
                host: "smtp.example.com",
                port: 587, // default when SMTP_PORT unset
                secure: false,
                ignoreTLS: false,
            }),
        );
        expect(transportMock.sendMail).toHaveBeenCalledTimes(1);
        expect(transportMock.sendMail).toHaveBeenCalledWith({
            from: "Pirma <noreply@pirma.test>",
            to: "a@x.com",
            subject: "S",
            html: "<p>hi</p>",
            text: "hi",
        });
        expect(transportMock.close).toHaveBeenCalledTimes(1);
    });

    it("uses SMTP_PORT and SMTP_SECURE=true for implicit TLS (port 465)", async () => {
        env.set({
            EMAIL_PROVIDER: "smtp",
            SMTP_HOST: "smtp.example.com",
            SMTP_PORT: "465",
            SMTP_SECURE: "true",
        });
        const provider: EmailProvider = getProvider();
        await provider.send({ to: "a@x.com", subject: "S", html: "<p>hi</p>" });

        expect(createTransportMock).toHaveBeenCalledWith(
            expect.objectContaining({ host: "smtp.example.com", port: 465, secure: true }),
        );
    });

    it("honours SMTP_IGNORE_TLS=true", async () => {
        env.set({
            EMAIL_PROVIDER: "smtp",
            SMTP_HOST: "localhost",
            SMTP_IGNORE_TLS: "true",
        });
        const provider: EmailProvider = getProvider();
        await provider.send({ to: "a@x.com", subject: "S", html: "<p>hi</p>" });

        expect(createTransportMock).toHaveBeenCalledWith(
            expect.objectContaining({ host: "localhost", ignoreTLS: true }),
        );
    });

    it("adds auth credentials when SMTP_USER is set", async () => {
        env.set({
            EMAIL_PROVIDER: "smtp",
            SMTP_HOST: "smtp.example.com",
            SMTP_USER: "user@example.com",
            SMTP_PASS: "secret",
        });
        const provider: EmailProvider = getProvider();
        await provider.send({ to: "a@x.com", subject: "S", html: "<p>hi</p>" });

        expect(createTransportMock).toHaveBeenCalledWith(
            expect.objectContaining({
                auth: { user: "user@example.com", pass: "secret" },
            }),
        );
    });

    it("omits auth when SMTP_USER is unset", async () => {
        env.set({
            EMAIL_PROVIDER: "smtp",
            SMTP_HOST: "smtp.example.com",
        });
        const provider: EmailProvider = getProvider();
        await provider.send({ to: "a@x.com", subject: "S", html: "<p>hi</p>" });

        expect(createTransportMock).toHaveBeenCalledWith(
            expect.objectContaining({ auth: undefined }),
        );
    });

    it("omits text from the mail when not provided", async () => {
        env.set({
            EMAIL_PROVIDER: "smtp",
            SMTP_HOST: "smtp.example.com",
        });
        const provider: EmailProvider = getProvider();
        await provider.send({ to: "a@x.com", subject: "S", html: "<p>hi</p>" });

        expect(transportMock.sendMail).toHaveBeenCalledWith(
            expect.not.objectContaining({ text: expect.anything() }),
        );
    });
});
