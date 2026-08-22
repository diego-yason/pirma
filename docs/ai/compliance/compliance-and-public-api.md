# Compliance & Public API

> Status: **Draft — design, not implemented**
> Created: 2026-08-16
> Repo: `diego-yason/pirma`
> Related:
> - `docs/ai/roadmap.md` §8.5
> - `docs/ai/identity/audit-trail.md` (consent records)
> - `docs/ai/signing/email-notifications.md`

## 1. Disclosure & rights (ESIGN / UETA / eIDAS)

**Purpose:** make signatures legally enforceable — signers must consent to electronic
signatures and be told their rights.

**Design**
- Before the first signature, show a **consent screen**: "I agree to sign electronically", a
  plain-language disclosure (what "sign" means, that a record will be kept), and the **right to
  withdraw consent**.
- Store a **consent record** per signer: `{ agreed: true, agreedAt, version, ip, deviceHash }`
  (written to `audit_log` and referenced from `signatures`).
- Withdrawing consent: a later signer can withdraw before signing (blocks `finalize`); a
  signer who already signed keeps their signature (legal nuance — decide).
- **Scope**: generic copy for v1; per-jurisdiction templates later (esp. for notary, which is
  state-specific).

**Open:** generic vs. per-jurisdiction templates (v1 generic); withdrawal-after-signing
behavior.

## 2. Public developer API + webhooks

> **Long after release** — designed now only as a shape so it doesn't paint us into a corner.

- **Auth**: API keys per user/org (`api_keys` table; hash at rest).
- **Endpoints** (read/write envelopes programmatically):
  - `POST /api/v1/packages` (create package from a document + recipients + fields)
  - `GET /api/v1/packages/:id`, `GET /api/v1/packages/:id/signatures`
  - `POST /api/v1/packages/:id/resend`, `POST /api/v1/packages/:id/void`
- **Webhooks**: subscribe to events (package.signed, package.completed, package.rejected,
  anchor.confirmed) — a `webhook_subscriptions` table + HMAC-signed deliveries (reuse the
  blockchain-webhook pattern in `blockchain-microservice/api-contract.md`).
- Rate limits + usage metering (ties to `organizations-and-admin.md` billing).

**Open:** REST-only v1; whether webhooks share the blockchain webhook infrastructure.
