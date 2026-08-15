# Storage Tiering (hot → cold → arctic)

> Status: **Draft — design, not implemented**
> Created: 2026-08-16
> Repo: `diego-yason/pirma`
> Related:
> - `docs/ai/roadmap.md` §8.4 (data-saving process), §8.1 (retention)
> - `src/lib/server/storage/supabase.ts` (`drafts`, `signatures` buckets)
> - `docs/ai/pdfa/pdfa-compliance.md` (artifacts)

## Purpose

Reduce storage cost over time by moving documents/artifacts through colder storage tiers as
they age, while keeping them retrievable and verifiable.

## Tiers

| Tier | Storage | Trigger (defaults) | Cost/Retrieval |
|---|---|---|---|
| **Hot** | Supabase (current buckets) | created → `executed` | fast, primary |
| **Cold** | Object storage (S3-compatible archive bucket) | `executed` + 90 days | slow-ish, one-click rehydrate |
| **Arctic** | Glacier-class / immutable (write-once) | `executed` + 2 years | archival, long retrieval |

- Triggers are configurable (`STORAGE_TIER_DAYS_HOT=90`, `STORAGE_TIER_DAYS_COLD=730`).
- **Arctic should be immutable** (write-once) — the natural home for final signed artifacts +
  certificates + audit checkpoints.

## Design

- `documents`/artifacts keep a `storageTier` enum + `tierMovedAt`; the storage **path stays the
  same** (metadata resolves to the tier bucket).
- A scheduled job moves objects and updates tier; downloads auto-rehydrate from cold/arctic
  (with an async "prepare download" for arctic if retrieval is long).
- The **hash chain / audit + blockchain anchors** reference content hashes, so tier changes
  never affect verifiability (hashes are of bytes, not location).
- Retention/purge (`document-package-management.md` §4) composes on top of tiering.

## Open decisions

1. Tier trigger: time-based (default) vs. also status-based.
2. Arctic provider: AWS Glacier / S3 Object Lock (immutability), or a third-party archive.
3. Whether signature images + audit logs also tier (recommend: yes, images cold; audit kept hot
   for query).
4. Rehydration UX for arctic (async link/email vs. sync wait).
