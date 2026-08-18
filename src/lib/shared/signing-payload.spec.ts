import { describe, it, expect } from "vitest";
import { buildSigningPayload } from "./signing-payload";

const base = {
    packageId: "pkg-1",
    documentId: "doc-1",
    documentHash: "abc123",
    fieldIds: ["f2", "f1"],
    signerUserId: "user-9",
};

describe("buildSigningPayload", () => {
    it("builds the expected colon-delimited payload", () => {
        expect(buildSigningPayload(base)).toBe("pkg-1:doc-1:abc123:f1,f2:user-9");
    });

    it("sorts field IDs alphabetically regardless of input order", () => {
        const input = { ...base, fieldIds: ["zeta", "alpha", "mid"] };
        expect(buildSigningPayload(input)).toBe("pkg-1:doc-1:abc123:alpha,mid,zeta:user-9");
    });

    it("deduplicates repeated field IDs", () => {
        const input = { ...base, fieldIds: ["b", "a", "b", "a", "c"] };
        expect(buildSigningPayload(input)).toBe("pkg-1:doc-1:abc123:a,b,c:user-9");
    });

    it("handles an empty field list as an empty segment", () => {
        expect(buildSigningPayload({ ...base, fieldIds: [] })).toBe("pkg-1:doc-1:abc123::user-9");
    });

    it("is deterministic — same input always yields the same payload", () => {
        expect(buildSigningPayload(base)).toBe(buildSigningPayload(base));
    });

    it("sorts numeric-looking field IDs lexicographically (string sort, not numeric)", () => {
        const input = { ...base, fieldIds: ["10", "2", "1"] };
        expect(buildSigningPayload(input)).toBe("pkg-1:doc-1:abc123:1,10,2:user-9");
    });
});
