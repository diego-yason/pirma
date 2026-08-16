# Notary — Commission, ION, and the Journal (private blockchain)

> Status: **Draft — design, not implemented**
> Created: 2026-08-16
> Repo: `diego-yason/pirma`
> Related:
> - `docs/ai/pdfa/document-flows.md` — Flow B (notary): v1.x revision, notary step, no audit pages
> - `docs/ai/blockchain-integration.md`, `docs/ai/blockchain-microservice/` — anchoring mechanism
> - `docs/ai/roadmap.md` §8.4 (notary-specific features)
> - `docs/ai/pdfa/pdfa-compliance.md` — artifacts, PAdES, certificates

> **Defaults used** (call out anything to change): the notary is a platform user with a stored
> commission record; ION is in-person notarization producing a v1.x artifact + notary
> certificate; the journal is append-only, sequentially numbered per notary, with each entry
> anchored to a **private blockchain** using the same mechanism described in the blockchain
> docs.

---

## 1. Notary commission

**Purpose:** a user must hold a valid commission to act as a notary on the platform.

**Design**
- `notaries` table (one row per notary-capable user):

  ```ts
  notaries = pgTable("notaries", {
    id: uuid PK,                       // references user.id (the notary account)
    licenseNumber: text notNull,
    state: text notNull,               // jurisdiction / commission state
    commissionExpiresAt: timestamp notNull,
    commissionDocumentPath: text,      // uploaded commission PDF (storage)
    verifiedAt: timestamp,             // when platform approved it (nullable)
    revokedAt: timestamp,              // nullable
    createdAt: timestamp notNull defaultNow(),
  })
  ```

- Becoming a notary = user submits commission details + PDF; an admin/platform approval sets
  `verifiedAt` (v1 can be auto-verified with a flag; keep the column for later).
- A notary can only notarize while `commissionExpiresAt` is in the future and `revokedAt` is
  null. This is enforced where the notary is assigned/acts.

### Compliance requirements (required to provide the notary service)

A user may only be assigned to / perform notarial acts after completing **all four** of the
following (each recorded with a timestamp + proof ref; none can be skipped):

1. **Notary process video** — must watch the platform's notary process/training video.
2. **Short quiz** — must pass the post-training assessment (ION flow, ack vs. jurat, witnesses,
   journal/ROR rules, jurisdiction rules).
3. **Certificate issuance** — a notary certificate is issued (completion/authorization); surfaced
   on the notary's certificate / verify page per §4.
4. **Application form** — a court application form is completed and filed by the **platform**
   (managed in-app): the platform renders the per-jurisdiction form, transmits it to the court,
   and records the filing status + proof of submission.

**Court filing (platform-managed):** the platform renders the per-jurisdiction application form
(e-filing API, email, or print/postal vendor — decision below), transmits it to the court, tracks
the filing status (`draft → submitted → delivered/accepted → rejected`), and stores the proof
ref. The notary sees filing status + outcome in-app and via the email/notification loop.

Tracked in a `notary_compliance` table (one row per notary):

```ts
notaryCompliance = pgTable("notary_compliance", {
  id: uuid PK,
  notaryUserId: uuid FK notNull,               // references notaries.id
  videoWatchedAt: timestamp,                    // 1 — notary process video
  quizPassedAt: timestamp,                      // 2 — short quiz (store score + quizVersion)
  certificateIssuedAt: timestamp,               // 3 — certificate issuance (certificateId)
  courtApplicationSubmittedAt: timestamp,       // 4 — application form filed by the platform
  courtApplicationPath: text,                   // rendered form / retained copy
  courtFilingStatus: text({ enum: ["draft","submitted","delivered","accepted","rejected"] }),
  courtFilingRef: text,                         // court / filing reference from the court
  courtFilingAt: timestamp,                     // when the court acknowledged delivery
  updatedAt: timestamp notNull defaultNow(),
})
```

**Gating:** notary assignment and `finalize` check the `notaries` row **and** that all four
compliance steps are complete (for #4, `courtFilingStatus` ≥ `submitted`). Renewal behavior
(re-run video/quiz on commission renewal vs. one-time) is an open decision below.

## 2. Notary on a package

- `packages.notaryUserId` (uuid FK, nullable) assigns a notary (per `document-flows.md`).
- Only users with a valid (non-expired, non-revoked) `notaries` record can be assigned.

## 3. ION — in-person notarization

**Purpose:** the notary completes the notarial act in person, on the v1.x revision.

**Design**
- `notarizations` table per package:

  ```ts
  notarizations = pgTable("notarizations", {
    id: uuid PK,
    packageId: uuid FK notNull,
    notaryUserId: uuid FK notNull,
    actType: enum("acknowledgment" | "jurat") notNull default("acknowledgment"),
    inPerson: boolean notNull default(true),      // true = ION, false = RON (future)
    signerIdsPresent: jsonb notNull default([]),  // recipients physically present
    documentVersion: text notNull default("v1.x"),
    notes: text,
    performedAt: timestamp notNull defaultNow(),
  })
  ```

- Flow: after parties sign **v1**, the notary opens the notary step on the package → confirms
  the act type + who is present → signs **v1.x** (produces the notary certificate + PAdES, per
  `pdfa-compliance.md` Phase 2/3) → the `notarizations` row is written → platform certificate
  (no audit pages) per Flow B.
- **RON** (remote) is the same table with `inPerson: false` plus an audiovisual session record
  — deferred (roadmap §8.4); the schema leaves room for it.

## 4. Ack / jurat, witnesses, seal/QR

- **Act type** is captured above (`acknowledgment` vs `jurat`) and drives the notarial wording
  rendered into the certificate (per-jurisdiction templates — decision needed).
- **Witnesses** are modeled as recipients with a `witness` role (same mechanics as a party,
  different label) — no new entity.
- **e-notary seal / QR** (subject to rules):
  - The notary certificate embeds a **QR code** encoding a **verify URL + certificate hash**
    (plus `anchorId` once the certificate is anchored).
  - The QR resolves to a **public verify page** (`/verify?hash=…`) showing certificate status,
    PAdES validity, and journal/blockchain anchor — ties into `pdfa-compliance.md` Phase 4 and
    the blockchain `verify` surface.
  - Rules: QR/verify only emitted for **confirmed** notarizations; the verify page never
    exposes PII — only hashes + status (blockchain data-minimization).
  - Data: certificate artifact gains `qrPayload` / `verifyUrl` / `sealHash`.

## 5. Notary journal (ROR) — private blockchain

**Purpose:** a required, append-only record of every notarial act, protected by its own
**private blockchain**. Uses the exact anchoring mechanism from the blockchain docs, but
pointed at a private journal chain.

**Design**

```mermaid
flowchart LR
    N[Notarization completes] --> E[Build canonical journal entry]
    E --> H[payloadHash = sha256(canonical entry JSON)]
    H --> P[Submit to PRIVATE chain: POST /v1/anchor]
    P --> A[(notary_journal_entries)]
    A --> W[Webhook / poll → confirmed]
```

- `notary_journal_entries` (local source of truth):

  ```ts
  notaryJournalEntries = pgTable("notary_journal_entries", {
    id: uuid PK,
    notaryUserId: uuid FK notNull,
    entryNumber: integer notNull,          // sequential ROR number per notary
    packageId: uuid FK,
    artifactHash: text notNull,            // hash of the notarized v1.x artifact
    actType: text notNull,
    signerCount: integer notNull,
    prevEntryHash: text,                   // previous entry's payloadHash (hash chain)
    payloadHash: text notNull unique,      // sha256 of canonical entry JSON
    anchorId: text,                        // private-chain id
    status: enum("submitted"|"pending"|"confirmed"|"failed") notNull default("submitted"),
    proofJson: jsonb,                      // merkle/receipt for offline verification
    submittedAt: timestamp notNull defaultNow(),
    confirmedAt: timestamp,
  })
  ```

- **Entry payload** (canonical, **PII-free** — per blockchain data-minimization rules):

  ```jsonc
  {
    "notary": "<notaryUserId>",
    "entryNumber": 42,
    "artifactHash": "<hex>",
    "actType": "acknowledgment",
    "signerCount": 2,
    "performedAt": "2026-08-16T12:00:00Z",
    "prevEntryHash": "<sha256 of prior entry payloadHash>"
  }
  ```

- **Integrity:** `entryNumber` is strictly sequential per notary; `prevEntryHash` links each
  entry to the prior one (hash chain), so any gap or tamper breaks the chain — verified
  locally and against the private chain.
- **Anchoring:** each `payloadHash` is submitted to the **private journal chain** via the same
  `anchor-client` (`POST /v1/anchor`, poll/webhook) described in the blockchain docs; the
  `anchorId` + `proofJson` are stored. Confirmed → the journal entry is immutable.
- **Query/audit:** a notary can list their journal (ROR report); entries are also surfaced on
  the notary certificate / verify page.

**Open decisions**
1. Should the private journal chain be a **separate endpoint/config** (`JOURNAL_CHAIN_URL`) vs.
   a namespace on the existing blockchain service? (Assumed: separate config, same mechanism.)
2. Canonical-entry serialization (sort keys, ISO-8601) — reuse the §8 payload spec approach.
3. Who can read the journal — notary + platform only vs. public-by-hash.

## 6. Schema summary (all via `drizzle-kit generate`)

- `notaries`, `notarizations`, `notary_journal_entries`, `notary_compliance` (new)
- `packages.notaryUserId` (column add)
- `packageRecipients.role` gains `witness` (future, with ack/jurat wording)

## 7. Dependencies / order

- Requires the **email/notifications** module (notify notary + parties) and the
  **PDF/A Phase 2/3** (v1.x artifact + notary certificate/PAdES) to produce what the journal
  anchors.
- Journal anchoring requires the **blockchain anchor client** (§2 of roadmap).

## 8. Open decisions summary

1. Commission auto-verify vs. admin approval (default: admin-approve, flag for auto).
2. RON scope deferred (schema leaves `inPerson: false`).
3. Ack/jurat wording: per-jurisdiction templates (needed before certificates).
4. Journal chain: separate endpoint/config (assumed).
5. Journal read access: notary + platform (default).
6. **Compliance gating**: enforce all four requirements before first notarization (recommended)
   vs. allow application + court transmission post-hoc.
7. **Certificate issuer**: platform vs. the court/commissioning authority (per jurisdiction).
8. **Court filing channel** (platform-managed): e-filing API, email, or print/postal vendor —
   per jurisdiction; the platform handles transmission + status tracking.
9. **Renewal**: re-run video + quiz on commission renewal, or one-time per jurisdiction.
