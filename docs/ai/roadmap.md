# Platform Roadmap

> Status: **Living document — consolidates all planned/missing features**
> Created: 2026-08-16
> Repo: `diego-yason/pirma`
> Sources: `docs/ai/*` (keys, blockchain, pdfa, guest-tokens) + codebase gap analysis
>
> **Legend**
> - ✅ **Implemented**
> - 🚧 **Partial / in progress**
> - 🔲 **Planned / not started**
> - ⚠️ **Consideration / decision needed**

---

## 1. Key & signing architecture

Source: `docs/ai/keys/recommendations.md`

| Feature | Status | Notes |
|---|---|---|
| Level-1 session-only keys (SW memory, non-extractable, never persisted) | ✅ | Implemented |
| Level-2 persistent, password-bound keys (random per-key salt) | ✅ | Implemented |
| Upload endpoint revokes prior same-level keys (transaction) | ✅ | Implemented |
| `finalize` looks up signing key by `kid` + enforces `keyLevel` | ✅ | Implemented |
| Guest/anonymous level-1 session keys (no throwaway secret) | ✅ | Implemented |
| Sign page lazy key generation + auto-retry on revoked key | ✅ | Implemented |
| SW RPC ID prefixes (`dk`/`sk`) — no cross-module resolution | ✅ | Mitigation only |
| **Server-side authorization in `finalize`** (signatory membership + field ownership) | 🔲 | **P0 — security** |
| Enforce rotation/revocation at signing time + add a revoke endpoint | 🔲 | `revokedAt` never set by any endpoint |
| Consolidate SW RPC into one handler | 🔲 | Follow-up to ID-prefix mitigation |
| Persist challenges (DB/Redis) + rate-limit `/api/keys/challenge` | 🔲 | Currently in-memory `Map` |
| Strengthen signing payload (bind field IDs / package / version) | 🔲 | Currently `"${docHash}:${count}"` |
| **MFA-required / Tier-2 enforcement** (`mfaRequired` → require level-2 signature) | 🔲 | Flag set + shown, never enforced; see §6 |

---

## 2. Blockchain anchoring

Sources: `docs/ai/blockchain-integration.md`, `docs/ai/blockchain-microservice/`

| Feature | Status | Notes |
|---|---|---|
| `signature_anchors` table + `anchor_status` enum | 🔲 | Spec'd, not built |
| `anchor-client` (submit / status / verify + retries) | 🔲 | Spec'd |
| Auto-anchor on finalize (idempotent by `payloadHash`) | 🔲 | `anchored` never set today |
| Confirmation: polling job + webhook route | 🔲 | Webhook = reverse flow |
| `signed → anchored` + `documents → executed` transition | 🔲 | Resolves an existing TODO |
| Public `/verify` page + API | 🔲 | |
| Failed-anchor banner + manual re-submit | 🔲 | |
| **Anchoring targets artifact hash + every certificate hash** | 🔲 | See `pdfa/document-flows.md` |

---

## 3. PDF/A compliance + document flows

Sources: `docs/ai/pdfa/pdfa-compliance.md`, `docs/ai/pdfa/document-flows.md`

| Feature | Status | Notes |
|---|---|---|
| Ingestion conversion (PDF/DOCX/JPG/PNG → PDF/A-2b) | 🔲 | Phase 1 |
| Signed artifact generation (flatten + XMP + re-convert to PDF/A) | 🔲 | Phase 2 |
| PAdES embedded signatures (party / notary / platform) | 🔲 | Phase 3; **needs cert strategy decision** |
| Detached ECDSA over final artifact hash | 🔲 | Phase 3 fallback |
| Verification (veraPDF/pdfcpu + PAdES + ECDSA + anchor) | 🔲 | Phase 4 |
| Certificate artifacts (party / notary / platform) + audit pages | 🔲 | `document-flows.md` |
| Notary flow (v1.x revision, notary step, no audit pages) | 🔲 | `document-flows.md` |
| Certificate → blockchain transmission | 🔲 | `document-flows.md` |

---

## 4. Guest tokens

Source: `docs/ai/guest-tokens.md`

| Feature | Status | Notes |
|---|---|---|
| JWT migration (`jose`, HS256, standard claims, dedicated secret) | 🔲 | Consideration |
| **Enforce `guestTokens.revokedAt`** (DB is source of truth) | 🔲 | Never checked today |
| Email binding of token | 🔲 | Planned |
| Email OTP for guests | 🔲 | Future; token should not block it |

---

## 5. Undocumented gaps (from codebase analysis)

These exist as stubs/TODOs and are **not** in any `docs/ai` file other than this roadmap.

| Feature | Status | Where | Notes |
|---|---|---|---|
| **Signer email invitations & notifications** | 🔲 | `doc/new/[packageId]/confirm/+page.server.ts` (`// TODO: Send email…`) | Signing URL + guest token generated, nothing is emailed; no sender infra (only a dev email renderer). Design: `docs/ai/email-notifications.md` |
| Owner notifications on sign / reject | 🔲 | — | No notification system at all. Design: `docs/ai/email-notifications.md` |
| **Password reset** | 🔲 | `login/+page.svelte` ("Forgot password?" has no handler) | Better Auth `requestPasswordReset` not wired. Design: `docs/ai/signing-workspace-features.md` |
| **Document templates** | 🔲 | `doc/new/+page.svelte` + nav "Templates" → `/` | UI stub, no handler. Design: `docs/ai/signing-workspace-features.md` |
| **Contacts** | 🔲 | nav "Contacts" → `/` | Placeholder only. Design: `docs/ai/signing-workspace-features.md` |
| **Package viewers permission enforcement** | 🔲 | `doc/[pageId]/+page.server.ts` (`// TODO: check package_viewers`) | Table + dashboard join exist; access not enforced. Design: `docs/ai/signing-workspace-features.md` |
| **Reject flow completion** | 🔲 | `sign/+page.server.ts` `reject` action | Stub: no `signatures.status='rejected'`, no reason storage, no owner notify; client confirmation is TODO. Design: `docs/ai/signing-workspace-features.md` |

---

## 6. Security features — consideration / decision needed

| Feature | Status | Notes |
|---|---|---|
| Email verification on sign-up | ⚠️ | Better Auth `requireEmailVerification` not enabled |
| Two-factor authentication (2FA) | ⚠️ | Better Auth `twoFactor` plugin not enabled; relevant to `mfaRequired` |
| Package expiration enforcement | ⚠️ | `packages.expirationDate` exists; unclear if enforced |
| In-app notifications / activity feed | ⚠️ | Nothing exists |
| PAdES signing certificate strategy | ⚠️ | Self-signed per user vs. platform CA vs. external TSP — blocks §3 Phase 3 |
| Conversion architecture (in-process WASM vs. document microservice) | ⚠️ | Blocks §3 Phase 1 |

---

## 7. Tech debt / housekeeping

| Item | Status | Notes |
|---|---|---|
| Replace deprecated `config.alias` (`$plugins`) with subpath imports | 🔲 | Build/check warning; larger refactor |
| Resolve `src/env.ts` `@migration-task` (env var fallback to `""`) | ⚠️ | ORIGIN / BETTER_AUTH_SECRET allow empty fallback — decision pending |
| Fix pre-existing build warnings | 🔲 | a11y `href=""` in `(dev)/email/request`; `state_referenced_locally` in `view/+page.svelte` |
| Finish/delete `MIGRATION_TASKS.md` | 🔲 | SvelteKit 3 migration tasks complete; file pending cleanup |

---

## 8. E-signature / e-notary platform features (recommended additions)

> `📕` marks features with **no documentation** yet — no dedicated `docs/ai` file exists for them.
> Everything in this section is planned, not built.

### 8.1 Document & package lifecycle

| Feature | Status | Notes |
|---|---|---|
| Fillable form fields (initials, date, text, checkbox, dropdown) | 🔲 | Design: `docs/ai/form-fields.md`; `placementFields` are signature-only today |
| Envelope lifecycle controls (void/cancel, replace signer, re-send) | 🔲 | Design: `docs/ai/document-package-management.md` |
| Reminders & deadlines (nudge emails, overdue alerts, enforce `expirationDate`) | 🔲 | Design: `docs/ai/document-package-management.md`; `expirationDate` stored but unchecked |
| Download/export (original + signed copies + audit data) | 🔲 | Design: `docs/ai/document-package-management.md`; overlaps §3 artifacts |
| Trash / archive / retention policies | 🔲 | Design: `docs/ai/document-package-management.md` (+ `storage-tiering.md`) |
| Document search | 🔲 | Design: `docs/ai/document-package-management.md` |

### 8.2 Signing UX

| Feature | Status | Notes |
|---|---|---|
| Initials as a separate signature type | 🔲 | Design: `docs/ai/form-fields.md`; `user_signatures` stores full signatures only |
| Guided signing ceremony (field-by-field) | 🔲 | Design: `docs/ai/signing-ux.md` |
| Certificate of completion | 🔲 | overlaps §3 audit/cert pages (see `pdfa/document-flows.md`) |
| Mobile + accessibility (WCAG) signing flow | 🔲 | Design: `docs/ai/signing-ux.md` |

### 8.3 Identity, security & audit

| Feature | Status | Notes |
|---|---|---|
| Structured audit trail / event log | 🔲 | Design: `docs/ai/audit-trail.md` — per-event: opened, viewed, signed, IP, device, UA, timestamp |
| Signer identity verification (SMS OTP, KYC/ID, knowledge-based) | 🔲 | Design: `docs/ai/identity-verification.md`; email OTP planned in `guest-tokens.md` |
| Geolocation / device attestation capture | 🔲 | Design: `docs/ai/identity-verification.md` (+ `audit-trail.md`) |

### 8.4 Notary-specific (e-notary expansion)

| Feature | Status | Notes |
|---|---|---|
| Notary commission (license, state/jurisdiction, expiry) | 🔲 | Design: `docs/ai/notary.md` |
| Notary journal (ROR) — its own **private blockchain** | 🔲 | Design: `docs/ai/notary.md`; mechanism per `blockchain-integration.md` / `blockchain-microservice` (private chain variant) |
| RON (remote) + ION (in-person) notarization | 🔲 | Design: `docs/ai/notary.md` (ION first; RON = two-way audiovisual + recording, deferred) |
| Acknowledgment vs. jurat wording | 🔲 | Design: `docs/ai/notary.md` §4; per-jurisdiction templates needed |
| Witnesses | 🔲 | Design: `docs/ai/notary.md` §4 — same as a party, signing for a different reason |
| e-notary seal / QR code validator | 🔲 | Design: `docs/ai/notary.md` §4 — subject to rules |
| Data-saving process (hot → cold → arctic storage) | 🔲 | Design: `docs/ai/storage-tiering.md` |

### 8.5 Compliance & legal

| Feature | Status | Notes |
|---|---|---|
| ESIGN / UETA / eIDAS disclosure & rights (click-to-consent, right to withdraw) | 🔲 | Design: `docs/ai/compliance-and-public-api.md` |
| Public developer API + webhooks | 🔲 | Design: `docs/ai/compliance-and-public-api.md` — **long after release** |

### 8.6 Organizations, admin & commercial

| Feature | Status | Notes |
|---|---|---|
| Organizations / teams & roles | 🔲 | Design: `docs/ai/organizations-and-admin.md`; Better Auth `organization` plugin installed, unused |
| Billing / usage metering | 🔲 | Design: `docs/ai/organizations-and-admin.md`; e.g. `PUBLIC_MAX_RECIPIENTS` cap hints at intent |
| Admin console | 🔲 | Design: `docs/ai/organizations-and-admin.md` |
| Reports / analytics | 🔲 | Design: `docs/ai/organizations-and-admin.md` |

### 8.7 Integrations

| Feature | Status | Notes |
|---|---|---|
| Upload integrations (cloud storage / sources) | 🔲 | Design: `docs/ai/integrations-upload.md` — solely for uploading to the system |

---

## Working order (from the undocumented-feature walkthrough)

Agreed attack order for the undocumented features:

1. **Email & notifications** — `docs/ai/email-notifications.md` (draft) — 🚧 in progress
2. Section 5 codebase gaps — password reset, templates, contacts, viewers enforcement, reject flow
3. Notary: **ION** + commission + journal (private blockchain) design
4. Structured audit trail
5. Fillable form fields
6. The rest of §8 (RON, seal/QR, data tiers, disclosure, orgs/billing, integrations)

---

## Suggested next steps (priority order)

1. **P0 security:** server-side authorization in `finalize` (signatory + field ownership) — §1.
2. **P0 security:** MFA-required / Tier-2 enforcement (`mfaRequired`) — §1/§6.
3. **P1:** Signer email invitations & notifications (foundation for the whole signing loop) — §5.
4. **P1:** Password reset — §5.
5. **P1:** Enforce `guestTokens.revokedAt` — §4.
6. **P2:** Blockchain anchoring (build `signature_anchors` + anchor client) — §2.
7. **P2:** PDF/A Phase 1 (ingestion conversion) — §3 (after cert/conversion decisions).
