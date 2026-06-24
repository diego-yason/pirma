/**
 * Simple dev logger with consistent formatting.
 *
 * Usage:
 *   import { log } from "$lib/server/logger";
 *   log.info("uploadFile", "Processing file", { name: "doc.pdf", size: 1024 });
 *   log.warn("uploadFile", "File too large", file.size);
 *   log.error("uploadFile", "Upload failed", err);
 */

type Level = "debug" | "info" | "warn" | "error";

const PAD = 7; // longest level string + some padding

function timestamp(): string {
    return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

function formatMessage(level: Level, action: string, message: string, ...args: unknown[]): string {
    const prefix = `[${timestamp()}] [${level.toUpperCase().padEnd(PAD)}] [${action}]`;
    const extra = args.length > 0 ? " " + args.map(serializeArg).join(" ") : "";
    return `${prefix} ${message}${extra}`;
}

function serializeArg(arg: unknown): string {
    if (arg instanceof Error) {
        return arg.stack ?? arg.message;
    }
    if (typeof arg === "object" && arg !== null) {
        try {
            return JSON.stringify(arg, null, 0);
        } catch {
            return String(arg);
        }
    }
    return String(arg);
}

function log(level: Level, action: string, message: string, ...args: unknown[]): void {
    const formatted = formatMessage(level, action, message, ...args);
    switch (level) {
        case "debug":
            console.debug(formatted);
            break;
        case "info":
            console.log(formatted);
            break;
        case "warn":
            console.warn(formatted);
            break;
        case "error":
            console.error(formatted);
            break;
    }
}

export const logger = {
    debug(action: string, message: string, ...args: unknown[]) {
        log("debug", action, message, ...args);
    },
    info(action: string, message: string, ...args: unknown[]) {
        log("info", action, message, ...args);
    },
    warn(action: string, message: string, ...args: unknown[]) {
        log("warn", action, message, ...args);
    },
    error(action: string, message: string, ...args: unknown[]) {
        log("error", action, message, ...args);
    },
};
