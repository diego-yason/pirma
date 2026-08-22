# Core Objectives

> **Purpose:** the canonical list of high-level objectives the platform serves,
> derived from `docs/ai/roadmap.md` (the living plan). The `blockers/` documents
> are **named after these objectives** and track what blocks them.
>
> **Created:** 2026-08-23 · **Repo:** `diego-yason/pirma` · **Branch:** `dev`
> **Status legend:** ✅ implemented · 🚧 partial / in progress · 🔲 planned · ⚠️ decision needed

---

## Primary objective

> **Standards-compliant electronic signing** — every package goes from *request →
> sign → flatten → verify* as a **PAdES-compliant PDF/A artifact**, anchored
> on-chain, for registered users and guests.
>
> Gates: `docs/ai/blockers/standards-compliant-e-signing.md`

---

## Objectives at a glance

| # | Objective | Status | Roadmap refs |
|---|---|---|---|
| **O1** | Standards-compliant electronic signing | 🚧 | §1, §3, §8.1 |
| **O2** | Secure identity & key management | 🚧 | §1, §6 |
| **O3** | Independent long-term verifiability (PDF/A + anchoring) | 🔲 | §2, §3 |
| **O4** | Guest & recipient journey | 🚧 | §4, §5, §8.2 |
| **O5** | Trust, audit & compliance | 🔲 | §8.3, §8.5 |
| **O6** | E-notary expansion | 🔲 | §8.4 |
| **O7** | Platform growth (orgs, commercial, integrations, support) | 🔲 | §8.6–§8.8 |
| **O8** | Technical health | 🔲 | §7 |

---

## O1 — Standards-compliant electronic signing  🚧

The heart of the platform: a complete, legally-defensible signing loop that ends
in a **PAdES-compliant, PDF/A** signed artifact.

- **Done:** declarative field system (`signature`/`text`/`choices`/`phone`/
  `checkbox`/`radio`) + value collection/validation/binding; authenticated signing
  loop (SW keys → `finalize` → `executed`); email notifications; unassigned-field guard.
- **Partial:** guest signing (finalize **blocked** — see blockers B1); reject flow (client dialog TODO).
- **Planned:** PDF/A flattening (Phase 2), PAdES-BASELINE-T (Phase 3, **Option B**),
  verification (Phase 4), certificate artifacts.
- **Decision:** PAdES cert strategy ✅ (self-signed + TSA); Option B locked (PAdES-only).
- **Roadmap:** §1 (key & signing), §3 (PDF/A & flows), §8.1 (lifecycle), P1/P3 matrix.

## O2 — Secure identity & key management  🚧

Cryptographic identity and the keys that back it: client-held keys, tiered by
assurance, with rotation/revocation and MFA.

- **Done:** level-1 session keys (SW memory, non-extractable); level-2
  password-bound persistent keys (random per-key salt); upload endpoint revokes
  prior same-level keys; `finalize` enforces `kid`/`keyLevel`; key rotation +
  revocation at signing; MFA/tier-2 enforcement; SW RPC ID-prefix isolation.
- **Partial/decision:** email verification ⚠️, 2FA ⚠️ (Better Auth plugins not enabled),
  package expiration ⚠️.
- **Planned:** persist signing challenges + rate-limit `/api/keys/challenge`; signer
  identity verification (SMS OTP, KYC/ID, knowledge-based).
- **Roadmap:** §1, §6, §8.3.

## O3 — Independent long-term verifiability (PDF/A + anchoring)  🔲

Produce artifacts that anyone can verify against standards and an immutable,
independent trail.

- **PDF/A:** ingestion conversion (Phase 1) → signed artifact generation (Phase 2) →
  verification (Phase 4) — all 🔲.
- **Blockchain anchoring:** `signature_anchors` + anchor client + auto-anchor by
  **artifact hash** + `signed → anchored` — all 🔲 (spec'd; `anchored` never set).
- **Post-quantum:** PQC Merkle-root anchoring (supplementary) 🔲.
- **Roadmap:** §2, §3; `docs/ai/blockchain/blockchain-integration.md`, `docs/ai/pdfa/*`.

## O4 — Guest & recipient journey  🚧

Let anyone sign — registered or not — with a smooth, supported experience.

- **Done:** guest tokens + email OTP (`guest_otps`, migration `0002`); signer email
  invitations + notifications; owner sign/reject notifications; password reset;
  package-viewer permission enforcement.
- **Partial:** guest **finalize blocked** (blockers B1); reject flow completion 🚧;
  signer invites ⚠️ (in-app/activity feed pending).
- **Planned:** enforce `guestTokens.revokedAt`; email binding of token; JWT migration;
  document templates; contacts; token-expiry self-service; guided signing ceremony;
  mobile + accessibility (WCAG).
- **Roadmap:** §4, §5, §8.1, §8.2, §8.8.

## O5 — Trust, audit & compliance  🔲

Evidence and legal posture: what happened, when, and that the process meets the
law's requirements.

- **Planned:** structured audit trail / event log; geolocation + device attestation;
  ESIGN / UETA / eIDAS disclosure & rights; storage tiering (hot → cold → arctic).
- **Roadmap:** §8.3, §8.5; `docs/ai/identity/audit-trail.md`, `docs/ai/identity/identity-verification.md`,
  `docs/ai/compliance/compliance-and-public-api.md`, `docs/ai/platform/storage-tiering.md`.

## O6 — E-notary expansion  🔲

Extend the platform to notaries: commissions, compliance onboarding, journaling,
and remote/in-person notarization.

- **Planned (all 🔲):** notary commission (license/state/expiry); compliance
  onboarding (video + quiz + certificate + court filing); notary journal (ROR, its
  own private blockchain); RON + ION notarization; acknowledgment vs. jurat;
  witnesses; e-notary seal / QR validator.
- **Roadmap:** §8.4; `docs/ai/notary/notary.md`.

## O7 — Platform growth (orgs, commercial, integrations, support)  🔲

Scale beyond single users: teams, commerce, integrations, and self-service help.

- **Planned (all 🔲):** organizations/teams & roles; billing / usage metering;
  admin console; reports / analytics; upload integrations; public developer API +
  webhooks (long after release); help center / FAQ; in-app support form; priority
  notary support channel.
- **Roadmap:** §8.6, §8.7, §8.8; `docs/ai/platform/organizations-and-admin.md`,
  `docs/ai/platform/integrations-upload.md`, `docs/ai/platform/support.md`.

## O8 — Technical health  🔲

Keep the foundation clean so objectives stay buildable.

- **Planned:** replace deprecated `config.alias` (`$plugins`) with subpath imports;
  resolve `src/env.ts` `@migration-task`; fix pre-existing build warnings
  (a11y `href=""`, `state_referenced_locally`); finish/delete `MIGRATION_TASKS.md`.
- **Roadmap:** §7.

---

## How these were derived

From `docs/ai/roadmap.md`: its priority/type matrix (P0–P3), the themed sections
(§1–§8), the *Working order* and *Suggested next steps* sequences, and the
platform's stated identity (e-signature + e-notary, blockchain anchoring, PDF/A
archival, identity verification). Objectives are the **stable goals**; the roadmap
is the itemized plan; `blockers/` tracks what currently blocks each objective.

> Related: `docs/ai/roadmap.md` · `docs/ai/blockers/README.md` ·
> `docs/ai/blockers/standards-compliant-e-signing.md`
