# OPAQUE Auth Plugin — Security Note

> Last checked: **2026-08-16**
> Verdict: ✅ **Clear** (no significant issues)

## Scope
`plugins/better-auth-opaque/src/` (registration + login challenge/complete endpoints, server
state encryption, account storage).

## Verified OK

- **Anti-enumeration on registration**: `completeRegistration` always returns success whether the
  user existed or not, and `getRegisterChallenge` performs the same DB lookup for both paths.
- **Timing-attack resistance on login**: `getLoginChallenge` always generates a dummy registration
  record and performs identical work for existing and non-existing users.
- **Server login state** is encrypted (`encryptServerLoginState`) before round-tripping through
  the client.
- Input validation uses Zod (`email`, base64url bodies) and explicit length checks on OPAQUE
  messages.
- The OPAQUE registration record is stored on the Better Auth `account` row, unique and validated.

## Notes (not vulnerabilities)

1. If `OPAQUE_SERVER_KEY` is unset, the plugin **generates a new key at startup** and logs it.
   Fine for local dev, but `OPAQUE_SERVER_KEY` **must** be set (and stable) in production or every
   deploy invalidates OPAQUE credentials. It is already declared in `src/env.ts` and `.env.example`.
2. `insecureCreateSessionOnRegister` (off by default) correctly logs a loud warning when enabled.

No High/Medium/Low findings.
