# Signing Workspace Features — Section 5 cluster

> Status: **Draft — design, not implemented**
> Created: 2026-08-16
> Repo: `diego-yason/pirma`
> Related:
> - `docs/ai/roadmap.md` §5 (password reset, templates, contacts, viewers enforcement, reject flow)
> - `docs/ai/signing/email-notifications.md` (email foundation these features depend on)
> - `docs/ai/identity/guest-tokens.md`
> - `src/routes/(app)/doc/[pageId]/+page.server.ts` (viewers TODO)
> - `src/routes/(app)/doc/[pageId]/sign/+page.server.ts` (`reject` stub)
> - `src/routes/(app)/doc/new/+page.svelte` (template UI stub)

This doc covers the smaller "signing workspace" gaps from roadmap §5, in the agreed working
order. Each section is standalone.

---

## 1. Password reset

**Purpose:** let users recover access via email (the "Forgot password?" button is currently a
dead button on `login/+page.svelte`).

**Design**
- Wire `login/+page.svelte` "Forgot password?" → `authClient.requestPasswordReset({ email,
  redirectTo: "/reset-password" })` (Better Auth built-in).
- New `src/routes/reset-password/+page.svelte` (+ server action) — reads the reset token from
  the URL, lets the user set a new password via `authClient.resetPassword`.
- Add a **reset** email template (`email-notifications.md` #6).
- Depends on the email module being live — same provider/config.

**Open:** link expiry is Better Auth default (1h); confirm route naming.

---

## 2. Document templates

**Purpose:** the "Use Template" / "Select Template" panel on `doc/new/+page.svelte` (and the
nav "Templates" → `/`) are UI stubs. Two scopes:

- **v1 (recommended first): "Start from a saved document"** — mark any uploaded document as a
  template; instantiating it creates a new package cloning the PDF + placement fields. No
  merge/variable handling.
- **v2: merge fields** — templates contain `{{field}}` placeholders (signer name, date, etc.)
  filled at instantiation from recipient data.

**Design (v1)**
- `templates` table: `{ id, userId (owner), documentId FK, name, createdAt }` (a document can
  be flagged `isTemplate` on `documents` instead — simpler).
- UI: on `doc/new`, "Templates" lists owned templates; selecting clones the document
  (`documents` row + storage copy or reuse same storagePath) into the package creation flow.

**Open (Q5.3):** confirm v1-only first vs. v2 merge fields; whether templates are per-user or
shared (orgs later).

---

## 3. Contacts

**Purpose:** a saved list of name/email to pre-fill package recipients (nav "Contacts" → `/`).

**Design**
- `contacts` table: `{ id, userId, name, email, createdAt }`, unique `(userId, email)`.
- CRUD page at `/contacts` (or inside Settings).
- In the recipient-add UI (`doc/new/[packageId]/confirm`), autocomplete by email from the
  user's contacts.

**Open:** dedupe by email per user (assumed); whether contacts sync with org members later.

---

## 4. Package viewers enforcement

**Purpose:** `packageViewers` table + dashboard join exist, but document access ignores
viewers (`doc/[pageId]/+page.server.ts` has `// TODO: also check package_viewers`).

**Design**
- Access rule for `/doc/[pageId]` (and the document list/view):
  - **owner**, or
  - **recipient** (any role in `packageRecipients`), or
  - **package viewer** (`packageViewers`).
- Implement a small helper, e.g. `canAccessPackage(userId, packageId)` used by the load
  functions (`doc/[pageId]`, `doc/list`, `doc/[pageId]/view`, `doc/[pageId]/sign`).
- Viewers get **read-only** access (no signing UI, no field editing).
- Tie into `documents.detailedViewAccess` (`public`/`restricted`): `restricted` shows full
  detail to authorized users only; `public` already shows hash + status anonymously (per
  schema comment). Viewers should follow the same authorization path as recipients.

**Open:** should viewers be per-package only (current model) or also per-document; and should
`/sign` enforce "viewers cannot sign" explicitly.

---

## 5. Reject flow completion

**Purpose:** the `reject` action is a stub — no status change, no reason, no owner
notification.

**Design**
- `reject` action (in `sign/+page.server.ts`):
  1. Verify the party is a signatory (same check as `finalize`).
  2. Set the signer's `signatures.status = 'rejected'` for the package's documents (pending
     ones), set `rejectedAt`.
  3. Store the reason.
  4. Notify the owner (email `rejected` + reason).
- Schema: add `rejectedAt: timestamp` and `rejectionReason: text` to `signatures` (or a
  dedicated `rejections` table if multiple re-jections per document should be retained).
  Recommend a `rejections` table `{ id, documentId, signerUserId, reason, createdAt }` for a
  full audit trail.
- Client: `handleReject` already collects a reason via the modal — submit it; after success
  navigate to the doc view (replace the `// TODO: navigate…`).
- Owner can then **re-invite** (new token) or **replace the signer** (roadmap §8.1).

**Open:** whether rejection voids the whole package or just that signer; re-invite vs. cancel
default.

---

## Cross-cutting

- All features depend on the email module (`email-notifications.md`) for reset + reject
  notifications.
- Schema additions (templates/contacts/viewers-already-exist/rejections) all go through
  `drizzle-kit generate` (never hand-edit migrations).

## Open decisions summary

1. Templates: v1 clone-only vs. v2 merge fields (Q5.3).
2. Contacts: dedupe + org-sync later.
3. Viewers: per-package only; `/sign` explicitly blocks viewers.
4. Reject: per-signer rejection (recommended) vs. package-level void; reason via `rejections`
   table.
