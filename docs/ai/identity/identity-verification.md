# Signer Identity Verification & Attestation

> Status: **Draft — design, not implemented**
> Created: 2026-08-16
> Repo: `diego-yason/pirma`
> Related:
> - `docs/ai/roadmap.md` §8.3
> - `docs/ai/identity/guest-tokens.md` (email OTP)
> - `docs/ai/identity/audit-trail.md` (IP/device capture)
> - `docs/ai/notary/notary.md` (identity proofing for notary acts)

## 1. Verification levels

Model verification as **levels** a package can require (`packages.verificationLevel`):

| Level | Method | Use case |
|---|---|---|
| `none` | — | default; email possession only |
| `otp-email` | Email OTP (planned in `guest-tokens.md`) | standard parties |
| `otp-sms` | SMS OTP via provider | higher assurance |
| `kba` | Knowledge-based questions | mid assurance |
| `id` | ID document / KYC vendor (Persona, Jumio, etc.) | notary / high-assurance |

**Defaults:** parties default to `otp-email`; notary acts require at least `id` (per
jurisdiction rules). `mfaRequired` on a package could imply a floor (e.g. ≥ `otp-sms`).

## 2. Attestation capture

- **Device**: reuse `device-fingerprint` (already computed for keys) — store the hash on the
  signing event (`signatures` / `audit_log`).
- **IP**: already captured on key upload; extend to signing events via `getClientAddress()`.
- **Geolocation**: IP-based (or opted-in browser geolocation for notary) — stored per signing
  event for jurisdiction checks; never displayed raw to other parties.
- All captured into `audit_log` and the `signatures` row.

## 3. Enforcement points

- Before `finalize`: verify the required verification level was completed for the signer
  (OTP/KBA/ID proof stored with a `verifiedAt` + proof ref).
- `packages.verificationLevel` is checked server-side in `finalize` (mirrors the MFA/T2
  enforcement pattern in `roadmap.md`).

## Schema additions

- `packages.verificationLevel` enum, default `"otp-email"`
- `signatures.verification`: `{ method, verifiedAt, proofRef }` (jsonb) or columns
- `signatures.ip`, `signatures.deviceHash`, `signatures.geo` (or rely on `audit_log` — decide)

**Open decisions**
1. Provider for SMS/KBA/ID (default: **OTP in-house via the email module for email-OTP; SMS/KBA/ID
   via a vendor**, decided later).
2. Store proof refs on `signatures` vs. only in `audit_log` (recommend: summary on `signatures`,
   detail in `audit_log`).
3. Whether `mfaRequired` maps to a verification floor.
4. Geolocation capture: IP-only (default) vs. explicit browser geolocation.
