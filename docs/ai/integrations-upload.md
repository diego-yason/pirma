# Integrations — Upload Sources

> Status: **Draft — design, not implemented**
> Created: 2026-08-16
> Repo: `diego-yason/pirma`
> Related:
> - `docs/ai/roadmap.md` §8.7
> - `src/routes/(app)/doc/new/+page.svelte` (upload UI)

## Purpose

Allow importing documents from external sources — **solely for uploading into the system**
(no outbound sync/CRM features).

## Sources (v1)

| Source | Auth | Notes |
|---|---|---|
| **Google Drive** | OAuth 2.0 (scoped to Drive read) | pick file → import to `drafts` |
| **Dropbox** | OAuth 2.0 | pick file → import |
| **OneDrive** | OAuth 2.0 | pick file → import |
| **Local** (already exists) | — | existing upload path |

## Design

- A generic "import provider" interface in `src/lib/server/import/`:
  `authorize(userId)`, `listFiles(userId, query?)`, `fetchFile(userId, fileId)`.
- OAuth tokens stored encrypted per user (`user_tokens` table); refresh handled.
- Imported files flow through the **same ingestion pipeline** (→ PDF/A conversion → hash →
  `documents`), so provider imports are indistinguishable from local uploads downstream.
- `document.imported` audit event with provider + file id.

**Open decisions**
1. v1 provider priority: **Google Drive first** (largest share), then Dropbox/OneDrive.
2. OAuth token storage (encrypted at rest; reuse existing `device-info`-style secret handling).
3. File-type policy identical to upload (PDF/DOCX/JPG/PNG → PDF/A).
