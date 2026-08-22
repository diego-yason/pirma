# Testing — Strategy, Setup, Patterns & Coverage

> Status: **Active — growing incrementally (2026-08-19)**
> Repo: `diego-yason/pirma` · Branch: `dev`
> Related:
> - `vite.config.ts` — Vitest config (3 projects)
> - `playwright.config.ts` — E2E config (build + preview, `**/*.e2e.{ts,js}`)
> - `playwright.dashboard.config.ts` — E2E config for the auth-gated dashboard suite (dev server on 5173)
> - `.env.test` — committed test-only env (mock values)
> - `src/lib/server/crypto/verify-signature.ts`, `key-rotation.ts`, `src/lib/shared/signing-payload.ts`
> - `docs/ai/security/keys-and-signing-review.md` (KSR-08 fixed, verified by tests)

Home of the **general testing strategy** (§0) plus the working unit-test setup, patterns, and
coverage. §0 is the plan (layers, journeys, thresholds, CI); §1+ record what exists and how.
Not a finished spec — coverage grows module by module.

---

## 0. General testing strategy (plan)

### 0.1 Layers & priorities

| Layer | Tooling | State | Priority |
|---|---|---|---|
| **Unit** (node) | Vitest `server` | ✅ active (116 tests) | P0 — security-critical crypto/logic first |
| **Component/browser** | Vitest `client` (Playwright) | 🟡 5 tests (`device-fingerprint`) | P1 |
| **E2E** | Playwright | 🟡 1 smoke (`demo/playwright`) + 7 dashboard (`e2e/dashboard`) | P1 — happy-path journeys |
| **Storybook** | `@storybook/addon-vitest` | 🟡 scaffold stories only | P2 |
| **Coverage enforcement** | `@vitest/coverage-v8` | 🔲 no thresholds configured | P2 |
| **Integration / DB** | Drizzle test DB or mocks (TBD) | 🔲 none | P2 |
| **CI** | GitHub Actions (plan) | 🔲 none today | P1 |

### 0.2 What to test, by feature area

| Feature area | Unit | Component | E2E |
|---|---|---|---|
| Auth (login/register/guest/MFA) | `guest-token`, auth helpers | login/register forms | register → login → guest sign |
| Signing & keys | `signing-payload`, `verify-signature`, `key-rotation` | sign-page field assignment | create package → sign → finalize |
| Notary (future) | journal hash-chain logic | notary step | notarize flow |
| Email | providers (injectable), templates | — | invite email (mock provider) |
| Blockchain / PQC (future) | `anchor-client`, Merkle root | — | `/verify` page |

### 0.3 E2E journeys (planned)

1. **A — core signing loop:** register → upload doc → create package → signer signs → owner
   notified → document `executed`.
2. **B — guest flow:** invite email → tokenized link → sign → finalize (guest OTP).
3. **C — MFA / tier-2:** `mfaRequired` package requires password-unlocked level-2 key.
4. **D — reject flow:** signer rejects with reason → owner alerted.
5. **E — notary ION** (when notary ships).

Seed from the existing `demo/playwright` smoke test; run against `build + preview` per
`playwright.config.ts`.

### 0.4 Coverage thresholds (to configure in `vite.config.ts`)

- Start: floor on `src/lib/server/crypto/**` + `src/lib/shared/**` (e.g. 80% lines).
- Raise over time as more of the codebase is covered; don't gate the whole repo until the
  baseline is meaningful.

### 0.5 CI wiring (to add — GitHub Actions)

1. pnpm install → `vitest run` (server + client projects).
2. Playwright E2E (`test:e2e` — builds + previews).
3. Storybook tests.
4. Coverage report upload.

Note: `npm run check`/eslint are currently broken (§6) — gate CI on **tests** first, fix
`check` separately.

### 0.6 Out of scope (for now)

- Visual regression (no tooling installed).
- Load / performance testing.
- Notary RON + full notary E2E until the notary feature ships.
- PQC / Merkle-root E2E until that feature is implemented.

### 0.7 Relationship to the roadmap

`docs/ai/roadmap.md` has no dedicated QA/testing rows yet. When it makes sense, add rows
pointing here (e.g. "Enforce coverage thresholds (§0.4)", "E2E journey suite (§0.3)", "CI
workflow (§0.5)").

---

## 1. Infrastructure (Vitest)

`vite.config.ts` defines **three Vitest projects**:

| Project | Environment | Picks up |
|---|---|---|
| `client` | browser (Playwright/Chromium, headless) | `src/**/*.svelte.{test,spec}.{js,ts}` |
| `server` | node | `src/**/*.{test,spec}.{js,ts}` (excludes `.svelte.*`) |
| `storybook` | browser | Storybook stories (`@storybook/addon-vitest`) |

Config notes:
- `expect.requireAssertions: true` — every test must contain at least one assertion.
- Package manager is **pnpm** (npm fails on the `link:` dep in `plugins/better-auth-opaque`).

### Running

```sh
# one spec, server project
pnpm exec vitest run --project server src/lib/shared/signing-payload.spec.ts

# full server project
pnpm exec vitest run --project server
```

Current status (2026-08-21): **110 tests / 9 files, all passing** (server project) + **6 tests / 2 files** (client/browser project).

---

## 1b. Dashboard E2E suite (added 2026-08-22)

Auth-gated pages can't be tested against the generic `build + preview` config (see the `ORIGIN`
gotcha below), so the dashboard gets its **own Playwright config**:

| File | Purpose |
|---|---|
| `playwright.dashboard.config.ts` | Dedicated config: dev server on **5173** (reused if already running), `storageState` session, `e2e/dashboard` test dir |
| `e2e/dashboard/global-setup.ts` | Logs in once via the real login UI (OPAQUE), waits for the HttpOnly session cookie, saves it to `e2e/.auth/user.json` |
| `e2e/dashboard/dashboard.spec.ts` | 7 tests: greeting + CTA, 4 stat cards, Waiting for You section, Recent Envelopes + view-all, uploaded docs listing, sidebar nav, theme toggle |

Run it with:

```sh
pnpm exec playwright test --config=playwright.dashboard.config.ts
# or
pnpm run test:e2e:dashboard
```

**Credentials** come from `cred.local.txt` (gitignored — `Email:` / `Passw:` lines) or the
`TEST_EMAIL` / `TEST_PASSWORD` env vars. The auth state (`e2e/.auth/`) is gitignored.

**Gotchas (all hit in practice):**
1. **Port must be 5173.** Better-auth's `svelteKitHandler` only treats `/api/auth/*` as auth
   routes when the request origin matches `ORIGIN` (`.env` → `http://localhost:5173`). On any
   other port every `/api/auth/*` returns 404 and OPAQUE login fails with "Failed to get
   registration challenge".
2. **HttpOnly cookie.** `document.cookie` can't see the session cookie, so global setup polls
   `page.context().cookies()` instead.
3. **Login rate limit.** Better-auth rate-limits rapid attempts; the global setup retries up to
   3 times with a short backoff.
4. **Hydration race.** The theme toggle button's handler attaches during `onMount`; clicking
   before hydration no-ops. The test waits for `style.colorScheme` on `<html>` (only set by
   `syncTheme()` after mount) before clicking.

Status (2026-08-22): **7 tests, all passing** (verified repeatedly). The generic `demo/playwright`
smoke test (build + preview, port 4173) still passes independently.

---

## 2. The `.env.test` pattern (verified 2026-08-19)

Committed test env at repo root (already whitelisted in `.gitignore` as `!.env.test`).
Contains **mock / non-secret values only**:

```
DATABASE_URL=postgres://mock:mock@localhost:5432/mock
BETTER_AUTH_SECRET=test-only-better-auth-secret-not-real
KEY_ALLOWED_ALGORITHMS=ECDSA-P256,ECDSA-P384
KEY_MAX_AGE_DAYS=180
KEY_MAX_IDLE_DAYS=90
KEY_MAX_SIGNATURES=500
```

**Why it works:** Vitest runs with mode `"test"` by default. The SvelteKit plugin calls
`vite.loadEnv("test", …)` at config time, and `$app/env/private` is a **virtual module** whose
static values are baked from that result. So tests importing `$app/env/private` (or modules that
transitively do, e.g. `#lib/server/db/index.js`) see `.env.test` values **with no `vi.mock`**.

Rules of thumb:
- Keep `.env.test` **non-secret** — it's committed. Real secrets stay in gitignored `.env`/`.env.local`.
- `.env.test.local` (gitignored) overrides `.env.test` for local-only tweaks.
- This only feeds `$app/env/*`; code reading `process.env.X` directly won't see it.

---

## 3. DB mocking pattern

For modules that call the real `db` (e.g. `checkKeyUsage`, `checkKeyRotation`), stub the DB module
so no real connection is attempted. Pattern used in `key-rotation.spec.ts`:

```ts
const { db, makeQuery } = vi.hoisted(() => {
    const db = { select: vi.fn() };

    function makeQuery(finalResult: unknown) {
        const query = {
            from: vi.fn(() => query),
            where: vi.fn(() => query),
            limit: vi.fn(() => Promise.resolve(finalResult)),
            // thenable so `await … .where()` resolves the final result
            then: (onFulfilled: (v: unknown) => unknown) =>
                Promise.resolve(finalResult).then(onFulfilled),
        };
        return query;
    }

    return { db, makeQuery };
});

vi.mock("#lib/server/db/index.js", () => ({ db }));
```

Notes:
- The alias specifier `#lib/server/db/index.js` resolves correctly in the mock.
- Use `vi.resetAllMocks()` in `beforeEach` to avoid `mockReturnValueOnce` leaks between tests.
- Configure per test: `db.select.mockReturnValue(makeQuery([...]))` or
  `mockReturnValueOnce(...).mockReturnValueOnce(...)` for multi-query flows.

---

## 4. Coverage so far

| Module | Spec | Tests | Covers |
|---|---|---|---|
| `src/lib/shared/signing-payload.ts` | `signing-payload.spec.ts` | 6 | Payload format, field-ID sort, dedup, empty list, determinism, lexicographic (string) sort of numeric-looking IDs |
| `src/lib/server/crypto/verify-signature.ts` | `verify-signature.spec.ts` | 9 | Accepts DER + IEEE P1363 (64-byte) sigs; rejects wrong data/key/tampered; **fail-closed** on empty/garbage/truncated sig and invalid pubkey |
| `src/lib/server/crypto/key-rotation.ts` | `key-rotation.spec.ts` | 18 | `checkKeyPolicy` (age/idle/algorithm + precedence); `checkKeyUsage` (0/499/500/1200); `checkKeyRotation` (no key → null, short-circuit on policy, usage over max, `.limit(1)`) |
| `src/lib/server/auth/guest-token.ts` | `guest-token.spec.ts` | 13 | Token format (base64url pair); embeds recipient/package/~7-day expiry; **tamper/fail-closed** (payload, sig, wrong secret, no delimiter, garbage, non-JSON); expired vs not-yet-expired |
| `src/lib/server/logger.ts` | `logger.spec.ts` | 8 | Structured fields (action, object spread, `err` for Error, `argN` for primitives); level routing; merge order; **redaction config** (tokens, codes, nonces, passwords, signatures, auth/cookie headers, apiKey; censor `[REDACTED]`) |
| `src/lib/server/email/templates/*` | `templates.spec.ts` | 21 | `escapeHtml`; `emailShell` (title/body/footer + title escaping); all renderers (signer-invite, guest-otp, signed, rejected, executed, password-reset, reminder) incl. XSS-escape checks, name fallbacks, singular/plural docs, optional deadline/reason/dashboardUrl; all subjects |
| `src/lib/server/email/providers.ts` | `providers.spec.ts` | 17 | `getProvider` (console default, unknown → console + warn, resend, smtp); **console provider logs metadata only — never html/text body (EMR-01)**; resend: throws w/o key, POSTs auth header + payload, throws on non-OK; **smtp: throws w/o SMTP_HOST, nodemailer transport config (host/port/secure/ignoreTLS/auth), sendMail payload, closes transport** |
| `src/lib/server/package-guard.ts` | `package-guard.spec.ts` | 6 | `requirePackageOwnership`: owned → pkg, not-owned/missing → null + warn, `.where()` id+owner, `.limit(1)`, DB error re-throws + logs |
| `src/lib/client/crypto/device-fingerprint.ts` | `device-fingerprint.svelte.spec.ts` (client/browser) | 5 | Real SHA-256 64-hex hash; deterministic; label has browser + OS; browser name present; stable across parallel calls |
| example | `src/lib/vitest-examples/greet.spec.ts` | 1 | Scaffold example |

### Finding surfaced by tests (KSR-08 — fixed)

`verifyEcdsaSignature` previously could throw on malformed input (→ 500). Tests confirmed Node
fail-closes for empty/garbage/truncated inputs, but an invalid public key **throws**. Hardened
2026-08-19: whole verification wrapped in `try/catch` returning `false` — fail-closed, no 500.
Security review updated (`docs/ai/security/keys-and-signing-review.md`, KSR-08 marked fixed).

---

## 5. Next candidates

- ✅ `src/lib/server/auth/guest-token.ts` — done 2026-08-21 (13 tests).
- ✅ `src/lib/server/logger.ts` — done 2026-08-21 (8 tests; redaction config via mocked pino).
- ✅ `src/lib/server/email/templates/` — done 2026-08-21 (21 tests).
- ✅ `src/lib/server/email/providers.ts` — done 2026-08-21 (8 tests; incl. EMR-01 no-body logging).
- ✅ `src/lib/server/package-guard.ts` — done 2026-08-21 (6 tests; `requirePackageOwnership` only — module is small).
- ✅ `src/lib/client/crypto/device-fingerprint.ts` — done 2026-08-21 (5 tests, browser project).
- `src/lib/server/email/reminders.ts` — `sendDueReminders` (multi-query flow; DB mock with
  `mockReturnValueOnce` chains).
- `src/lib/server/email/index.ts` — `sendEmail` (idempotency by eventId, queued→sent/failed,
  never-throws).
- Browser project (`client`) now runs in this env (Chromium v1228 installed 2026-08-21 via
  `pnpm exec playwright install chromium`).

---

## 6. Gotchas

- `npm run check` and `eslint` are **pre-existing broken** in this env (unrelated to tests):
  tsconfig `$app/tsconfig` unresolvable; `eslint.config.js` can't resolve `@sveltejs/load-config`.
  Use `pnpm exec vitest run` directly to validate.
- `svelte-kit sync` runs `prepare` — `$app` modules are resolved by the SvelteKit Vite plugin at
  test time; no manual sync needed before running Vitest.
- Browser (`client`) project tests need a matching Playwright Chromium installed
  (`pnpm exec playwright install chromium`). If launch fails with "Executable doesn't exist at
  …chromium_headless_shell-<rev>…", the installed browsers are out of date — re-run the install.
  Verified working 2026-08-21 (Chromium v1228).
