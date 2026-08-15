/**
 * Key rotation policy — determines whether a signing key should be rotated.
 *
 * Each check returns a reason string if rotation is needed, or null if the key
 * is still within policy limits. All checks must pass for a key to be considered
 * valid; the first failing check wins.
 *
 * Defaults are conservative. Adjust via environment variables:
 *   KEY_MAX_AGE_DAYS     — max days since creation (default 180)
 *   KEY_MAX_IDLE_DAYS    — max days since last use (default 90)
 *   KEY_MAX_SIGNATURES   — max signatures before rotation (default 500)
 *   KEY_ALLOWED_ALGORITHMS — comma-separated, e.g. "ECDSA-P256,ECDSA-P384"
 */

import { db } from "#lib/server/db/index.js";
import { signatures, cryptoKeys } from "#lib/server/db/schema.js";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";

// ── Config from environment ──────────────────────────────────────

import {
    KEY_ALLOWED_ALGORITHMS,
    KEY_MAX_AGE_DAYS,
    KEY_MAX_IDLE_DAYS,
    KEY_MAX_SIGNATURES,
} from "$app/env/private";

const MAX_AGE_DAYS = Number(KEY_MAX_AGE_DAYS) || 180;
const MAX_IDLE_DAYS = Number(KEY_MAX_IDLE_DAYS) || 90;
const MAX_SIGNATURES = Number(KEY_MAX_SIGNATURES) || 500;
const ALLOWED_ALGORITHMS = (KEY_ALLOWED_ALGORITHMS ?? "ECDSA-P256").split(",").map((s) => s.trim());

// ── Result type ──────────────────────────────────────────────────

export interface RotationResult {
    needsRotation: boolean;
    /** Human-readable reason, e.g. "Key is 200 days old (max 180)" */
    reason: string | null;
    /** Which check triggered the rotation */
    check: "age" | "idle" | "usage" | "algorithm" | null;
}

// ── Checks ───────────────────────────────────────────────────────

function checkAge(createdAt: Date): RotationResult | null {
    const days = (Date.now() - createdAt.getTime()) / 86_400_000;
    if (days > MAX_AGE_DAYS) {
        return {
            needsRotation: true,
            reason: `Key is ${Math.round(days)} days old (max ${MAX_AGE_DAYS})`,
            check: "age",
        };
    }
    return null;
}

function checkIdle(lastUsedAt: Date | null): RotationResult | null {
    if (!lastUsedAt) return null; // never used — no idle concern
    const days = (Date.now() - lastUsedAt.getTime()) / 86_400_000;
    if (days > MAX_IDLE_DAYS) {
        return {
            needsRotation: true,
            reason: `Key unused for ${Math.round(days)} days (max ${MAX_IDLE_DAYS})`,
            check: "idle",
        };
    }
    return null;
}

function checkAlgorithm(algorithm: string): RotationResult | null {
    if (!ALLOWED_ALGORITHMS.includes(algorithm)) {
        return {
            needsRotation: true,
            reason: `Algorithm "${algorithm}" is not in allowed list [${ALLOWED_ALGORITHMS.join(", ")}]`,
            check: "algorithm",
        };
    }
    return null;
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Check a single key row against the rotation policy.
 * Synchronous checks only (age, idle, algorithm).
 */
export function checkKeyPolicy(key: {
    createdAt: Date;
    lastUsedAt: Date | null;
    algorithm: string;
}): RotationResult {
    return (
        checkAge(key.createdAt) ??
        checkIdle(key.lastUsedAt) ??
        checkAlgorithm(key.algorithm) ?? { needsRotation: false, reason: null, check: null }
    );
}

/**
 * Check a key against the rotation policy, including usage count from the DB.
 * Call this when you already have a key ID and want the full check.
 */
export async function checkKeyUsage(keyId: string): Promise<RotationResult> {
    const [count] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(signatures)
        .where(
            and(
                eq(signatures.cryptoKey, keyId),
                inArray(signatures.status, ["signed", "anchored"]),
            ),
        );
    const usageCount = count?.count ?? 0;
    if (usageCount >= MAX_SIGNATURES) {
        return {
            needsRotation: true,
            reason: `Key used ${usageCount} times (max ${MAX_SIGNATURES})`,
            check: "usage",
        };
    }

    return { needsRotation: false, reason: null, check: null };
}

/**
 * Full rotation check for a user's active (non-revoked) key.
 * Pass `keyLevel` to scope the check to a specific tier (e.g. 2 for the
 * persistent password-bound key). Returns the first policy violation, or null
 * if the key is fine.
 *
 * Usage example in a load function:
 * ```ts
 * import { checkKeyRotation } from "#lib/server/key-rotation";
 * const rotation = await checkKeyRotation(userId, 2);
 * if (rotation) { /* warn the user *&#47; }
 * ```
 */
export async function checkKeyRotation(
    userId: string,
    keyLevel?: number,
): Promise<RotationResult | null> {
    const [key] = await db
        .select({
            id: cryptoKeys.id,
            createdAt: cryptoKeys.createdAt,
            lastUsedAt: cryptoKeys.lastUsedAt,
            algorithm: cryptoKeys.algorithm,
        })
        .from(cryptoKeys)
        .where(
            and(
                eq(cryptoKeys.userId, userId),
                isNull(cryptoKeys.revokedAt),
                keyLevel ? eq(cryptoKeys.keyLevel, keyLevel) : undefined,
            ),
        )
        .limit(1);

    if (!key) return null; // no active key at all

    // 1. Synchronous policy checks (no extra DB query)
    const policyResult = checkKeyPolicy(key);
    if (policyResult.needsRotation) return policyResult;

    // 2. Usage count (needs a DB query on signatures)
    const usageResult = await checkKeyUsage(key.id);
    if (usageResult.needsRotation) return usageResult;

    return null; // key is within policy
}
