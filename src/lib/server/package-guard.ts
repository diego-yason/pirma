import { db } from "$lib/server/db";
import { packages } from "$lib/server/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Returns the package if owned by the given user, or null.
 * The caller decides how to handle the failure (redirect, fail, etc.).
 */
export async function requirePackageOwnership(packageId: string, userId: string) {
    const [pkg] = await db
        .select({ id: packages.id })
        .from(packages)
        .where(and(eq(packages.id, packageId), eq(packages.owner, userId)))
        .limit(1);

    return pkg ?? null;
}
