# O1 — Standards-Compliant Electronic Signing — Blockers

> **Objective (O1 — see `../core-objectives.md`):** deliver **standards-compliant
> electronic signing** — every package goes from *request → sign → flatten →
> verify* as a **PAdES-compliant PDF/A artifact**, anchored on-chain, for both
> registered users and guests.
>
> This document tracks the blockers between the current state and that objective.
> It complements `docs/ai/roadmap.md` (living plan) and
> `docs/ai/pdfa/pades-baseline-t-spec.md` (PAdES spec).

> **Status legend:** 🔴 blocking · 🟡 partial / affects quality · 🟢 context / not blocking
>
> **Created:** 2026-08-23 · **Repo:** `diego-yason/pirma` · **Branch:** `dev`

---

## 1. Current state (what works)

The **authenticated** core signing loop is implemented end to end:

- Field placement (step 2) + declarative field system (`signature`, `text`,
  `choices`, `phone`, `checkbox`, `radio`) + config editors + unassigned-field guard.
- Sign-stage value widgets + client-side value collection.
- Client signing in the service worker (L1 session / L2 password-bound ECDSA P-256),
  one signature per document over the strengthened payload (fields + values hash).
- Server `finalize`: authorization, field ownership, key-tier + rotation policy,
  per-kind value validation, sequential signing order, storage on `signatures`,
  `executed` transition, email notifications.
- Decision locked: **Option B (2026-08-23)** — PAdES replaces the custom text-payload
  signature; anchor targets the artifact hash.
- Guest finalize (2026-08-23): a linked guest signs via the authenticated flow; a
  token-only finalize escalates to the linked user, and an unlinked guest is prompted
  to verify their email (OTP).
- `signatures.field_values` migration applied (`drizzle/0003_demonic_firedrake.sql`).
- Ingestion conversion (2026-08-23): JPG/PNG are converted to a single-page PDF at
  upload via pdf-lib (`src/lib/server/ingest/convert-to-pdf.ts`); the hash + page count
  are computed over the stored PDF; DOCX is deferred with a clear message.

---

## 2. Blockers

| # | Blocker | Type | Impact | Status | Unblock path |
|---|---|---|---|---|---|
| B1 | **Guest finalize unsupported** — guests could open the sign page and fill fields but **couldn't actually sign/finalize**. | Functional (signing) | Guests (a first-class recipient flow) were blocked from completing the primary action. | ✅ resolved 2026-08-23 | `resolveParty` returns the recipient's linked `userId`; `finalize` escalates a linked guest to the authenticated flow, and prompts unlinked guests to verify their email (OTP). |
| B2 | **`signatures.field_values` migration pending** — the jsonb column existed in the runtime schema but no migration tracked it. | Tech-debt | Fresh DBs wouldn't have the column. | ✅ resolved 2026-08-23 | Migration applied: `drizzle/0003_demonic_firedrake.sql` adds `signatures.field_values jsonb`. |
| B3 | **Non-PDF uploads not converted/renderable** — DOCX/JPG/PNG were accepted but only PDFs rendered. | Feature (ingestion) | Non-PDF uploads were unusable; misleading error message. | ✅ resolved 2026-08-23 | Decision: **convert at ingest**. JPG/PNG → single-page PDF via pdf-lib (`src/lib/server/ingest/convert-to-pdf.ts`); hash + page count computed over the stored PDF; accurate error messages. **DOCX deferred** (needs LibreOffice/microservice — see pdfa doc §4). |
| B4 | **Blockchain anchoring unimplemented** — `signatures.status` never reaches `anchored` (spec only). The `executed` transition works without it. | Feature (verification) | No independent on-chain proof; marketing promises anchoring. | 🟢 | Build `signature_anchors` + anchor client (roadmap §2); anchor the artifact hash once artifacts exist. |
| B5 | **PAdES deferred (P3)** — Option B locked in docs, but the embedded PAdES-BASELINE-T signature isn't built. | Feature (compliance) | The objective's compliance end-state isn't reached yet. | 🟡 | After flattening (Phase 2), build cert/CMS/TSA modules + two-step `finalize` (pades-baseline-t-spec.md). |

## 3. Not blockers (polish / separate track)

- Stale language-server `Cannot find module` warning on the sign server (clears on save/reload).
- Pre-existing lint nit (`no-useless-assignment`) in the `reject` action.
- `date` / `initials` field kinds (planned; not needed for flattening).
- PAdES `0003`-era migration references already corrected in docs.

## 4. Suggested order

1. **B2** — ✅ `signatures.field_values` migration applied (`0003_demonic_firedrake.sql`).
2. **B1** — ✅ guest finalize implemented (linked-guest escalation + OTP prompt).
3. **B3** — ✅ non-PDF upload policy decided: convert JPG/PNG at ingest (pdf-lib);
   DOCX deferred to the microservice path.
4. **Flattening** (next major feature) — burn signature images + field values into a
   signed PDF/A artifact; this is the foundation for B5 (PAdES Phase 2).
5. **B5** — PAdES (Phase 3) after flattening.
6. **B4** — blockchain anchoring can proceed in parallel once artifacts/hashes exist.

> Related: `docs/ai/roadmap.md` · `docs/ai/pdfa/pades-baseline-t-spec.md` ·
> `docs/ai/pdfa/pdfa-compliance.md` · `docs/ai/blockchain/blockchain-integration.md`
