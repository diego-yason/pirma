import { describe, it, expect, vi, beforeEach } from "vitest";

// Env values come from the committed `.env.test` file: Vitest runs in mode="test", so the
// SvelteKit plugin bakes `.env.test` into `$app/env/private`. That covers the KEY_* policy
// vars used here and the DATABASE_URL that #lib/server/db/index.js reads at import time.

// Stub the DB so the async checks (checkKeyUsage / checkKeyRotation) never hit a real
// database. `makeQuery` returns a fluent drizzle-style chain that resolves `finalResult`.
const { db, makeQuery } = vi.hoisted(() => {
    const db = { select: vi.fn() };

    function makeQuery(finalResult: unknown) {
        const query = {
            from: vi.fn(() => query),
            where: vi.fn(() => query),
            limit: vi.fn(() => Promise.resolve(finalResult)),
            // thenable so `await … .where()` (checkKeyUsage) resolves the final result
            then: (onFulfilled: (v: unknown) => unknown) =>
                Promise.resolve(finalResult).then(onFulfilled),
        };
        return query;
    }

    return { db, makeQuery };
});

vi.mock("#lib/server/db/index.js", () => ({ db }));

import { checkKeyPolicy, checkKeyUsage, checkKeyRotation } from "./key-rotation";

const DAY = 86_400_000;
const now = Date.now();

const freshKey = {
    createdAt: new Date(now - DAY),
    lastUsedAt: new Date(now - DAY / 2),
    algorithm: "ECDSA-P256",
};

describe("checkKeyPolicy", () => {
    it("returns no rotation for a fresh, recently-used, allowed key", () => {
        expect(checkKeyPolicy(freshKey)).toEqual({
            needsRotation: false,
            reason: null,
            check: null,
        });
    });

    it("flags a key older than MAX_AGE_DAYS with check 'age'", () => {
        const result = checkKeyPolicy({
            ...freshKey,
            createdAt: new Date(now - 181 * DAY),
        });
        expect(result.needsRotation).toBe(true);
        expect(result.check).toBe("age");
        expect(result.reason).toContain("days old");
    });

    it("does not flag a key within the age limit", () => {
        const result = checkKeyPolicy({
            ...freshKey,
            createdAt: new Date(now - 179 * DAY),
        });
        expect(result.needsRotation).toBe(false);
    });

    it("flags an idle key (unused past MAX_IDLE_DAYS) with check 'idle'", () => {
        const result = checkKeyPolicy({
            ...freshKey,
            lastUsedAt: new Date(now - 91 * DAY),
        });
        expect(result.needsRotation).toBe(true);
        expect(result.check).toBe("idle");
        expect(result.reason).toContain("unused for");
    });

    it("does not flag a never-used key as idle", () => {
        const result = checkKeyPolicy({ ...freshKey, lastUsedAt: null });
        expect(result.needsRotation).toBe(false);
    });

    it("flags a disallowed algorithm with check 'algorithm'", () => {
        const result = checkKeyPolicy({ ...freshKey, algorithm: "RSA-2048" });
        expect(result.needsRotation).toBe(true);
        expect(result.check).toBe("algorithm");
        expect(result.reason).toContain("not in allowed list");
    });

    it("accepts any algorithm in the allowlist", () => {
        const result = checkKeyPolicy({ ...freshKey, algorithm: "ECDSA-P384" });
        expect(result.needsRotation).toBe(false);
    });

    it("returns the FIRST failing check — age wins over idle", () => {
        const result = checkKeyPolicy({
            createdAt: new Date(now - 181 * DAY),
            lastUsedAt: new Date(now - 91 * DAY),
            algorithm: "ECDSA-P256",
        });
        expect(result.check).toBe("age");
    });

    it("returns the FIRST failing check — idle wins over algorithm", () => {
        const result = checkKeyPolicy({
            createdAt: new Date(now - DAY),
            lastUsedAt: new Date(now - 91 * DAY),
            algorithm: "RSA-2048",
        });
        expect(result.check).toBe("idle");
    });
});

const activeKey = {
    id: "key-abc",
    createdAt: new Date(now - DAY),
    lastUsedAt: new Date(now - DAY / 2),
    algorithm: "ECDSA-P256",
};

describe("checkKeyUsage", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("does not rotate with 0 signatures", async () => {
        db.select.mockReturnValue(makeQuery([{ count: 0 }]));
        const result = await checkKeyUsage("key-abc");
        expect(result.needsRotation).toBe(false);
    });

    it("does not rotate below MAX_SIGNATURES", async () => {
        db.select.mockReturnValue(makeQuery([{ count: 499 }]));
        const result = await checkKeyUsage("key-abc");
        expect(result.needsRotation).toBe(false);
    });

    it("rotates at exactly MAX_SIGNATURES (500)", async () => {
        db.select.mockReturnValue(makeQuery([{ count: 500 }]));
        const result = await checkKeyUsage("key-abc");
        expect(result.needsRotation).toBe(true);
        expect(result.check).toBe("usage");
        expect(result.reason).toContain("used 500 times");
    });

    it("rotates above MAX_SIGNATURES", async () => {
        db.select.mockReturnValue(makeQuery([{ count: 1200 }]));
        const result = await checkKeyUsage("key-abc");
        expect(result.check).toBe("usage");
    });
});

describe("checkKeyRotation", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("returns null when the user has no active key", async () => {
        db.select.mockReturnValue(makeQuery([]));
        const result = await checkKeyRotation("user-1");
        expect(result).toBeNull();
    });

    it("returns null when the active key is within policy and usage", async () => {
        db.select
            .mockReturnValueOnce(makeQuery([activeKey]))
            .mockReturnValueOnce(makeQuery([{ count: 3 }]));
        const result = await checkKeyRotation("user-1");
        expect(result).toBeNull();
    });

    it("short-circuits on a policy violation (no usage query)", async () => {
        const oldKey = { ...activeKey, createdAt: new Date(now - 181 * DAY) };
        db.select.mockReturnValue(makeQuery([oldKey]));
        const result = await checkKeyRotation("user-1");
        expect(result?.check).toBe("age");
        expect(db.select).toHaveBeenCalledTimes(1); // only the key lookup ran
    });

    it("rotates when usage exceeds MAX_SIGNATURES", async () => {
        db.select
            .mockReturnValueOnce(makeQuery([activeKey]))
            .mockReturnValueOnce(makeQuery([{ count: 900 }]));
        const result = await checkKeyRotation("user-1");
        expect(result?.check).toBe("usage");
        expect(db.select).toHaveBeenCalledTimes(2); // key lookup + usage count
    });

    it("limits the key lookup to the first row", async () => {
        db.select.mockReturnValue(makeQuery([activeKey]));
        await checkKeyRotation("user-1");
        const limitFn = db.select.mock.results[0]!.value.limit;
        expect(limitFn).toHaveBeenCalledWith(1);
    });
});
