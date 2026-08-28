# Templates Page — `/templates`

> Status: **Implemented** (2026-08-28) — `/templates` page + per-user, v1 clone, `templates` bucket (created 2026-08-28), field editor, signatory placeholders/default signers. Pending: e2e smoke test.
> Created: 2026-08-28
> Repo: `diego-yason/pirma` · Branch: `dev`
> Related:
> - `docs/ai/roadmap.md` §5 (Document templates — P2 feature)
> - `docs/ai/signing/signing-workspace-features.md` §2 (Document templates — prior draft)
> - `docs/ai/security/storage-and-uploads.md` (bucket/upload security baseline)
> - `docs/ai/blockers/o4-guest-and-recipient-journey.md` (B5: templates/contacts stubs)
> - `src/routes/(app)/doc/new/+page.svelte` (upload step + "Use Template" stub)
> - `src/routes/(app)/doc/list/+page.svelte` (page-spec pattern this follows)

## 1. Why this exists

- The nav "Templates" → `/` is a **dead navigation entry** (blocker **B5**, roadmap §5 P2).
- The "Use Template" / "Select Template" panel on `doc/new/+page.svelte` is a **UI stub**.
- The roadmap lists **Document templates** as P2 🔲 — this spec defines what to build.

## 2. Scope & decisions (locked 2026-08-28)

| Decision | Choice |
|---|---|
| Scoping | **Per-user** templates (owner-only). Extensible to org/shared later (add a `teamId`/visibility column then). |
| Merge fields | **v1 clone-only** — no `{{field}}` placeholders yet (v2 deferred). |
| Surface | **Dedicated `/templates` page**; nav "Templates" → `/templates` (replaces the `/` stub). |
| Creation sources | **(a)** Upload a PDF directly on `/templates`; **(b)** "Save as template" from the `/doc/new` upload step; **(c)** "Save as template" from a prepared package (step 2), carrying placement fields. |
| Instantiation | Clone the **PDF + placement fields** into a **new package**, land on **step 2** (recipients & fields) with fields pre-filled. |
| Storage | Source PDFs live in a separate **`templates` bucket**. On instantiation the bytes are **copied** to the `drafts` bucket as a fresh document — the template is never mutated. |
| Page features | List, **preview** the PDF, **rename**, **delete**, show **page count / last used / usage count**, and **start from** template. |

## 3. Data model

### 3.1 `documents` flag

Add `isTemplate boolean not null default false` to `documents`.

- A template is backed by a real `documents` row (it holds `storagePath`, `hash`,
  `pageCount`, `fileSize`, `placementFields`), but it is **not** a normal document:
- `doc/list` (All Documents) and the dashboard must **exclude** `isTemplate = true`
  rows from standalone drafts / recent lists, and templates can never be "sent"
  directly (they're only instantiated via a clone).
- Template `documents.status` stays `draft`.

### 3.2 `templates` table (new)

Drizzle table (per-user; RLS enabled):

```
templates {
  id          uuid pk default random
  userId      text not null ref user.id      -- owner
  documentId  uuid not null ref documents.id  -- backing row (isTemplate=true)
  name        text not null
  signatories jsonb not null default '[]'     -- signatory placeholders [{id, name}] (Person 1, ...)
  createdAt   timestamp not null default now
  updatedAt   timestamp not null default now
  lastUsedAt  timestamp null                  -- set on each instantiation
  useCount    integer not null default 0      -- times instantiated
}
```

- Index on `userId` (per-user listing) and unique `(documentId)` (one template per backing doc).
- No unique name constraint — duplicate names allowed (rename UX stays simple).
- RLS: owner-only policies (select/insert/update/delete where `userId = auth.uid()`),
  mirroring the existing `documents`/`packageRecipients` RLS style.

> **Micro-decision (recommended):** use a `templates` table for metadata rather than
> only the `documents.isTemplate` flag — it cleanly holds `name`, `useCount`,
> `lastUsedAt`, and a future `teamId`. The flag exists purely so normal document
> queries can exclude templates.

## 4. Storage

### 4.1 Buckets

- New **`templates`** bucket (private), objects under `templates/`. **Created 2026-08-28**.
- `drafts` bucket keeps holding live working documents (unchanged).

### 4.2 Write (create template)

- Normalize input to PDF with the existing `convertToPdf` (same as uploads).
- Store bytes in `templates` bucket at `templates/{uuid}.pdf`.
- Create the `documents` row (`isTemplate = true`, `status = 'draft'`, `storagePath`
  pointing into `templates/`, `placementFields` carried over when saved from step 2).
- Create the `templates` row (name, owner).

### 4.3 Instantiate (start from template)

1. Verify ownership of the template.
2. Download bytes from `templates/{uuid}.pdf`.
3. Re-upload to `drafts` bucket under a new `{uuid}.pdf`.
4. Insert a fresh `documents` row (`isTemplate = false`, cloned `placementFields`,
   `pageCount`, `fileSize`, `hash` = SHA-256 of the copied bytes, `storagePath` → drafts).
5. Create a package named after the template and a `documentAssignments` row.
6. If the template has `signatories`, insert a `package_recipients` row per placeholder
   (`role` signer, `email` null, **id preserved** so cloned `placementFields`' `assignedTo`
   stays valid, `recipientId` 1..N) — they land as default signers in step 2.
7. Redirect to `/doc/new/{packageId}` (step 2).
8. `useCount += 1`, `lastUsedAt = now`. Template row and file are untouched.

> **Micro-decision (recommended):** always **copy** on instantiation (never move or
> reference) — the template stays immutable and reusable, and the cloned document is
> a fully independent draft (delete/remove semantics are unchanged).

## 5. Routes & actions

All under auth (`locals.user` required; anonymous/guest → redirect `/login`).

| Route / action | Purpose |
|---|---|
| `GET /templates` (load) | List owned templates: name, page count, last used, usage count, + signed preview URL. |
| `uploadTemplate` | Multipart PDF upload on the page → normalize → store in `templates` bucket → create `documents` (isTemplate) + `templates` rows. |
| `startFromTemplate` | Clone into a new package (see §4.3) → redirect to step 2. |
| `renameTemplate` | Update `templates.name`. |
| `deleteTemplate` | Best-effort remove the `templates` bucket file, then delete `templates` + `documents` rows (mirror `removeFile` semantics; block nothing on storage error). |
| `GET /templates/[templateId]` (load) | **Template field editor**: signed PDF URL + `placementFields` (owner-only). |
| `saveFields` (on the editor) | Persist the template's `placementFields` to its `documents` row **and** the `signatories` placeholders to `templates.signatories` (reuses the step-2 field tools / PDFViewer; fields can be pre-assigned to a placeholder via right-click). |
| `saveTemplate` (from `/doc/new` step 1 & step 2) | Copy the just-uploaded/prepared document into a template (reuses §4.2; step 2 also carries `placementFields`). |
| Preview | Signed URL for the `templates` object served via `<iframe>`/`<embed>` (reuse the `getSignedUrl` caching pattern from the sign/view flows). |

## 6. UI

- **`/templates` page** — consistent with the app's design language (neutral cards,
  `secondary`/`primary` gradients, dark-mode aware):
  - Header: title + count, "Upload template" button (opens the same file picker as uploads).
  - Grid of template cards: preview thumbnail (or PDF viewer), name, page count,
    "Used N times · Last used <date>", actions **Preview / Rename / Delete / Use**.
  - **Empty state:** "No templates yet" + upload CTA.
- **`/doc/new` step 1** — wire the existing "Use Template" card to the template list
  (modal like `RecentlyUploaded`, or reuse the `/templates` page); add a "Save as
  template" action on uploaded files.
- **Step 2 (prepared package)** — "Save as template" per document carries placement fields.
- **Template editor (`/templates/[templateId]`)** — field tools + PDFViewer (`mode="design"`),
  plus a **Signatories** panel (add/rename/remove `Person N` placeholders). Right-click a
  field to assign it to a placeholder; fields stay generic if unassigned. `allowMe={false}`
  so placeholders replace the self-"Me" option.

## 7. Permissions & security

- Per-user: only the owner can view, instantiate, rename, delete their templates.
- Auth-gated; anonymous users can't reach `/templates`.
- `templates` bucket is private; files are only accessed via signed URLs generated by
  server actions after an ownership check (same baseline as `drafts`).
- RLS on `templates` (owner-only) and `documents.isTemplate` never exposes template
  rows through `/doc/list` or the dashboard.
- No sharing in v1 (future: org/team sharing via a `teamId` column).

## 8. Out of scope (future)

- v2 **merge fields** (`{{field}}` placeholders).
- ~~Signatory placeholders / default signers on a template~~ — **implemented 2026-08-28** (editor "Signatories" panel → `templates.signatories` → default `package_recipients` signers on instantiation).
- Org / shared / team templates.
- Template folders/categories, versioning, duplicate detection.
- ~~Editing a template's fields after creation~~ — **implemented 2026-08-28** (template editor at `/templates/[templateId]`).

## 9. Acceptance criteria

1. Uploading a PDF on `/templates` creates a template visible in the list.
2. "Save as template" from `/doc/new` step 1 and step 2 both create templates (step 2 keeps placement fields).
3. "Use"/"Start from" clones PDF + fields into a new package and lands on step 2; `useCount` increments and `lastUsedAt` updates.
4. Template files live in the `templates` bucket; instantiated docs land in `drafts`; the template file is never modified.
5. Only the owner sees/uses their templates (other users see an empty/unauthorized list).
6. Template documents never appear as standalone drafts on `/doc/list` or the dashboard, and can't be sent directly.
7. Preview, rename, and delete work; delete also removes the storage file best-effort.
8. Nav "Templates" links to `/templates` (not `/`).

## 10. Implementation notes / dependencies

- Drizzle migration: `documents.isTemplate` + `templates` table + RLS policies (via `drizzle-kit generate`, never hand-edit).
- `templates` bucket created 2026-08-28.
- Reuse `convertToPdf` (normalization), `getSignedUrl`/cache (preview), and the `removeFile` storage-cleanup pattern (delete).
- Update nav config (`(app)/+layout.svelte`) so "Templates" → `/templates`.
- Add `e2e/templates` smoke spec (mirror the `e2e/documents` suite) once implemented.
