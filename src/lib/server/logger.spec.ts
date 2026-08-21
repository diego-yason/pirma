import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock pino so tests capture the config passed to pino() and the exact
// (fields, message) pairs handed to each level method — no real stdout.
// `pinoOptions` is a mutable holder: the mock writes into it at module load
// time (after this spec's top-level code runs), so tests read it lazily.
const { pinoMock, mockLogger, pinoOptions } = vi.hoisted(() => {
    const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
    const pinoOptions: { current: unknown } = { current: undefined };
    const pinoMock = vi.fn((opts: unknown) => {
        pinoOptions.current = opts;
        return mockLogger;
    });
    return { pinoMock, mockLogger, pinoOptions };
});

vi.mock("pino", () => ({ pino: pinoMock }));

import { logger } from "./logger";

function capturedOptions(): { redact: { paths: string[]; censor: string } } {
    return pinoOptions.current as { redact: { paths: string[]; censor: string } };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("logger structured output", () => {
    it("emits the action as a structured field with object args spread in", () => {
        logger.info("sign", "Signed document", { docId: "doc-1", count: 2 });
        expect(mockLogger.info).toHaveBeenCalledWith(
            { action: "sign", docId: "doc-1", count: 2 },
            "Signed document",
        );
    });

    it("passes an Error arg as the err field", () => {
        const err = new Error("boom");
        logger.error("sign", "Signing failed", err);
        expect(mockLogger.error).toHaveBeenCalledWith({ action: "sign", err }, "Signing failed");
    });

    it("names bare primitive args arg0, arg1, …", () => {
        logger.warn("upload", "Odd value", 42, "why");
        expect(mockLogger.warn).toHaveBeenCalledWith(
            { action: "upload", arg0: 42, arg1: "why" },
            "Odd value",
        );
    });

    it("routes to the correct level method", () => {
        logger.debug("a", "d");
        logger.info("b", "i");
        logger.warn("c", "w");
        logger.error("d", "e");
        expect(mockLogger.debug).toHaveBeenCalledTimes(1);
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });

    it("keeps later object args merging over earlier ones", () => {
        logger.info("x", "msg", { a: 1 }, { a: 2, b: 3 });
        expect(mockLogger.info).toHaveBeenCalledWith({ action: "x", a: 2, b: 3 }, "msg");
    });
});

describe("logger redaction config", () => {
    it("is passed to pino with a censor value", () => {
        expect(capturedOptions().redact.censor).toBe("[REDACTED]");
    });

    it("redacts signing tokens and URLs that carry them", () => {
        const paths = capturedOptions().redact.paths;
        for (const p of [
            "signingUrl",
            "*.signingUrl",
            "**.signingUrl",
            "token",
            "*.token",
            "**.token",
        ]) {
            expect(paths).toContain(p);
        }
    });

    it("redacts codes, nonces, passwords, signatures and credentials", () => {
        const paths = capturedOptions().redact.paths;
        for (const p of [
            "code",
            "nonce",
            "password",
            "signature",
            "authorization",
            "cookie",
            "set-cookie",
            "apiKey",
        ]) {
            expect(paths.some((path) => path === p || path === `*.${p}` || path === `**.${p}`)).toBe(
                true,
            );
        }
    });
});
