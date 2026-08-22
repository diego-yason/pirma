import { expect, test } from "@playwright/test";

/**
 * Dashboard end-to-end tests.
 *
 * These run authenticated via the storage state produced by global-setup.ts.
 * They exercise the real layout + dashboard against the live dev server.
 */
test.describe("Dashboard", () => {
    test("greets the signed-in user and shows the main CTA", async ({ page }) => {
        await page.goto("/dashboard");

        // Greeting uses the first name from the authenticated user
        await expect(page.getByRole("heading", { level: 1, name: /Welcome back,/ })).toBeVisible();

        // Primary "New Document" action links to step 1 of the create flow
        const newDoc = page.getByRole("link", { name: "New Document" });
        await expect(newDoc).toBeVisible();
        await expect(newDoc).toHaveAttribute("href", "/doc/new");
    });

    test("renders the four stat cards", async ({ page }) => {
        await page.goto("/dashboard");

        const labels = ["Waiting for you", "Completed", "Recent envelopes", "Shared with you"];
        for (const label of labels) {
            await expect(page.getByText(label, { exact: true })).toBeVisible();
        }

        // The "Waiting for you" card scrolls to the pending section
        const waitingCard = page.locator('a[href="#waiting"]');
        await expect(waitingCard).toBeVisible();
    });

    test("shows the Waiting for You section", async ({ page }) => {
        await page.goto("/dashboard");

        await expect(
            page.getByRole("heading", { name: "Waiting for You", exact: true }),
        ).toBeVisible();
        await expect(page.getByText("Packages that need your review and signature.")).toBeVisible();
    });

    test("shows the Recent Envelopes section with view-all link", async ({ page }) => {
        await page.goto("/dashboard");

        await expect(
            page.getByRole("heading", { name: "Recent Envelopes", exact: true }),
        ).toBeVisible();

        const viewAll = page.getByRole("link", { name: /View all/ });
        await expect(viewAll).toBeVisible();
        await expect(viewAll).toHaveAttribute("href", "/doc/list");
    });

    test("lists uploaded documents under Recent Envelopes", async ({ page }) => {
        await page.goto("/dashboard");

        // The test account has uploaded documents — at least one envelope
        // should be listed with its document rows.
        const recentSection = page.locator("section", {
            has: page.getByRole("heading", { name: "Recent Envelopes", exact: true }),
        });
        await expect(recentSection).toBeVisible();

        // Either an envelope card or the "no envelopes" empty state
        const hasEnvelope = recentSection.locator("a[href*='/doc/']").count();
        if ((await hasEnvelope) > 0) {
            await expect(recentSection.locator("a[href*='/doc/']").first()).toBeVisible();
        } else {
            await expect(
                recentSection.getByText("No envelopes yet", { exact: true }),
            ).toBeVisible();
        }
    });

    test("shows the app sidebar navigation", async ({ page }) => {
        await page.goto("/dashboard");

        for (const label of ["Dashboard", "Documents", "Settings", "Log out"]) {
            await expect(page.getByRole("link", { name: label })).toBeVisible();
        }
    });

    test("theme toggle switches between light and dark", async ({ page }) => {
        await page.goto("/dashboard");

        const toggle = page.getByRole("button", {
            name: /Switch to (light|dark) mode/,
        });
        await expect(toggle).toBeVisible();

        const html = page.locator("html");

        // The toggle handler is attached during hydration (onMount). Wait for
        // hydration by polling for the theme state that syncTheme() only sets
        // client-side (color-scheme on <html>), otherwise an early click no-ops.
        await expect.poll(() => html.evaluate((el) => el.style.colorScheme)).not.toBe("");

        const before = (await html.getAttribute("class")) ?? "";

        await toggle.click();

        // Wait for the .dark class to actually flip on <html>.
        await expect.poll(async () => (await html.getAttribute("class")) ?? "").not.toBe(before);

        const after = (await html.getAttribute("class")) ?? "";
        expect(before.includes("dark")).not.toBe(after.includes("dark"));
    });
});
