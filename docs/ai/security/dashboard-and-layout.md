# Dashboard & App Layout — Security Note

> Last checked: **2026-08-16**
> Verdict: ✅ **Clear** (no significant issues; one low observation below)

## Scope
`src/routes/(app)/dashboard/+page.server.ts`, `src/routes/(app)/+layout.server.ts`.

## Verified OK

- **Dashboard** queries are user-scoped: pending packages join `package_recipients` on the
  current user, "recent" is filtered by `packages.owner`, and "Packages I Can View" joins
  `package_viewers` on the current user.
- No user-controlled SQL or unsanitized interpolation — all via Drizzle query builders.
- **Layout** loads only the current user's own data (key presence, rotation, recipient link) and
  redirects unauthenticated users to `/login`.

## Low observation

1. **`(app)/+layout.server.ts`** gates on
   `if (!locals.user && !url.pathname.includes("/sign"))` — the `/sign` substring match is loose
   and will allow unauthenticated access to any future route whose path contains `/sign`. This is
   intentional today (guests must reach the sign page), but consider an explicit allowlist of
   public routes instead of a substring check.

## Note

`dashboard` **lists** `package_viewers` correctly; the gap is that the individual
`doc/[pageId]` and `view` pages don't enforce it — tracked as AAR-01 in
`auth-and-access-review.md`.

No High/Medium findings.
