import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "#lib/server/db/index.js";
import { guestOtps } from "#lib/server/db/schema.js";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
    return createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Issues a new OTP for a recipient, invalidating any previous unconsumed ones.
 * Returns the plaintext code (only its hash is stored) + expiry.
 */
export async function createGuestOtp(
    recipientId: string,
    packageId: string,
    email: string,
): Promise<{ code: string; expiresAt: Date }> {
    // Invalidate previous unconsumed codes for this recipient+package.
    await db
        .update(guestOtps)
        .set({ consumedAt: new Date() })
        .where(
            and(
                eq(guestOtps.recipientId, recipientId),
                eq(guestOtps.packageId, packageId),
                isNull(guestOtps.consumedAt),
            ),
        );

    const code = generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await db.insert(guestOtps).values({
        recipientId,
        packageId,
        email,
        codeHash: hashCode(code),
        expiresAt,
    });
    return { code, expiresAt };
}

/** Verifies a code against the latest unconsumed OTP for the recipient. Consumes it on success. */
export async function verifyGuestOtp(
    recipientId: string,
    packageId: string,
    code: string,
): Promise<boolean> {
    const [row] = await db
        .select()
        .from(guestOtps)
        .where(
            and(
                eq(guestOtps.recipientId, recipientId),
                eq(guestOtps.packageId, packageId),
                isNull(guestOtps.consumedAt),
            ),
        )
        .orderBy(desc(guestOtps.createdAt))
        .limit(1);

    if (!row) return false;
    if (row.attempts >= MAX_ATTEMPTS) return false;
    if (row.expiresAt.getTime() < Date.now()) return false;

    if (row.codeHash !== hashCode(code.trim())) {
        await db
            .update(guestOtps)
            .set({ attempts: row.attempts + 1 })
            .where(eq(guestOtps.id, row.id));
        return false;
    }

    await db
        .update(guestOtps)
        .set({ consumedAt: new Date() })
        .where(eq(guestOtps.id, row.id));
    return true;
}
