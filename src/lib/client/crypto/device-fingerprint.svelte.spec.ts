import { describe, it, expect } from "vitest";
import { getDeviceFingerprint } from "./device-fingerprint";

// Browser project test: `navigator` / `window` / `crypto.subtle` are real here,
// so this exercises the actual SHA-256 fingerprint builder end-to-end.
// Naming convention (*.svelte.spec.ts) routes it to the vitest `client` project.

describe("getDeviceFingerprint", () => {
    it("returns a 64-char lowercase SHA-256 hex hash", async () => {
        const fp = await getDeviceFingerprint();
        expect(fp.hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("is deterministic — same profile hashes to the same value", async () => {
        const a = await getDeviceFingerprint();
        const b = await getDeviceFingerprint();
        expect(a.hash).toBe(b.hash);
    });

    it("returns a human-readable label with browser and OS", async () => {
        const fp = await getDeviceFingerprint();
        expect(fp.label).toContain(", ");
        // label has two parts: "Browser version, OS"
        const [browser, os] = fp.label.split(", ");
        expect(browser).toBeTruthy();
        expect(os).toBeTruthy();
    });

    it("includes the browser name in the label", async () => {
        const fp = await getDeviceFingerprint();
        expect(fp.label).toMatch(/Chrome|Firefox|Safari|Edge|Opera/);
    });

    it("is stable across repeated calls (no per-call salt)", async () => {
        const results = await Promise.all([
            getDeviceFingerprint(),
            getDeviceFingerprint(),
            getDeviceFingerprint(),
        ]);
        const hashes = new Set(results.map((r) => r.hash));
        expect(hashes.size).toBe(1);
    });
});
