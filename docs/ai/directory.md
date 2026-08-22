# `docs/ai` — Directory

Index of the AI design / planning docs: what each folder and file is, and how they
relate. The roadmap (`roadmap.md`) is the hub; `core-objectives.md` names the
objectives that `blockers/` tracks.

---

## Map

```
docs/ai/
├── roadmap.md                  ← living plan (P0–P3 matrix + §1–§8)
├── core-objectives.md          ← canonical objectives (O1–O8)
├── blockchain/                 anchoring on-chain
├── blockchain-microservice/    external anchoring service (API)
├── blockers/                   what blocks each objective
├── compliance/                 legal disclosures + public API
├── identity/                   guests, identity proofing, audit
├── keys/                       key-management & payloads
├── notary/                     e-notary expansion
├── pdfa/                       PDF/A + PAdES compliance
├── platform/                   orgs, support, integrations, storage
├── qa/                         testing strategy
├── security/                   security reviews (audits)
└── signing/                    the signing experience & fields
```

---

## Root files

| File | What it is |
|---|---|
| `roadmap.md` | **The living plan.** All planned/missing features in a P0–P3 priority/type matrix plus themed sections (§1 keys & signing, §2 blockchain, §3 PDF/A, §4 guest tokens, §5 gaps, §6 security, §7 tech debt, §8 platform features). The cross-reference hub for every other doc. |
| `core-objectives.md` | **Canonical objectives (O1–O8)** derived from the roadmap. Each `blockers/` doc is named after one of these; used as the naming basis and quick status overview. |

---

## `blockchain/` — on-chain anchoring

| File | What it is |
|---|---|
| `blockchain-integration.md` | Spec for external **blockchain anchoring**: `signature_anchors` model, anchor client, state machine (`signed → anchored`), webhook, and the anchor-hash spec (targets the **artifact hash**, Option B). |
| `pqc-post-quantum.md` | **Post-quantum** Merkle-root anchoring — supplementary to ECDSA, covering regular signing + notary journal/audit checkpoints. |

## `blockchain-microservice/` — anchoring service

| File | What it is |
|---|---|
| `README.md` | Overview of the **external anchoring microservice** (owns the chain, signing, batching, finality; on-chain data = hashes only). |
| `api-contract.md` | External **API contract** for the service: `POST /anchor`, `GET /verify`, batching, and webhook payloads. |

## `blockers/` — what blocks the objectives

| File | What it is |
|---|---|
| `README.md` | Explains the folder's purpose and conventions (status legend, naming by objective, when to add/resolve). |
| `standards-compliant-e-signing.md` | Current blockers to **O1** (guest finalize, field-values migration, non-PDF uploads, anchoring, PAdES) + suggested order (next: flattening). |

## `compliance/` — legal & platform API

| File | What it is |
|---|---|
| `compliance-and-public-api.md` | **ESIGN / UETA / eIDAS** disclosure & rights (click-to-consent, withdrawal) and the public **developer API + webhooks** (planned long after release). |

## `identity/` — who signs & the evidence

| File | What it is |
|---|---|
| `guest-tokens.md` | **Guest signing**: signed token lifecycle, email OTP path, expiry/revocation, email binding. |
| `identity-verification.md` | **Signer identity proofing** (SMS OTP, KYC/ID, knowledge-based) and geolocation/device attestation capture. |
| `audit-trail.md` | Structured **audit/event log** (opened, viewed, signed, IP, device, UA, timestamp) with hash-chained checkpoints and anchoring hooks. |

## `keys/` — key management

| File | What it is |
|---|---|
| `recommendations.md` | Security **recommendations & decisions** for the key system: tier model, rotation/revocation, payload strengthening, PAdES-compliant end-state. |
| `payloads.md` | **Signed/upload payload formats** (T1/T2/T3) used by the key tiers and the signing challenge. |

## `notary/` — e-notary expansion

| File | What it is |
|---|---|
| `notary.md` | The **e-notary** story: commission (license/state/expiry), compliance onboarding, journal (ROR private chain), RON/ION notarization, acknowledgment vs. jurat, witnesses, seal/QR. |

## `pdfa/` — PDF/A & PAdES compliance

| File | What it is |
|---|---|
| `pdfa-compliance.md` | PDF/A **compliance plan**: ingestion conversion (Phase 1), signed-artifact generation (Phase 2), verification (Phase 4), data model + checklist. |
| `pades-baseline-t-spec.md` | Authoritative **PAdES-BASELINE-T** spec: self-signed X.509 + RFC 3161 TSA, embedded CMS, two-step finalize, verification. **Option B (2026-08-23): PAdES is the only signature.** |
| `document-flows.md` | **Document flows**: party/notary/platform certificate artifacts, audit pages, and certificate → blockchain transmission. |

## `platform/` — orgs, support, integrations, storage

| File | What it is |
|---|---|
| `organizations-and-admin.md` | **Organizations/teams & roles**, billing/usage metering, admin console, reports/analytics. |
| `support.md` | **Support**: help center / per-persona FAQ (party + notary), in-app contact form, token-expiry self-service, two-tier support. |
| `integrations-upload.md` | **Upload integrations** (cloud storage / sources) — for getting documents into the system. |
| `storage-tiering.md` | **Data lifecycle**: hot → cold → arctic storage tiers and retention policies. |

## `qa/` — testing

| File | What it is |
|---|---|
| `testing.md` | **Testing strategy**: unit/component/e2e (Vitest + Playwright), the DB-mock pattern, and QA coverage notes. |

## `security/` — security reviews

| File | What it is |
|---|---|
| `auth-and-access-review.md` | Security review of **auth + access control**. |
| `dashboard-and-layout.md` | Review of **dashboard/layout** routes & exposure. |
| `demo-routes.md` | Review of **demo / (dev) routes** exposure. |
| `email-security-review.md` | Review of **email flows** (signing URLs/tokens handling). |
| `keys-and-signing-review.md` | Review of the **keys & signing** system. |
| `opaque-auth-plugin.md` | Review of the **Better Auth opaque plugin**. |
| `service-worker-and-client-crypto.md` | Review of the **service-worker RPC + client crypto**. |
| `storage-and-uploads.md` | Review of **storage & upload** security. |

## `signing/` — the signing experience

| File | What it is |
|---|---|
| `form-fields.md` | Feature design for **fillable fields** (text, choices, phone, checkbox, radio): values, validation, payload binding, PAdES compliance. |
| `field-system.md` | The **implemented declarative field architecture** + how to add a new field type (registry-driven). |
| `signing-ux.md` | **Signing UX**: guided ceremony (field-by-field), mobile + accessibility (WCAG). |
| `signing-workspace-features.md` | Workspace features: **templates, contacts, password reset, reject flow, viewers enforcement**. |
| `document-package-management.md` | **Package lifecycle**: re-send, void/cancel, reminders & deadlines, download/export, trash/archive/retention, search. |
| `email-notifications.md` | The transactional **email backbone** (7 templates; signing-URL/token rules; reminders scheduler). |

---

> Related: `core-objectives.md` · `roadmap.md` · `blockers/README.md`
