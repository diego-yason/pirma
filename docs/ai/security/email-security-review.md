# Email & Notifications — Security Review

> Status: **Review (2026-08-16)** — findings, not yet fixed
> Scope: `src/lib/server/email/`, `src/lib/server/auth/guest-otp.ts`, Better Auth reset hook,
> `/api/cron/reminders`, `/api/guest/otp/*`, `/forgot-password`, `/reset-password`, and the
> `sign` page OTP gate.
>
> Severity: **High** (fix before production) · **Medium** (fix soon) · **Low** (harden over time).

## Summary

The email foundation is functionally solid and includes several good practices (single-use OTPs
with expiry + attempt cap, idempotent sends via `email_events`, a secret-gated cron endpoint,
email binding for OTP, HMAC-signed guest tokens with constant-time comparison). The main risk
class is **sensitive material (guest tokens, reset tokens, OTP codes) leaking into server logs or
the database**, plus **missing rate limiting** on unauthenticated endpoints.

## Findings

| ID | Severity | Finding | Location |
|---|---|---|---|
| EMR-01 | **High** | Guest tokens & OTP codes leak into logs | `providers.ts` (console), `confirm/+page.server.ts` |
| EMR-02 | **High** | Password reset token stored in plaintext (DB + logs) | `auth/index.ts` `sendResetPassword` |
| EMR-03 | **Medium** | OTP code hashed without a server secret (offline brute-force) | `auth/guest-otp.ts` |
| EMR-04 | **Medium** | No rate limiting on OTP / reset / reminder sends | `api/guest/otp/request`, Better Auth config |
| EMR-05 | **Medium** | Guest token revocation not enforced in the OTP flow | `auth/guest-token.ts`, `api/guest/otp/verify` |
| EMR-06 | **Low** | OTP verify doesn't restrict linking to anonymous accounts | `api/guest/otp/verify` |
| EMR-07 | **Low** | Cron secret compared non-constant-time | `api/cron/reminders` |
| EMR-08 | **Low** | No origin/`Sec-Fetch-Site` check on guest API routes | `api/guest/otp/*`, `api/guest/link` |
| EMR-09 | **Low** | `email_events` retained indefinitely | `email/index.ts`, `schema.ts` |
| EMR-10 | **Low** | Console provider is the fallback for **any** unset/unknown provider | `providers.ts` |

---

## EMR-01 — Guest tokens & OTP codes leak into logs (High)

**Where**

- `src/lib/server/email/providers.ts` — the console provider logs the **full HTML body**:
  `logger.info("email", "[console] HTML body:\n" + message.html)`. The HTML contains the
  tokenized signing URL (`?token=…`) for signer invites, the full reset link for password
  resets, and the 6-digit OTP code for guest OTP.
- `src/routes/(app)/doc/new/[packageId]/confirm/+page.server.ts` — logs the complete
  `signingUrl` (guest token in the query string) at `"Guest signing link generated"`.

**Risk** — Anyone with log access (or a log aggregator/retention store) can extract live guest
tokens and impersonate signers, or harvest OTP/reset codes. This directly contradicts the design
rule in `docs/ai/signing/email-notifications.md` ("Signing URLs + tokens only ever appear in email; never
logged").

**Recommendation**

- Never log full HTML/URLs. Log only metadata (`to`, `template`, `eventId`).
- Redact query strings — log a preview of the URL with the token replaced by `…`, or a SHA-256
  hash of the token for correlation.
- In the console provider, truncate/redact the body; do not print the raw HTML.

**Status (2026-08-16)** — ✅ **Fixed.** Logging was migrated to **pino** with central redaction of
`signingUrl`/`token`/`code`/`nonce`/`signature`/`password`/`authorization`/`cookie` fields, and the
console email provider now logs metadata only (`to`, `subject`, byte lengths) — never the HTML/text
body. The `confirm` `signingUrl` field and challenge `nonce` are now redacted automatically.

## EMR-02 — Password reset token stored in plaintext (High)

**Where** — `src/lib/server/auth/index.ts`:

```ts
eventId: `password-reset:${user.id}:${token}`,
```

**Risk** — `eventId` is persisted in `email_events.event_id` and echoed in logs. A DB or log
compromise exposes valid reset tokens, enabling account takeover.

**Recommendation** — Store a hash of the token, not the token itself, e.g.
`password-reset:${user.id}:${createHash("sha256").update(token).digest("hex")}` (or use a short
HMAC). The raw token only needs to exist inside the outgoing email.

## EMR-03 — OTP code hashed without a server secret (Medium)

**Where** — `src/lib/server/auth/guest-otp.ts`:

```ts
function hashCode(code: string) {
    return createHash("sha256").update(code).digest("hex");
}
```

**Risk** — A 6-digit code has only 1,000,000 possibilities. An unsalted SHA-256 of the code can be
brute-forced offline in milliseconds if the `guest_otps` table leaks.

**Recommendation** — Use a keyed hash, e.g.
`createHmac("sha256", BETTER_AUTH_SECRET).update(code).digest("hex")`, so DB disclosure alone
doesn't allow offline enumeration.

## EMR-04 — No rate limiting on OTP / reset / reminder sends (Medium)

**Where**

- `src/routes/api/guest/otp/request/+server.ts` — unauthenticated beyond a valid guest token; no
  per-recipient or per-IP throttle. A token holder (or leaked-token attacker) can repeatedly
  trigger OTP emails.
- Better Auth config (`src/lib/server/auth/index.ts`) has **no `rateLimit`** option, so
  `requestPasswordReset` is also unthrottled.
- `sendDueReminders` / cron is secret-gated, so lower risk, but still has no per-recipient cap.

**Risk** — Inbox abuse/flooding, and a larger attack surface for code/account enumeration.

**Recommendation**

- Add a small in-memory or DB rate limit on OTP request (e.g. max N per recipient per 15 min).
- Configure Better Auth `rateLimit` for the reset endpoint.
- Keep the idempotent `email_events` keys — they prevent double-send on retry, but not
  deliberate re-requests (a new OTP invalidates the old one, so this is spam-resistance, not
  brute-force resistance).

## EMR-05 — Guest token revocation not enforced in the OTP flow (Medium)

**Where** — `src/lib/server/auth/guest-token.ts` `verifyGuestToken` is stateless (signature +
expiry only); `guestTokens.revokedAt` is never checked anywhere, including
`api/guest/otp/request` and `api/guest/otp/verify`.

**Risk** — A revoked token remains valid; OTP can still be requested/verified with it. (This is a
pre-existing gap from `docs/ai/identity/guest-tokens.md` decision #2, now inherited by the OTP path.)

**Recommendation** — On every verification, look up the `guest_tokens` row and reject when
`revokedAt` is set (aligning with the roadmap P1 item).

## EMR-06 — OTP verify doesn't restrict linking to anonymous accounts (Low)

**Where** — `src/routes/api/guest/otp/verify/+server.ts` only requires `locals.user`; it does not
check `user.isAnonymous`.

**Risk** — A signed-in real account that submits a valid token + code would be linked to the
recipient, overwriting the recipient's `userId`. The page-load path already has an
account-conflict check that redirects real accounts away from guest tokens; the API doesn't
mirror it.

**Recommendation** — Reject when `!locals.user.isAnonymous`, or reuse the same account-conflict
logic used in `sign/+page.server.ts`.

## EMR-07 — Cron secret compared non-constant-time (Low)

**Where** — `src/routes/api/cron/reminders/+server.ts`:
`if (!supplied || supplied !== CRON_SECRET)`.

**Risk** — Theoretical timing side-channel on the header secret. Very low practical impact here,
but trivially fixable.

**Recommendation** — Compare with `timingSafeEqual` on fixed-length buffers.

## EMR-08 — No origin check on guest API routes (Low)

**Where** — `api/guest/otp/request`, `api/guest/otp/verify`, and the pre-existing
`api/guest/link`.

**Risk** — These are JSON POST routes; CORS + SameSite cookies already mitigate most CSRF. A
defense-in-depth origin check removes residual risk.

**Recommendation** — Validate `Origin`/`Sec-Fetch-Site` against `ORIGIN`, or enforce a custom
`x-requested-with`/CSRF token for these endpoints.

## EMR-09 — `email_events` retained indefinitely (Low)

**Where** — `email/index.ts` writes a row per send; no retention/pruning path.

**Risk** — Long-term accumulation of recipient emails + event metadata; if `EMR-02` isn't fixed,
event IDs can also carry reset tokens.

**Recommendation** — Define a retention policy (e.g. prune `sent`/`failed` rows after N days) or
store only a hash of `to`.

## EMR-10 — Console provider is the silent fallback for any unset/unknown provider (Low)

**Where** — `providers.ts` `getProvider()` returns `consoleProvider` for `undefined`, empty, or
any unrecognized `EMAIL_PROVIDER`.

**Risk** — A production typo (e.g. `EMAIL_PROVIDER=resed`) would silently send no email while
writing tokens/codes to server logs (see EMR-01), and `sendEmail` callers ignore the returned
`false`. Availability + token-in-log risk combined.

**Recommendation** — Only fall back to console when `dev` is true; otherwise fail loudly (throw)
so misconfiguration is caught. Have callers handle/log `sendEmail` returning `false`.

---

## Done right (no action)

- OTPs are single-use, expire in 10 minutes, and cap at 5 attempts.
- `email_events.event_id` uniqueness gives send idempotency.
- Cron endpoint is disabled (503) when `CRON_SECRET` is unset.
- OTP request enforces email binding (case-insensitive match against the recipient).
- Guest tokens are HMAC-signed and verified with `timingSafeEqual`.
- Tokens/codes are only ever sent over the email channel (not to the browser) apart from the
  logging issues above.

## Suggested fix order

1. EMR-01 and EMR-02 (token/code leakage) — smallest, highest impact.
2. EMR-03 (keyed OTP hash) — one-line change.
3. EMR-04 (rate limiting) — OTP request + Better Auth `rateLimit`.
4. EMR-05 (revocation enforcement) — closes the roadmap P1 gap.
5. EMR-06 → EMR-10 as hardening follows.
