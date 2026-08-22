# O8 — Technical Health — Blockers

> **Objective (O8 — see `../core-objectives.md`):** keep the foundation clean so
> the other objectives stay buildable.
>
> **Status legend:** 🔴 blocking · 🟡 partial / affects quality · 🟢 context / not blocking
> **Created:** 2026-08-23 · **Repo:** `diego-yason/pirma` · **Branch:** `dev`

---

## 1. Current state

A handful of pre-existing warnings and debt items tracked in `roadmap.md` §7.
None block the signing core, but they add noise and risk.

## 2. Blockers

| # | Blocker | Type | Impact | Status | Unblock path |
|---|---|---|---|---|---|
| B1 | **Deprecated `config.alias` (`$plugins`) still in use** — should be subpath imports. | Tech-debt | Build/check warning; future SvelteKit changes may break it. | 🟡 | Replace `$plugins` aliases with subpath imports; larger refactor. |
| B2 | **`src/env.ts` `@migration-task` unresolved** — `ORIGIN` / `BETTER_AUTH_SECRET` allow empty fallback `""`. | Tech-debt (decision) | Misconfiguration can silently pass with empty secrets. | 🟡 | Decide and enforce non-empty values for critical env vars. |
| B3 | **Pre-existing build warnings** — a11y `href=""` (demo email route) and `state_referenced_locally` (view page). | Tech-debt | Warning noise; masks real issues. | 🟢 | Fix the specific flagged files. |
| B4 | **`MIGRATION_TASKS.md` unfinished/undeleted** — SvelteKit 3 migration tasks done. | Tech-debt | Stale file; confusing. | 🟢 | Finish/delete the file. |
| B5 | **Stale language-server `Cannot find module`** on the sign server (clears on save/reload). | Tech-debt | Noisy IDE error. | 🟢 | No code fix; tooling cache issue. |

## 3. Not blockers

- `date` / `initials` field kinds (O1 polish, not technical debt).

## 4. Suggested order

1. **B2** — env var hardening (security-relevant).
2. **B1** — alias → subpath imports.
3. **B3 / B4** — build warnings + `MIGRATION_TASKS.md` cleanup.

> Related: `docs/ai/roadmap.md` §7
