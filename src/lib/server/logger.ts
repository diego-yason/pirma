/**
 * Structured logger backed by pino.
 *
 * Keeps the existing call-site API:
 *   import { logger } from "#lib/server/logger.js";
 *   logger.info("uploadFile", "Processing file", { name: "doc.pdf", size: 1024 });
 *   logger.warn("uploadFile", "File too large", { size });
 *   logger.error("uploadFile", "Upload failed", err);
 *
 * - `action` is emitted as a structured field.
 * - Object args are spread into the log record as structured fields.
 * - `Error` args are attached as pino's `err` (stack is serialized).
 * - Sensitive fields (tokens, codes, nonces, signatures, passwords, URLs that
 *   carry tokens, authorization headers, cookies) are redacted centrally.
 *
 * Output: JSON lines (stdout) in production; `pino-pretty` in dev.
 * Level: LOG_LEVEL (defaults to `info` in production, `debug` otherwise).
 */

import { pino } from "pino";

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug");

const pinoLogger = pino({
    level,
    redact: {
        paths: [
            "signingUrl",
            "*.signingUrl",
            "**.signingUrl",
            "token",
            "*.token",
            "**.token",
            "code",
            "*.code",
            "**.code",
            "nonce",
            "*.nonce",
            "**.nonce",
            "password",
            "*.password",
            "**.password",
            "signature",
            "*.signature",
            "**.signature",
            "authorization",
            "*.authorization",
            "cookie",
            "set-cookie",
            "apiKey",
            "*.apiKey",
        ],
        censor: "[REDACTED]",
    },
    transport:
        process.env.NODE_ENV === "production"
            ? undefined
            : {
                  target: "pino-pretty",
                  options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
              },
});

type Level = "debug" | "info" | "warn" | "error";

function write(level: Level, action: string, message: string, args: unknown[]): void {
    const fields: Record<string, unknown> = { action };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg instanceof Error) {
            fields.err = arg;
        } else if (arg !== null && typeof arg === "object") {
            Object.assign(fields, arg);
        } else {
            fields[`arg${i}`] = arg;
        }
    }
    pinoLogger[level](fields, message);
}

export const logger = {
    debug(action: string, message: string, ...args: unknown[]) {
        write("debug", action, message, args);
    },
    info(action: string, message: string, ...args: unknown[]) {
        write("info", action, message, args);
    },
    warn(action: string, message: string, ...args: unknown[]) {
        write("warn", action, message, args);
    },
    error(action: string, message: string, ...args: unknown[]) {
        write("error", action, message, args);
    },
};
