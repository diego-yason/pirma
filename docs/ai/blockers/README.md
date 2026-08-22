# `blockers` — What's blocking the roadmap

This folder documents the **blockers** standing between the current state of the
platform and its stated objectives. It exists so anyone (or any agent) picking up
the work can immediately see what is stuck, why, how much it matters, and what
unblocks it — without re-deriving it from the codebase or the roadmap.

---

## Purpose

- **Single source of truth for "why isn't X done yet?"** — one place listing the
  concrete, currently-open blockers, with impact and an unblock path.
- **Keeps scope honest.** Distinguishes genuine blockers from mere polish, so time
  isn't spent polishing while a 🔴 blocker still gates the primary action.
- **Naming by objective.** Each document is named after the **objective** it
  gates. The canonical objective list lives in `../core-objectives.md` (derived
  from `docs/ai/roadmap.md`), so this folder reads as "here's what blocks each objective".

---

## How to use this folder

- **Add** a file when a significant, currently-open item is blocking a stated
  objective, or when a new objective emerges. Name it after that objective
  (e.g. `o1-standards-compliant-e-signing.md`).
- **Update** the file as blockers change (resolved, newly discovered, reprioritized).
- **Move a blocker out / mark it resolved** (strike-through or remove) once its
  unblock path is done — keep the folder current, not archival.
- **Don't duplicate the roadmap.** The roadmap (`docs/ai/roadmap.md`) is the
  living plan; this folder is the focused "what's blocking it right now" view.

### Conventions

- **Status legend:** 🔴 blocking · 🟡 partial / affects quality · 🟢 context /
  not blocking.
- Each blocker row includes: **Type** (functional / security / feature /
  tech-debt / compliance), **Impact**, **Status**, and an **Unblock path**.
- Add a **"Not blockers"** section for items that look like gaps but are actually
  polish or on a separate track — saves future readers from chasing ghosts.
- If no explicit primary objective exists in the docs, define one at the top of
  the file (as was done for `o1-standards-compliant-e-signing.md`).

---

## Files

| File | Objective it gates | Contents |
|---|---|---|
| `o1-standards-compliant-e-signing.md` | **O1 — Standards-compliant electronic signing** — every package goes from request → sign → flatten → verify as a PAdES-compliant PDF/A artifact, anchored on-chain, for registered users and guests | Blocker table (guest finalize, field-values migration, non-PDF uploads, anchoring, PAdES) + suggested order (next: document flattening) |
| `o2-secure-identity-and-key-management.md` | **O2 — Secure identity & key management** | Email verification, 2FA, challenge persistence/rate-limit, identity verification, expiration enforcement |
| `o3-independent-long-term-verifiability.md` | **O3 — Independent long-term verifiability (PDF/A + anchoring)** | PDF/A ingestion → artifact → anchoring → PAdES → verification → PQC |
| `o4-guest-and-recipient-journey.md` | **O4 — Guest & recipient journey** | Guest finalize (shared w/ O1), reject dialog, token revocation/binding, templates/contacts, self-service, UX |
| `o5-trust-audit-and-compliance.md` | **O5 — Trust, audit & compliance** | Audit trail, disclosures, identity verification, geolocation, storage tiers |
| `o6-e-notary-expansion.md` | **O6 — E-notary expansion** | Commission, onboarding, journal (ROR), ION/RON, jurat, witnesses, seal/QR |
| `o7-platform-growth.md` | **O7 — Platform growth (orgs, commercial, integrations, support)** | Orgs/RBAC, admin console, billing, help/support, integrations, reports, API |
| `o8-technical-health.md` | **O8 — Technical health** | env hardening, aliases→subpaths, build warnings, MIGRATION_TASKS |

> Related: `../core-objectives.md` — the canonical objective list (O1–O8).
> `docs/ai/roadmap.md` — the living platform plan.
