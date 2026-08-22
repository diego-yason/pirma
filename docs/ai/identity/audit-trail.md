# Structured Audit Trail (event log)

> Status: **Draft — design, not implemented**
> Created: 2026-08-16
> Repo: `diego-yason/pirma`
> Related:
> - `docs/ai/roadmap.md` §8.3 (identity, security & audit)
> - `docs/ai/notary/notary.md` §5 (notary journal / ROR — related but separate)
> - `docs/ai/pdfa/document-flows.md` (PDF/A **audit pages** — a rendered artifact; this is the
>   queryable structured log, distinct from those)
> - `docs/ai/blockchain/blockchain-integration.md` (optional checkpoint anchoring)
> - `src/lib/server/logger.ts`, `src/routes/(app)/doc/[pageId]/sign/+page.server.ts`

## Purpose

A **queryable, append-only event log** recording who did what, when, and from where — the
backbone for compliance, dispute resolution, and user-facing activity. This is distinct from:

- **PDF/A audit pages** (`document-flows.md`) — a rendered artifact appended to the document.
- **Notary journal / ROR** (`notary.md`) — the notary's required journal on a private chain.

## Design

```mermaid
flowchart LR
    A[Actions: upload, sign, reject, view, key ops, guest link…] --> W[writeAudit() helper]
    W --> E[(audit_log, append-only)]
    E --> Q[Read: owner / notary / platform]
```

### Schema — `audit_log`

```ts
auditLog = pgTable("audit_log", {
  id: uuid PK,
  eventId: uuid notNull unique,       // idempotency (dedupe retries)
  actorType: enum("user" | "guest" | "system") notNull,
  userId: text,                       // actor (nullable for system/anon)
  packageId: uuid,
  documentId: uuid,
  eventType: text notNull,            // see catalog
  detail: jsonb notNull default({}),  // event-specific payload (reason, field count…)
  ip: text,
  userAgent: text,
  deviceHash: text,                   // from device-fingerprint, when available
  prevHash: text,                     // hash chain (tamper-evidence)
  createdAt: timestamp notNull defaultNow(),
})
```

**Append-only:** no UPDATE/DELETE exposed; a Postgres trigger rejects modifications to
`audit_log` (defense in depth), and app code never writes it after insert.

### Tamper-evidence

- Each row stores `prevHash` = hash of the previous row's content, forming a **hash chain**
  (same idea as the notary journal).
- **Later:** periodically anchor a checkpoint (e.g. daily root hash) to the blockchain via the
  existing anchor mechanism (roadmap §2), so the log's integrity is independently provable.

### `writeAudit()` helper

`src/lib/server/audit.ts` — `writeAudit({ eventType, actor, packageId?, documentId?, detail?, req? })`.
Derives `ip`/`userAgent`/`deviceHash` from the request, computes `prevHash` from the last row,
and inserts with a fresh `eventId` (idempotent on retry).

## Event catalog (initial)

| Event | When | Actor |
|---|---|---|
| `document.uploaded` | Upload succeeds (`doc/new`) | user |
| `document.converted` | PDF/A conversion done (future) | system |
| `package.created` | Package created from uploads | user |
| `recipient.added` / `viewer.added` | Recipient/viewer added | user |
| `document.viewed` | Doc page/viewer opened | user/guest |
| `document.downloaded` | Artifact downloaded (future) | user |
| `signature.finalized` | `finalize` stores signatures | user/guest |
| `signature.rejected` | `reject` action (reason in `detail`) | user/guest |
| `key.uploaded` / `key.registered` | Signing-key ops | user |
| `guest.linked` | Guest token → anonymous user link | guest |
| `anchor.submitted` / `anchor.confirmed` | Blockchain anchoring (future) | system |

## Write points

- `doc/new/+page.server.ts` (upload, package create), `confirm` (recipients/viewers)
- `sign/+page.server.ts` (`finalize`, `reject`)
- `doc/[pageId]/+page.server.ts` + `view` (document viewed)
- `api/guest/link/+server.ts`, `api/keys/*`
- `hooks.server.ts` (sign-in/sign-out) if auth events are wanted

## Read / access

- **Owner** of a package: full audit for their packages.
- **Notary**: audit for packages they notarize (see `notary.md`).
- **Platform/admin**: everything (future admin console).
- Verification page may surface a summary (who signed when) from `audit_log`.

## Config / retention

- Retention: keep **forever** by default (compliance); optional prune flag for non-package
  events (e.g. old auth events).
- No PII beyond IP/UA/deviceHash (same data the app already collects for keys).

## Open decisions

1. **Scope of "viewed"** — record every doc page load (noisy) vs. only signed-in doc viewer
   opens (recommended) vs. a throttled sample.
2. **Hash-chain + periodic blockchain checkpoint** now (recommended) vs. plain log v1.
3. Retention: forever (default) vs. tiered.
4. Read access: owner-only vs. owner + signers/recipients.
5. Whether auth events (sign-in/out) belong in `audit_log` or a separate auth audit.
