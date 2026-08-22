import { chromium, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const AUTH_DIR = path.resolve("e2e/.auth");
const AUTH_FILE = path.join(AUTH_DIR, "user.json");
const CRED_FILE = path.resolve("cred.local.txt");
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";

/**
 * Read local test credentials.
 *
 * Priority: TEST_EMAIL/TEST_PASSWORD env vars → cred.local.txt (gitignored).
 */
function loadCredentials(): { email: string; password: string } {
    const fromEnv =
        process.env.TEST_EMAIL && process.env.TEST_PASSWORD
            ? { email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }
            : null;

    if (fromEnv) return fromEnv;

    if (fs.existsSync(CRED_FILE)) {
        const content = fs.readFileSync(CRED_FILE, "utf-8");
        const email = content.match(/^Email:\s*(\S+)/im)?.[1];
        const password = content.match(/^Passw:\s*(\S+)/im)?.[1];
        if (email && password) return { email, password };
    }

    throw new Error(
        "Dashboard e2e needs credentials. Set TEST_EMAIL/TEST_PASSWORD env vars " +
            "or create cred.local.txt with 'Email: ...' and 'Passw: ...' lines.",
    );
}

/**
 * Log in once and persist the session cookie so every dashboard test starts
 * authenticated. Runs before the test workers.
 */
export default async function globalSetup(_config: FullConfig) {
    const { email, password } = loadCredentials();

    fs.mkdirSync(AUTH_DIR, { recursive: true });

    const browser = await chromium.launch();
    const page = await browser.newPage();

    // OPAQUE sign-in is a client round-trip that sets an HttpOnly session cookie.
    // Better-auth rate-limits rapid attempts, so retry a few times before giving
    // up. Poll the context (sees HttpOnly cookies) rather than relying on
    // document.cookie or the post-login client-side navigation (flaky in headless).
    let sessionCookie = null;
    for (let attempt = 1; attempt <= 3 && !sessionCookie; attempt++) {
        await page.goto(`${BASE_URL}/login`);
        await page.locator("#email").fill(email);
        await page.locator("#password").fill(password);
        await page.getByRole("button", { name: "Sign in", exact: true }).click();

        const deadline = Date.now() + 15_000;
        while (Date.now() < deadline) {
            const cookies = await page.context().cookies();
            sessionCookie = cookies.find((c) => c.name.includes("better-auth.session"));
            if (sessionCookie) break;
            await page.waitForTimeout(250);
        }
        if (!sessionCookie) await page.waitForTimeout(2_000);
    }
    if (!sessionCookie) {
        throw new Error(
            "Login did not set a better-auth session cookie after 3 attempts. " +
                "Check credentials in cred.local.txt.",
        );
    }

    // Persist cookies (session) for the test workers.
    await page.context().storageState({ path: AUTH_FILE });
    await browser.close();
}
