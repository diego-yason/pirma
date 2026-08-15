# Guest Tokens — Design Consideration (JWT migration)

> Status: **Draft — consideration only, not implemented**
> Created: 2026-08-16
> Repo: `diego-yason/pirma`
> Related:
> - `src/lib/server/auth/guest-token.ts` — current HMAC-signed token
> - `src/lib/server/db/schema.ts` (`guestTokens`) — token lifecycle rows
> - `src/routes/api/guest/link/+server.ts` — anonymous-user linking flow
> - `src/routes/(app)/doc/[pageId]/sign/+page.server.ts` — guest verification in load/action

## Context

Guests sign documents without an account. They receive a token (via URL `?token=…`) that lets
them view and sign a specific package. Today the token is a minimal hand-rolled JWT-like
construct: `base64url(JSON{recipientId, packageId, exp}) . HMAC-SHA256(BETTER_AUTH_SECRET)`,
with `timingSafeEqual` verification and a 7-day expiry.

It is functionally a JWT already. The consideration is whether to formalize it as a real JWT
(standard claims + `jose`) and to fix the behavioral gaps that exist regardless of format.

## Decisions (from product discussion, 2026-08-16)

| # | Question | Decision |
|---|---|---|
| 1 | Single-use token? | **No.** A guest token may be reused within its validity window. `accessedAt` is informational, not a consumption flag. |
| 2 | Revocation? | **Yes.** `guestTokens.revokedAt` must be enforced — the DB row is the source of truth. Verification must reject revoked tokens. |
| 3 | Email binding? | **Yes.** The token should be bound to the recipient's email so a leaked URL can't be used by a different person. **OTP is planned eventually** (email OTP for guest sign-in) — the token design should not block that path. |

## Current state & gaps

- **No revocation check.** `verifyGuestToken` is purely stateless (signature + expiry); it never
  queries `guestTokens.revokedAt`. A revoked token stays valid.
- **No email binding.** Payload has `recipientId` + `packageId` only.
- **Secret reuse.** Signed with `BETTER_AUTH_SECRET`; rotating it invalidates all guest tokens
  and couples guest tokens to session security.
- **Token in URL.** `?token=…` can leak via referrers/logs (true for JWT or not).
- **`exp` is an ISO string** rather than a standard numeric date.

## Proposed direction (if/when implemented)

### Token format — migrate to a real JWT (`jose`)

- Algorithm: **HS256**.
- Secret: dedicated **`GUEST_TOKEN_SECRET`** env var; fall back to `BETTER_AUTH_SECRET` when
  unset (backward compatibility during rollout).
- Claims:
  - `sub` → `packageRecipients.id`
  - `aud` → `"pirma-guest"`
  - `iat`, `exp` (numeric dates)
  - `jti` → random UUID (traceability, dedupe)
  - `pkg` (private claim) → `packages.id`
  - `email` (private claim) → recipient email hash or raw email (see OTP note below)
- Verify with `jwtVerify` + audience/issuer validation, then enforce the DB checks.

### DB enforcement (source of truth)

On every verification, after signature/expiry validation, look up the `guestTokens` row by
`token` (or `jti`) and reject if:

- `revokedAt` is set (**decision #2**), or
- (if enforced later) single-use semantics are desired — currently **not** (**decision #1**),
  so `accessedAt` is not a rejection condition.

### Email binding & the OTP path (**decision #3**)

- Near term: bind verification to the recipient's email on file (compare submitted email vs
  `packageRecipients.email`).
- Planned: replace/augment the bearer-token step with an **email OTP flow** for guests:
  1. Guest submits email (from the token).
  2. Server sends a 6-digit OTP to that address.
  3. Guest enters OTP → anonymous session linked to the recipient.
- Design goal: the JWT becomes a short-lived "invitation handle" that gets exchanged for an
  authenticated session; OTP is the proof-of-possession of the inbox. Keep the token's
  `recipientId`/`packageId` stable so the OTP exchange stays a drop-in replacement.

## Security notes

- Add `Referrer-Policy: no-referrer` on routes serving the token and avoid logging query
  strings.
- Consider an exchange step (token → session) instead of trusting the token repeatedly.
- Keep `GUEST_TOKEN_SECRET` out of client code and rotate on compromise.

## Open questions

- Should `jti` replace `token` as the lookup key in `guestTokens`?
- Should email binding compare a hash (privacy) or raw email (simpler)?
- OTP lifetime/attempt limits — align with the token's 7-day window or shorter?
