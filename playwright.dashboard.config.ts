import { defineConfig, devices } from "@playwright/test";

/**
 * Dashboard end-to-end suite.
 *
 * The dashboard is auth-gated, and better-auth only routes `/api/auth/*` when
 * the request origin matches `ORIGIN` in `.env` (http://localhost:5173). So this
 * suite runs against the DEV server on port 5173 (reused if already running) and
 * logs in once via `global-setup.ts`, persisting the session to `e2e/.auth/`.
 *
 * Credentials are read from `cred.local.txt` (gitignored) or the
 * `TEST_EMAIL` / `TEST_PASSWORD` env vars.
 */
export default defineConfig({
    testDir: "./e2e/dashboard",
    globalSetup: "./e2e/dashboard/global-setup.ts",
    timeout: 30_000,
    expect: { timeout: 10_000 },
    fullyParallel: true,
    reporter: "list",
    use: {
        baseURL: "http://localhost:5173",
        storageState: "./e2e/.auth/user.json",
        trace: "on-first-retry",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: {
        command: "pnpm dev",
        port: 5173,
        reuseExistingServer: true,
        timeout: 120_000,
    },
});
