import { describe, it, expect } from "vitest";
import { buildSigningPayload, canonicalFieldValues, sha256Hex } from "./signing-payload";

const base = {
    packageId: "pkg-1",
    documentId: "doc-1",
    documentHash: "abc123",
    fieldIds: ["f2", "f1"],
    signerUserId: "user-9",
    fieldValuesHash: "h1",
};

describe("buildSigningPayload", () => {
    it("builds the expected colon-delimited payload with the values hash", () => {
        expect(buildSigningPayload(base)).toBe("pkg-1:doc-1:abc123:f1,f2:user-9:h1");
    });

    it("sorts field IDs alphabetically regardless of input order", () => {
        const input = { ...base, fieldIds: ["zeta", "alpha", "mid"] };
        expect(buildSigningPayload(input)).toBe("pkg-1:doc-1:abc123:alpha,mid,zeta:user-9:h1");
    });

    it("deduplicates repeated field IDs", () => {
        const input = { ...base, fieldIds: ["b", "a", "b", "a", "c"] };
        expect(buildSigningPayload(input)).toBe("pkg-1:doc-1:abc123:a,b,c:user-9:h1");
    });

    it("handles an empty field list as an empty segment", () => {
        expect(buildSigningPayload({ ...base, fieldIds: [] })).toBe(
            "pkg-1:doc-1:abc123::user-9:h1",
        );
    });

    it("appends the field values hash as the final segment", () => {
        expect(buildSigningPayload({ ...base, fieldValuesHash: "deadbeef" })).toBe(
            "pkg-1:doc-1:abc123:f1,f2:user-9:deadbeef",
        );
    });

    it("is deterministic — same input always yields the same payload", () => {
        expect(buildSigningPayload(base)).toBe(buildSigningPayload(base));
    });

    it("sorts numeric-looking field IDs lexicographically (string sort, not numeric)", () => {
        const input = { ...base, fieldIds: ["10", "2", "1"] };
        expect(buildSigningPayload(input)).toBe("pkg-1:doc-1:abc123:1,10,2:user-9:h1");
    });
});

describe("canonicalFieldValues", () => {
    it("sorts by field id and is deterministic regardless of input order", () => {
        const a = { z: "1", a: "2", m: "3" };
        const b = { m: "3", a: "2", z: "1" };
        expect(canonicalFieldValues(a)).toBe(canonicalFieldValues(b));
        expect(canonicalFieldValues(a)).toBe(`[["a","2"],["m","3"],["z","1"]]`);
    });

    it("drops empty strings but keeps booleans", () => {
        expect(canonicalFieldValues({ a: "", b: "x", c: false, d: true })).toBe(
            `[["b","x"],["c",false],["d",true]]`,
        );
    });
});

describe("sha256Hex", () => {
    it("produces the expected SHA-256 digest", async () => {
        expect(await sha256Hex("abc")).toBe(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        );
    });
});
