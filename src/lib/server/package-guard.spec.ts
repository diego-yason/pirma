import { describe, it, expect, vi, beforeEach } from "vitest";

// DB-mock pattern (see docs/ai/testing.md §3): stub the DB module so no real
// connection is attempted. `makeQuery` returns a fluent drizzle-style chain.
const { db, makeQuery, makeRejectingQuery, loggerMock } = vi.hoisted(() => {
    const db = { select: vi.fn() };
    const loggerMock = {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    };

    function makeQuery(finalResult: unknown) {
        const query = {
            from: vi.fn(() => query),
            where: vi.fn(() => query),
            limit: vi.fn(() => Promise.resolve(finalResult)),
        };
        return query;
    }

    // Query whose `limit()` rejects — for the DB-failure path.
    function makeRejectingQuery(err: Error) {
        const query = {
            from: vi.fn(() => query),
            where: vi.fn(() => query),
            limit: vi.fn(() => Promise.reject(err)),
        };
        return query;
    }

    return { db, makeQuery, makeRejectingQuery, loggerMock };
});

vi.mock("#lib/server/db/index.js", () => ({ db }));
vi.mock("#lib/server/logger.js", () => ({ logger: loggerMock }));

import { requirePackageOwnership } from "./package-guard";

describe("requirePackageOwnership", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("returns the package when it is owned by the user", async () => {
        db.select.mockReturnValue(makeQuery([{ id: "pkg-1" }]));
        const result = await requirePackageOwnership("pkg-1", "user-1");
        expect(result).toEqual({ id: "pkg-1" });
        expect(loggerMock.warn).not.toHaveBeenCalled();
    });

    it("returns null (no warn) when the package exists but is not owned", async () => {
        db.select.mockReturnValue(makeQuery([]));
        const result = await requirePackageOwnership("pkg-1", "user-2");
        expect(result).toBeNull();
    });

    it("returns null and warns when the package is missing entirely", async () => {
        db.select.mockReturnValue(makeQuery([]));
        const result = await requirePackageOwnership("nope", "user-1");
        expect(result).toBeNull();
        expect(loggerMock.warn).toHaveBeenCalledWith(
            "packageGuard",
            "Package not found or not owned",
            { packageId: "nope", userId: "user-1" },
        );
    });

    it("queries by package id AND owner id", async () => {
        db.select.mockReturnValue(makeQuery([]));
        await requirePackageOwnership("pkg-9", "user-9");
        // The drizzle stub exposes the where() call; check it was used once.
        const whereFn = db.select.mock.results[0]!.value.where;
        expect(whereFn).toHaveBeenCalledTimes(1);
    });

    it("limits the query to the first row", async () => {
        db.select.mockReturnValue(makeQuery([{ id: "pkg-1" }]));
        await requirePackageOwnership("pkg-1", "user-1");
        const limitFn = db.select.mock.results[0]!.value.limit;
        expect(limitFn).toHaveBeenCalledWith(1);
    });

    it("re-throws when the DB query throws (and logs an error)", async () => {
        const boom = new Error("connection refused");
        db.select.mockReturnValue(makeRejectingQuery(boom));
        await expect(requirePackageOwnership("pkg-1", "user-1")).rejects.toThrow(
            "connection refused",
        );
        expect(loggerMock.error).toHaveBeenCalledWith(
            "packageGuard",
            "DB query failed",
            expect.objectContaining({ packageId: "pkg-1", userId: "user-1" }),
        );
    });
});
