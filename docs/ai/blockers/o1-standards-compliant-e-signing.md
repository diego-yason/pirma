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

---

## 2. Blockers

| # | Blocker | Type | Impact | Status | Unblock path |
|---|---|---|---|---|---|
| B1 | **Guest finalize unsupported** — `sign/+page.server.ts` returns `fail(400, "Guest finalize not yet supported")`. Guests can open the sign page and fill fields but **cannot actually sign/finalize**, even though guest signing with email OTP is an advertised feature. | Functional (signing) | Guests (a first-class recipient flow) are blocked from completing the primary action. | 🔴 | Let `party.type === "guest"` finalize with a session (L1) key, store against the linked recipient, and validate ownership the same way as authenticated signers. |
| B2 | **`signatures.field_values` migration pending** — the jsonb column is in the runtime schema but the hand-written drizzle migration (`0003_field_values.sql`) + journal entry were reverted. | Tech-debt | Field values are stored at runtime but not tracked in migrations; fresh DBs won't have the column. | 🔴 | Generate + apply the drizzle migration (`db:generate` / `db:migrate`). |
| B3 | **Non-PDF uploads not converted/renderable** — `doc/new` accepts PDF/DOCX/JPG/PNG, but only PDFs render (pdfjs-dist) and nothing converts to PDF/A. The error message also misleadingly says "Only PDF files are allowed". | Feature (ingestion) | Blocks flattening/PDF-A for non-PDF uploads; inconsistent UX. | 🟡 | Decide DOCX/JPG/PNG policy: convert at ingestion (mupdf/Ghostscript) or restrict to PDF; fix the error message. |
| B4 | **Blockchain anchoring unimplemented** — `signatures.status` never reaches `anchored` (spec only). The `executed` transition works without it. | Feature (verification) | No independent on-chain proof; marketing promises anchoring. | 🟢 | Build `signature_anchors` + anchor client (roadmap §2); anchor the artifact hash once artifacts exist. |
| B5 | **PAdES deferred (P3)** — Option B locked in docs, but the embedded PAdES-BASELINE-T signature isn't built. | Feature (compliance) | The objective's compliance end-state isn't reached yet. | 🟡 | After flattening (Phase 2), build cert/CMS/TSA modules + two-step `finalize` (pades-baseline-t-spec.md). |

## 3. Not blockers (polish / separate track)

- Stale language-server `Cannot find module` warning on the sign server (clears on save/reload).
- Pre-existing lint nit (`no-useless-assignment`) in the `reject` action.
- `date` / `initials` field kinds (planned; not needed for flattening).
- PAdES `0003`-era migration references already corrected in docs.

## 4. Suggested order

1. **B2** — apply the pending `field_values` migration (one command).
2. **B1** — implement guest finalize (small; core functional gap for the guest flow).
3. **B3** — decide the non-PDF upload policy (needed before/with flattening).
4. **Flattening** (next major feature) — burn signature images + field values into a
   signed PDF/A artifact; this is the foundation for B5 (PAdES Phase 2).
5. **B5** — PAdES (Phase 3) after flattening.
6. **B4** — blockchain anchoring can proceed in parallel once artifacts/hashes exist.

> Related: `docs/ai/roadmap.md` · `docs/ai/pdfa/pades-baseline-t-spec.md` ·
> `docs/ai/pdfa/pdfa-compliance.md` · `docs/ai/blockchain/blockchain-integration.md`
