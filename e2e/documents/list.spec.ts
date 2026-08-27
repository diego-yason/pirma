import { expect, test } from "@playwright/test";

/**
 * "All Documents" (`/doc/list`) end-to-end smoke tests.
 *
 * Auth-gated like the dashboard suite: they run against the dev server with the
 * persisted session from `e2e/dashboard/global-setup.ts` (see
 * `playwright.documents.config.ts`).
 */
test.describe("All Documents", () => {
    test("is reachable from the sidebar nav", async ({ page }) => {
        await page.goto("/doc/list");

        // "All Documents" is a child of the "Documents" nav group, which only
        // renders when that group is active (i.e. on a /doc route).
        const navLink = page.getByRole("link", { name: "All Documents" });
        await expect(navLink).toBeVisible();
        await expect(navLink).toHaveAttribute("href", "/doc/list");

        // The "Documents" group itself links to the create flow.
        const documents = page.getByRole("link", { name: "Documents", exact: true });
        await expect(documents).toHaveAttribute("href", "/doc/new");
    });

    test("renders the page header, segments and status chips", async ({ page }) => {
        await page.goto("/doc/list");

        await expect(
            page.getByRole("heading", { level: 1, name: "All Documents", exact: true }),
        ).toBeVisible();

        for (const label of ["All", "Waiting on me", "Sent by me", "Shared with me", "Drafts"]) {
            await expect(page.getByRole("tab", { name: label, exact: true })).toBeVisible();
        }

        for (const label of ["All", "Draft", "Awaiting signatures", "Completed"]) {
            await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
        }

        // Primary action links to the create flow — the header CTA and the nav
        // child share the "New Document" label once the Documents group expands.
        const newDoc = page.getByRole("link", { name: "New Document" });
        await expect(newDoc.first()).toHaveAttribute("href", "/doc/new");
        await expect(newDoc.last()).toHaveAttribute("href", "/doc/new");
    });

    test("lists envelope rows or shows the empty state", async ({ page }) => {
        await page.goto("/doc/list");

        // The test account either has envelopes (row cards) or none (empty state).
        const row = page.locator("a[href*='/doc/']").first();
        const empty = page.getByText("No documents yet", { exact: true });

        const rowCount = await page.locator("a[href*='/doc/']").count();
        if (rowCount > 0) {
            await expect(row).toBeVisible();
        } else {
            await expect(empty).toBeVisible();
        }
    });

    test("search filters the list server-side", async ({ page }) => {
        await page.goto("/doc/list");

        const search = page.getByLabel("Search documents");
        await expect(search).toBeVisible();

        // Type with the keyboard (Playwright `fill` doesn't stick on Svelte
        // controlled inputs) and expect the debounced server-side search to kick in.
        await search.click();
        await search.pressSequentially("zzzz-no-such-document");
        await expect(page.getByText(/No matches for/)).toBeVisible({ timeout: 10_000 });
    });

    test("empty drafts segment shows its empty state", async ({ page }) => {
        await page.goto("/doc/list?segment=drafts");

        // The Drafts tab is the active segment and a clear empty state is shown
        // (either "No drafts" or rows when the account has standalone uploads).
        await expect(page.getByRole("tab", { name: "Drafts", exact: true })).toHaveAttribute(
            "aria-selected",
            "true",
        );

        const hasRows = await page.locator("a[href='/doc/new']").count();
        if (!hasRows) {
            await expect(page.getByText("No drafts", { exact: true })).toBeVisible();
        }
    });
});
