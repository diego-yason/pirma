# Document & Package Management

> Status: **Draft — design, not implemented**
> Created: 2026-08-16
> Repo: `diego-yason/pirma`
> Related:
> - `docs/ai/roadmap.md` §8.1
> - `docs/ai/signing/email-notifications.md` (reminder emails)
> - `docs/ai/pdfa/pdfa-compliance.md` (artifacts, download)
> - `docs/ai/identity/audit-trail.md` (events for all actions below)

## 1. Envelope lifecycle controls

| Action | Semantics | Data |
|---|---|---|
| **Void / cancel** | Owner cancels the package before it completes. Recommended: allowed anytime before `executed`; requires a reason. Signing blocked after void. | `packages.voidedAt`, `packages.voidReason` |
| **Replace signer** | Swap a recipient: revoke their old guest token, issue a new one, keep their signed fields (or reset them). | new `packageRecipients`/`guestTokens` row; old token `revokedAt` |
| **Re-send** | Re-issue the invitation email/token (e.g. after reject or expiry). | new token, reuse `email-notifications.md` |

All actions write `audit_log` events (`package.voided`, `recipient.replaced`, `package.resend`).

**Open:** void after partial signatures — keep signatures vs. discard (recommend: keep for the
record, block further signing).

## 2. Reminders & deadlines

- A scheduled job selects packages with outstanding signatures past a nudge threshold and
  sends **reminder** emails (`email-notifications.md` #5). Defaults: day 3, day 7.
- **Deadline:** `packages.expirationDate` exists. Recommend making it a **hard deadline** —
  after it, `finalize`/signing is rejected with a clear error; before it, a soft warning.
  (Open: hard vs. soft — default **hard** for compliance.)

## 3. Download / export

- Download the **PDF/A artifact** (signed/executed) + a **JSON audit blob** (signatures,
  `fieldValues`, certificate references, anchor proof).
- New endpoint `GET /doc/[pageId]/download?format=pdfa|json` (authorized: owner/recipient/viewer
  per access rules). Trigger `document.downloaded` audit event.

## 4. Trash / archive / retention

- **Soft delete**: `documents.removedAt`, `packages.removedAt` (mirrors `userSignatures`).
  Trash UI to restore or purge.
- **Archive**: a status distinct from `executed` (e.g. `archivedAt`) — read-only, hidden from
  active lists.
- **Retention**: configurable per-plan; a job purges after retention (ties to
  `storage-tiering.md`).

## 5. Document search

- v1: indexed queries on `documents` (title, status, owner) + join `packageRecipients`
  (signer name/email) and `signatures`.
- Later: Postgres full-text (`tsvector`) or a search index. Scope: title, signer, status, date.

## Schema additions (via `drizzle-kit generate`)

- `packages`: `voidedAt`, `voidReason`, `archivedAt` (nullable)
- `documents`: `removedAt`, `archivedAt` (nullable)
- Reuse `guestTokens.revokedAt` for replaced/re-sent recipients

## Open decisions

1. Void after partial signatures (keep vs. reset).
2. Hard vs. soft `expirationDate` (default hard).
3. Retention defaults per plan.
4. Search engine: indexed queries vs. FTS (later).
