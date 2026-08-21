# OPAQUE Auth Plugin — Security Note

> Last checked: **2026-08-16** (updated 2026-08-22 re: T2 password decision)
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
3. **T2 password = account password (2026-08-22).** The tier-2 signing-key wrap password is the
   user's account password. This is compatible with OPAQUE: OPAQUE governs the *authentication
   exchange* (server never sees the password; stores only the `registrationRecord`), while the T2
   wrap is a *local* PBKDF2 derivation in the service worker — the server only ever receives the
   T2 **public** key. Using the same password does **not** expose the password to the server.
4. **Implication for password proofs (2026-08-22).** Because OPAQUE accounts have `providerId:
   "opaque"` and **no `credential` password hash**, Better Auth's `verifyPassword`/`signInEmail`
   do **not** work for them. Any server-side "password verified" proof (e.g. for T2 key
   registration, KSR-03) must be based on the **OPAQUE login challenge itself** — stamp the
   session `passwordVerifiedAt` at `completeLogin` and require it for `keyLevel: 2` uploads.
   Do not accept a client-supplied password-derived signature as standalone proof (the server
   can't verify which password was used without a verifier, and storing one defeats OPAQUE).

No High/Medium/Low findings.
