# Demo Routes — Security Note

> Last checked: **2026-08-16**
> Verdict: ✅ **Fixed (2026-08-16)** — dev-only gate added for the auth demo routes

## Scope
`src/routes/demo/**` (`demo/better-auth/login`, `demo/playwright`, `demo/paraglide`).

## Finding: demo auth routes ship to production

**Where** — `src/routes/demo/better-auth/login/+page.server.ts` exposes real
`signInEmail` and `signUpEmail` actions that call the production `auth.api` directly.

**Risk** — the `demo/` tree has **no dev-only gate** (unlike `(dev)/+layout.ts`, which redirects
outside `dev`). In a production build these routes are reachable, providing:

- an alternate email/password **sign-up** surface (bypassing the OPAQUE registration flow used by
  the real `/register` page), and
- an alternate email/password **sign-in** surface.

Both operate against the real user database, so this is effectively an unvetted authentication
surface shipped with the app.

**Recommendation**

- Gate the whole `demo/` tree to development (add a `demo/+layout.ts` that redirects unless
  `$app/env` `dev` is true), or
- delete the `demo/better-auth` routes before any production build.

## Verified OK (within this area)

- `demo/playwright` is a `.e2e.ts` + page used by tests only.
- `demo/paraglide` and `demo/+page.svelte` are static demos with no server actions.

## Resolution (2026-08-16)

Added `src/routes/demo/better-auth/+layout.ts`, which redirects to `/` when `dev` is false —
so the real `signInEmail`/`signUpEmail` actions are no longer reachable in a production build.

The `demo/playwright` page is intentionally left ungated: the Playwright e2e smoke test runs
against a production build (`npm run build && npm run preview`) and visits `/demo/playwright`.
It is a static page with no server actions.

## Status

✅ **Fixed** — `demo/better-auth` (incl. `login`) is now dev-only.
