import { db } from "$lib/server/db";
import { packages } from "$lib/server/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "$lib/server/logger";

/**
 * Returns the package if owned by the given user, or null.
 * The caller decides how to handle the failure (redirect, fail, etc.).
 */
export async function requirePackageOwnership(packageId: string, userId: string) {
    try {
        const [pkg] = await db
            .select({ id: packages.id })
            .from(packages)
            .where(and(eq(packages.id, packageId), eq(packages.owner, userId)))
            .limit(1);

        if (!pkg) {
            logger.warn("packageGuard", "Package not found or not owned", { packageId, userId });
        }

        return pkg ?? null;
    } catch (err) {
        logger.error("packageGuard", "DB query failed", { packageId, userId, error: err });
        throw err;
    }
}
