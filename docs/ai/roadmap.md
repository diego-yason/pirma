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

## 0. Priority & type matrix

> Consolidated view of the entire roadmap, sorted by **Priority** then **Type**.
> Where they overlap, priority levels follow the *Working order* section at the bottom of this doc (e.g. the audit trail is placed after the notary work).
>
> **Priority** — follows the doc's *Suggested next steps* where already assigned; remaining items were prioritized in this consolidation:
> - **P0** — Security-critical access-control gaps that must be closed before anything else
> - **P1** — Foundation / high-value (auth foundations, signing loop, blocking decisions)
> - **P2** — Near-term roadmap
> - **P3** — Backlog / longer-term
>
> **Type** — `Security` (authn/authz, audit, identity, hardening) · `Feature` (new capability) · `Decision` (open question blocking work) · `Tech-debt` (cleanup/refactor)
>
> Implemented items (✅) carry priority `—` and are listed at the bottom for completeness.

| Priority | Type | Item | Status | Ref |
|---|---|---|---|---|
| **P0** | Security | Server-side authorization in `finalize` (signatory membership + field ownership) | ✅ | §1 |
| **P0** | Security | Package viewers permission enforcement | ✅ | §5 |
| **P0** | Security | MFA-required / Tier-2 enforcement (`mfaRequired` → require level-2 signature) | ✅ | §1 / §6 |
| **P0** | Security | Enforce key rotation/revocation at signing time + add a revoke endpoint (`revokedAt` never set) | ✅ | §1 |
| **P1** | Security | Enforce `guestTokens.revokedAt` (DB is source of truth) | 🔲 | §4 |
| **P1** | Security | Persist signing challenges (DB/Redis) + rate-limit `/api/keys/challenge` | 🔲 | §1 |
| **P1** | Security | Strengthen signing payload (bind field IDs / package / version) | ✅ | §1 |
| **P1** | Security | Email verification on sign-up | ⚠️ | §6 |
| **P1** | Security | Two-factor authentication (2FA) | ⚠️ | §6 |
| **P1** | Feature | Signer email invitations & notifications | � | §5 |
| **P1** | Feature | Owner notifications on sign / reject | ✅ | §5 |
| **P1** | Feature | Password reset | ✅ | §5 |
| **P1** | Feature | Reject flow completion (status + reason + notify) | 🚧 | §5 |
| **P1** | Decision | PAdES signing certificate strategy (self-signed vs. platform CA vs. external TSP) | ✅ | §6 → resolved: self-signed + TSA (`pdfa/pades-baseline-t-spec.md`) |
| **P1** | Decision | Conversion architecture (in-process WASM vs. document microservice) | ✅ | §6 → resolved: in-process first cut, microservice later |
| **P2** | Feature | `signature_anchors` table + `anchor_status` enum | 🔲 | §2 |
| **P2** | Feature | `anchor-client` (submit / status / verify + retries) | 🔲 | §2 |
| **P2** | Feature | Auto-anchor on finalize (idempotent by `payloadHash`) | 🔲 | §2 |
| **P2** | Feature | Confirmation: polling job + webhook route | 🔲 | §2 |
| **P2** | Feature | `signed → anchored` + `documents → executed` transition | 🔲 | §2 |
| **P2** | Feature | PDF/A Phase 1 — ingestion conversion (PDF/DOCX/JPG/PNG → PDF/A-2b) | 🔲 | §3 |
| **P2** | Feature | Email binding of guest token | 🔲 | §4 |
| **P2** | Feature | Document templates | 🔲 | §5 |
| **P2** | Feature | Contacts | 🔲 | §5 |
| **P2** | Feature | Package expiration enforcement (`expirationDate` checked) | ⚠️ | §6 |
| **P2** | Feature | Fillable form fields (initials, date, text, checkbox, dropdown) | 🔲 | §8.1 |
| **P2** | Feature | Initials as a separate signature type | 🔲 | §8.2 |
| **P2** | Feature | Mobile + accessibility (WCAG) signing flow | 🔲 | §8.2 |
| **P2** | Feature | Signer identity verification (SMS OTP, KYC/ID, knowledge-based) | 🔲 | §8.3 |
| **P2** | Feature | Notary commission (license, state/jurisdiction, expiry) | 🔲 | §8.4 |
| **P2** | Feature | Notary compliance onboarding (process video + quiz + certificate + platform-managed court filing) | 🔲 | §8.4 |
| **P2** | Feature | Notary journal (ROR) — private blockchain | 🔲 | §8.4 |
| **P2** | Feature | RON (remote) + ION (in-person) notarization | 🔲 | §8.4 |
| **P2** | Security | Structured audit trail / event log | 🔲 | §8.3 |
| **P2** | Feature | ESIGN / UETA / eIDAS disclosure & rights | 🔲 | §8.5 |
| **P2** | Feature | Organizations / teams & roles | 🔲 | §8.6 |
| **P2** | Feature | Help center / per-persona FAQ (party + notary) | 🔲 | §8.8 |
| **P2** | Feature | In-app "Contact support" form with auto-attached context (package/token/anchorId) | 🔲 | §8.8 |
| **P2** | Feature | Token-expiry / link-expired self-service (request new link / resend invite) | 🔲 | §8.8 |
| **P2** | Feature | Notary commission expiry notification (extends email set) | 🔲 | §8.8 |
| **P2** | Decision | Resolve `src/env.ts` `@migration-task` (env var fallback to `""`) | ⚠️ | §7 |
| **P3** | Feature | Public `/verify` page + API | 🔲 | §2 |
| **P3** | Feature | Failed-anchor banner + manual re-submit | 🔲 | §2 |
| **P3** | Feature | Anchoring targets artifact hash + every certificate hash | 🔲 | §2 / §3 |
| **P3** | Security | PQC post-quantum Merkle-root anchoring (supplementary to ECDSA; regular signing + notary) | 🔲 | §2 / `docs/ai/pqc-post-quantum.md` |
| **P3** | Feature | PDF/A Phase 2 — signed artifact generation (flatten + XMP + re-convert) | 🔲 | §3 |
| **P3** | Feature | PAdES embedded signatures (party / notary / platform) | 🔲 | §3 |
| **P3** | Feature | Detached ECDSA over final artifact hash (Phase 3 fallback) | 🔲 | §3 |
| **P3** | Feature | PDF/A Phase 4 — verification (veraPDF/pdfcpu + PAdES + ECDSA + anchor) | 🔲 | §3 |
| **P3** | Feature | Certificate artifacts (party / notary / platform) + audit pages | 🔲 | §3 |
| **P3** | Feature | Notary flow (v1.x revision, notary step, no audit pages) | 🔲 | §3 |
| **P3** | Feature | Certificate → blockchain transmission | 🔲 | §3 |
| **P3** | Feature | Email OTP for guests | ✅ | §4 |
| **P3** | Feature | In-app notifications / activity feed | ⚠️ | §6 |
| **P3** | Feature | Envelope lifecycle controls (void/cancel, replace signer, re-send) | 🔲 | §8.1 |
| **P3** | Feature | Reminders & deadlines (nudge emails, overdue alerts) | � | §8.1 |
| **P3** | Feature | Download/export (original + signed copies + audit data) | 🔲 | §8.1 |
| **P3** | Feature | Trash / archive / retention policies | 🔲 | §8.1 |
| **P3** | Feature | Document search | 🔲 | §8.1 |
| **P3** | Feature | Guided signing ceremony (field-by-field) | 🔲 | §8.2 |
| **P3** | Feature | Certificate of completion | 🔲 | §8.2 |
| **P3** | Feature | Geolocation / device attestation capture | 🔲 | §8.3 |
| **P3** | Feature | Acknowledgment vs. jurat wording | 🔲 | §8.4 |
| **P3** | Feature | Witnesses | 🔲 | §8.4 |
| **P3** | Feature | e-notary seal / QR code validator | 🔲 | §8.4 |
| **P3** | Feature | Data-saving process (hot → cold → arctic storage) | 🔲 | §8.4 |
| **P3** | Feature | Public developer API + webhooks | 🔲 | §8.5 |
| **P3** | Feature | Billing / usage metering | 🔲 | §8.6 |
| **P3** | Feature | Admin console | 🔲 | §8.6 |
| **P3** | Feature | Reports / analytics | 🔲 | §8.6 |
| **P3** | Feature | Upload integrations (cloud storage / sources) | 🔲 | §8.7 |
| **P3** | Feature | Support-agent tooling in admin console (search + re-send/revoke/manual re-anchor) | 🔲 | §8.8 |
| **P3** | Feature | Priority notary support channel | 🔲 | §8.8 |
| **P3** | Feature | Deadline-warning email before `expirationDate` | 🔲 | §8.8 |
| **P3** | Security | JWT migration (`jose`, HS256, standard claims, dedicated secret) | 🔲 | §4 |
| **P3** | Tech-debt | Replace deprecated `config.alias` (`$plugins`) with subpath imports | 🔲 | §7 |
| **P3** | Tech-debt | Fix pre-existing build warnings (a11y `href=""`, `state_referenced_locally`) | 🔲 | §7 |
| **P3** | Tech-debt | Finish/delete `MIGRATION_TASKS.md` | 🔲 | §7 |
| — | Feature | Level-1 session-only keys (SW memory, non-extractable) | ✅ | §1 |
| — | Feature | Level-2 persistent, password-bound keys (random per-key salt) | ✅ | §1 |
| — | Feature | Upload endpoint revokes prior same-level keys (transaction) | ✅ | §1 |
| — | Feature | `finalize` looks up signing key by `kid` + enforces `keyLevel` | ✅ | §1 |
| — | Feature | Guest/anonymous level-1 session keys (no throwaway secret) | ✅ | §1 |
| — | Feature | Sign page lazy key generation + auto-retry on revoked key | ✅ | §1 |
| — | Security | SW RPC ID prefixes (`dk`/`sk`) — no cross-module resolution (mitigation only) | ✅ | §1 |

> **Ref** — `§1` Key & signing · `§2` Blockchain · `§3` PDF/A & flows · `§4` Guest tokens · `§5` Undocumented gaps · `§6` Security decisions · `§7` Tech debt · `§8.x` Platform features.

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
| **Server-side authorization in `finalize`** (signatory membership + field ownership) | ✅ | **P0 — fixed 2026-08-16** |
| Enforce rotation/revocation at signing time + add a revoke endpoint | ✅ | `finalize` runs `checkKeyPolicy` + `checkKeyUsage`; `POST /api/keys/revoke` sets `revokedAt` (2026-08-16) |
| Consolidate SW RPC into one handler | 🔲 | Follow-up to ID-prefix mitigation |
| Persist challenges (DB/Redis) + rate-limit `/api/keys/challenge` | 🔲 | Currently in-memory `Map` |
| Strengthen signing payload (bind field IDs / package / version) | ✅ | Now `packageId:documentId:docHash:sortedFieldIds:signerUserId` (2026-08-16) |
| **MFA-required / Tier-2 enforcement** (`mfaRequired` → require level-2 signature) | ✅ | Enforced 2026-08-16: server rejects level-1 keys on `mfaRequired`; sign page unlocks level-2 key w/ password |
| **Tier model revision** — tier-1 keys single-use (one packet), valid within the same hour of the signed payload, **never written to disk** (memory-only: no IndexedDB, no `cryptoKeys` row); tier-2 `keyLevel` flag retained + validated; **T2 wrap password = account password (OPAQUE-compatible)**; T2 registration proof = session stamped `passwordVerifiedAt` at OPAQUE `completeLogin` (no Better Auth API, no stored hash); **T3 = hardware keys (WebAuthn, attestation-verified)**; challenge + device info exchanged with the pubkey; **OAuth removed** (password/OPAQUE only) | 📐 | Design (2026-08-22) — `docs/ai/keys/recommendations.md` § "Tier model revision" + `docs/ai/keys/payloads.md`. Not yet implemented |

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
| **PQC post-quantum Merkle-root anchoring** (all final hashes → Merkle root signed by PQC key → anchored on public chain) | 🔲 | Note: `docs/ai/pqc-post-quantum.md` |

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
| Email OTP for guests | ✅ | `guest_otps` table + `/api/guest/otp/{request,verify}` + sign-page OTP gate (migration `0002`) |

---

## 5. Undocumented gaps (from codebase analysis)

These exist as stubs/TODOs and are **not** in any `docs/ai` file other than this roadmap.

| Feature | Status | Where | Notes |
|---|---|---|---|
| **Signer email invitations & notifications** | � | `doc/new/[packageId]/confirm/+page.server.ts` | Invite email sent (tokenized URL for guests, plain sign link for registered users). Email module + `email_events` built. In-app/activity feed still pending. Design: `docs/ai/email-notifications.md` |
| Owner notifications on sign / reject | ✅ | `sign/+page.server.ts` `finalize` / `reject` | Owner emailed on sign and on reject (with reason). No in-app notifications (separate P3 item). Design: `docs/ai/email-notifications.md` |
| **Password reset** | ✅ | `/forgot-password` + `/reset-password` routes | Better Auth `sendResetPassword` hook + `requestPasswordReset`/`resetPassword` wired; login "Forgot password?" links to the flow. |
| **Document templates** | 🔲 | `doc/new/+page.svelte` + nav "Templates" → `/` | UI stub, no handler. Design: `docs/ai/signing-workspace-features.md` |
| **Contacts** | 🔲 | nav "Contacts" → `/` | Placeholder only. Design: `docs/ai/signing-workspace-features.md` |
| **Package viewers permission enforcement** | ✅ | `doc/[pageId]/+page.server.ts` + `view/+page.server.ts` now check `package_viewers` (2026-08-16) |
| **Reject flow completion** | � | `sign/+page.server.ts` `reject` action | Signatory verified, recipient marked (`package_recipients.rejectedAt`/`rejectionReason`), existing signature rows → `rejected`, owner notified. Client confirmation dialog still TODO. Design: `docs/ai/signing-workspace-features.md` |

---

## 6. Security features — consideration / decision needed

| Feature | Status | Notes |
|---|---|---|
| Email verification on sign-up | ⚠️ | Better Auth `requireEmailVerification` not enabled |
| Two-factor authentication (2FA) | ⚠️ | Better Auth `twoFactor` plugin not enabled; relevant to `mfaRequired` |
| Package expiration enforcement | ⚠️ | `packages.expirationDate` exists; unclear if enforced |
| In-app notifications / activity feed | ⚠️ | Nothing exists |
| PAdES signing certificate strategy | ✅ | Resolved 2026-08-16: **self-signed per signer + trusted TSA timestamp** — `pdfa/pades-baseline-t-spec.md` |
| Conversion architecture (in-process WASM vs. document microservice) | ✅ | Resolved 2026-08-16: **in-process first cut**; document microservice is the production path |

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
| Reminders & deadlines (nudge emails, overdue alerts, enforce `expirationDate`) | � | Nudge emails done: `sendDueReminders` + `/api/cron/reminders` (day 3/7, `EMAIL_REMIND_DAYS`). Overdue alerts + hard `expirationDate` enforcement still pending. Design: `docs/ai/document-package-management.md` |
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
| Notary compliance onboarding (process video + quiz + certificate + court filing) | 🔲 | Design: `docs/ai/notary.md` §1 — all four gate acting as notary; filing is platform-managed |
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

### 8.8 Support & help

> Design: `docs/ai/support.md`

| Feature | Status | Notes |
|---|---|---|
| Help center / per-persona FAQ (party + notary) | 🔲 | Static routes; answers "how do I sign?", OTP, commission, journal |
| In-app "Contact support" form with auto-attached context | 🔲 | package/token/anchorId auto-derived; guests via captured email |
| Token-expiry / link-expired self-service (request new link / resend invite) | 🔲 | Ties to `guest-tokens.md` (revokedAt + email binding) |
| Notary commission expiry notification | 🔲 | Extends `email-notifications.md` set; prevents lapse |
| Support-agent tooling in admin console (search + re-send/revoke/manual re-anchor) | 🔲 | Extends §8.6 admin console; actions logged to audit trail |
| Priority notary support channel | 🔲 | Two-tier: standard (parties) vs. priority (notary) |
| Deadline-warning email before `expirationDate` | 🔲 | Extends reminders in `email-notifications.md`; hard vs. soft decision |

---

## Working order (from the undocumented-feature walkthrough)

Agreed attack order for the undocumented features:

1. **Email & notifications** — `docs/ai/email-notifications.md` — ✅ all 7 emails implemented (2026-08-16); reminders need a scheduler hitting `/api/cron/reminders`
2. Section 5 codebase gaps — password reset, templates, contacts, viewers enforcement, reject flow
3. Notary: **ION** + commission + journal (private blockchain) design
4. Structured audit trail
5. Fillable form fields
6. The rest of §8 (RON, seal/QR, data tiers, disclosure, orgs/billing, integrations)

---

## Suggested next steps (priority order)

1. **P0 security:** server-side authorization in `finalize` (signatory + field ownership) — §1. ✅ done 2026-08-16.
2. **P0 security:** MFA-required / Tier-2 enforcement (`mfaRequired`) — §1/§6. ✅ done 2026-08-16.
3. **P1:** Signer email invitations & notifications (foundation for the whole signing loop) — §5.
4. **P1:** Password reset — §5.
5. **P1:** Enforce `guestTokens.revokedAt` — §4.
6. **P2:** Blockchain anchoring (build `signature_anchors` + anchor client) — §2.
7. **P2:** PDF/A Phase 1 (ingestion conversion) — §3 (after cert/conversion decisions).
