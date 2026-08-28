# All Documents Page — `/doc/list`

> Status: **Implemented** (2026-08-27)
> Created: 2026-08-27
> Repo: `diego-yason/pirma` · Branch: `dev`
> Related:
> - `docs/ai/roadmap.md` §8.1 (document & package lifecycle)
> - `docs/ai/signing/document-package-management.md` (search, trash/archive, download)
> - `docs/ai/signing/signing-workspace-features.md` (viewers enforcement)
> - `src/routes/(app)/doc/list/+server.ts` (existing JSON endpoint)
> - `src/routes/(app)/dashboard/+page.svelte` (source of the envelope-card pattern)
> - `src/routes/(app)/doc/[pageId]/+page.server.ts` (package detail access rules)

## 1. Why this page exists

`/doc/list` is linked from the app nav ("All Documents") and from the dashboard
("Recent Envelopes → View all"). It now has a full page UI (`+page.svelte` +
`+page.server.ts`) alongside the original `+server.ts` JSON endpoint.

The endpoint is not dead weight: `doc/new/RecentlyUploaded.svelte` fetches it to
show recent standalone uploads. Per the SvelteKit content-negotiation rules, a
`+page.svelte` / `+page.server.ts` can **coexist** with `+server.ts` in the same
folder: browser navigations get the page, `fetch("/doc/list")` calls still get
JSON. Verified at runtime: HTML navigation → page (auth-redirects to `/login`
when logged out), `Accept: */*` → 401 JSON from `+server.ts`.

## 2. Scope decision (recommended)

The page is the **workspace hub**: every document the user can see, in one place,
envelope-first.

- **Envelopes (packages) the user owns** — the primary unit, because signing is
  package-based and the detail page is `doc/[pageId]` (a package).
- **Standalone drafts** — documents uploaded but not yet placed in a package
  (`documentAssignments` has no row). These are exactly what the current endpoint
  returns; they need a home on this page, not just in "Recently Uploaded".
- **Shared with me** — packages where the user is a recipient (signer/viewer) or a
  package viewer, mirroring the dashboard's "Shared with you" section.

A flat document-only table is **not** recommended: it loses package context
(recipients, progress, expiration) and conflicts with how the rest of the app
groups documents.

## 3. Page anatomy

### 3.1 Header
- Title: **All Documents** + live count ("23 documents").
- **New Document** button → `/doc/new` (primary action).
- Search input (debounced, server-side, matches title).

### 3.2 Segments (tabs / segmented control)
Default: **All**. Segments are server-side filters, not client-side hiding:

| Segment | Query |
|---|---|
| All | everything below |
| Waiting on me | packages where I'm a signer with a pending signature (`pendingDocumentsView` logic) |
| Sent by me | packages I own |
| Shared with me | packages where I'm recipient or `packageViewers` row |
| Drafts | standalone documents (not in any package) |

### 3.3 Status filter chips
- **All** · **Draft** · **Awaiting signatures** · **Completed**

Package status is **derived** from its documents (reuse the dashboard's
`envelopeStatus`/`envelopeProgress` helpers — extract them into a shared module):
- `draft` → any document `draft`
- `awaiting signatures` → documents `finalized`, any signature pending
- `completed` → all documents `executed`

Document status enum stays `draft | finalized | executed` (unchanged).

### 3.4 List (envelope rows)
Each row (desktop table / mobile card):

- Envelope name → `doc/[pageId]`
- Status badge (derived, colored like dashboard)
- Signature progress bar (`x/y signed`) — from `signatures` + signer recipients
- `n documents` · Updated <date>
- Expiration date, if set (red flag if overdue)
- **Needs me** indicator (pending signature for the current user)
- Row actions (kebab menu): Sign (when pending for me, → `/doc/[pageId]/sign`),
  View (→ `/doc/[pageId]/view`). Future: Download, Delete, Archive (see §6).

Clicking the row (or the name) opens `doc/[pageId]`.

### 3.5 Standalone drafts section
- Flat rows for documents with no `documentAssignments` row.
- Columns: title, page count, file size, status (`draft`), updated date.
- Row actions: **Send / Add to package** (→ `/doc/new` flow), Delete (future).
- These reuse the `RecentlyUploaded` card look, but as a list.

### 3.6 Empty states
- No documents at all → "No documents yet" + **Upload a document** CTA (`/doc/new`).
- **Shared with me** empty → "Nothing shared with you yet" + explanation ("when someone adds
  you as a recipient or viewer, it appears here"); shows **Clear filters** when filters active.
- Segment/chip yields nothing → "Nothing here" + **Clear filters**.
- Search yields nothing → "No matches for "<query>"" + Clear search.

### 3.7 Pagination
- Offset-based (matches the existing endpoint), page size **10** (`PAGE_SIZE` in
  `+page.server.ts`, consistent with `+server.ts`).
- "Showing 1–10 of N" + prev/next. Reset to page 1 when filters/search change.

## 4. Data & queries (`+page.server.ts` load)

Access rule (same as `doc/[pageId]`): owner **or** recipient **or** viewer.
Eventually via the shared `canAccessPackage` helper from the viewers-enforcement
design (`signing-workspace-features.md` §4).

One load, parallelized (`Promise.all`):

1. **Owned packages + docs**: `packages` where `owner = me`, joined to
   `documentAssignments` → `documents`. Include `documents.id/title/status/
   pageCount/fileSize/updatedAt`.
2. **Signing progress**: per package, count `signatures` with status
   `signed|anchored` grouped by document; signer count from `packageRecipients`
   where `role = 'signer'`. (Reuse the `doc/[pageId]` sigs-by-doc pattern.)
3. **Shared with me**: `packages` joined through `packageRecipients` (userId = me)
   or `packageViewers` (userId = me). Mark `needsMe` when a pending signature
   exists (`pendingDocumentsView` can power the "Waiting on me" segment).
4. **Standalone drafts**: `documents` where `owner = me` and NOT EXISTS
   `documentAssignments` (the existing endpoint's query).
5. **Search**: `ILIKE '%term%'` on `documents.title` when a `q` param is present.
6. **Counts** for the header + pagination (with filters applied).

All queries RLS-safe: RLS is enabled on these tables; the load runs as the
authenticated user.

## 5. Route/component changes

| File | Change |
|---|---|
| `src/routes/(app)/doc/list/+page.server.ts` | `load` per §4 (implemented) |
| `src/routes/(app)/doc/list/+page.svelte` | page per §3 (implemented) |
| `src/routes/(app)/doc/list/+server.ts` | **unchanged** (RecentlyUploaded still fetches it) |
| `src/lib/client/ui/envelopeStatus.ts` | shared helpers extracted from `dashboard/+page.svelte` (which now imports them): `statusLabel`/`statusStyle`/`envelopeStatus`/`envelopeProgress` + `signatureProgress`/`fmtDate` |
| `src/lib/client/ui/EnvelopeRow.svelte` | envelope row component (status badge, signature progress, "Needs me", kebab: Sign/View) |
| `e2e/documents/list.spec.ts` · `playwright.documents.config.ts` · `test:e2e:documents` | smoke tests (auth-gated, dev server via shared `global-setup`) |

`doc/list/+server.ts` stays the "recent standalone uploads" API; a later cleanup
may move it to `/api/documents` — out of scope here.

## 6. Explicitly out of scope (future, per roadmap §8.1)

- Full-text search (Postgres `tsvector`) — v1 is `ILIKE` on title.
- Trash / archive / retention (`removedAt`/`archivedAt` don't exist yet).
- Download / export (`GET /doc/[pageId]/download` — no artifact yet).
- Bulk actions (multi-select, batch delete/archive).
- Templates & contacts pages (separate roadmap items).
- Renaming the route (`doc/[pageId]` is package-centric; not worth churn).

## 7. Decisions (resolved during implementation)

1. Default segment: **All** ✅ — most useful hub.
2. "Shared with me" included ✅ — parity with the dashboard.
3. Envelope-grouped ✅ (see §2).

Implementation notes:

- "Shared with me" **excludes** packages the user owns (owner→recipient rows are
  covered by "Sent by me"), avoiding duplicates across segments.
- Signature progress is **signature-based** (`signed`/`totalSignatures` = signed
  signature rows ÷ signer-recipient × document pairs), consistent with the
  `doc/[pageId]` detail page — distinct from the dashboard's doc-execution
  `envelopeProgress`. All signer recipients count toward the denominator
  (including guests); the denominator is clamped to never be below the recorded
  signature count (an owner can sign without a `packageRecipients` row).
- Status chips (`Awaiting signatures`/`Completed`) are filter labels; envelope
  badges reuse the dashboard's `statusLabel` (`Awaiting Signatories`/`Executed`).
- Standalone-draft rows currently link "Send" to `/doc/new` (the create flow);
  a direct "add existing doc to package" flow is future work (roadmap §8.1).
