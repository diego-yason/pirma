# O2 — Secure Identity & Key Management — Blockers

> **Objective (O2 — see `../core-objectives.md`):** cryptographic identity and the
> keys that back it — client-held keys tiered by assurance, with rotation,
> revocation, MFA, and identity proofing.
>
> **Status legend:** 🔴 blocking · 🟡 partial / affects quality · 🟢 context / not blocking
> **Created:** 2026-08-23 · **Repo:** `diego-yason/pirma` · **Branch:** `dev`

---

## 1. Current state (what works)

- Level-1 session keys (SW memory, non-extractable) + level-2 password-bound
  persistent keys (random per-key salt).
- Upload endpoint revokes prior same-level keys (transactional).
- `finalize` looks up the key by `kid` + enforces `keyLevel`; MFA/tier-2 enforcement.
- Key rotation + revocation enforced at signing time; revoke endpoint exists.
- SW RPC ID-prefix isolation (`dk`/`sk`).

## 2. Blockers

| # | Blocker | Type | Impact | Status | Unblock path |
|---|---|---|---|---|---|
| B1 | **Email verification on sign-up not enabled** — Better Auth `requireEmailVerification` is off. | Security (decision) | Unverified emails can sign; weaker identity claim. | 🟡 | Enable `requireEmailVerification` + the verification email flow. |
| B2 | **2FA not enabled** — Better Auth `twoFactor` plugin is off; relevant to `mfaRequired` (which today means "level-2 key", not true 2FA). | Security (decision) | "MFA required" doesn't yet mean real multi-factor. | 🟡 | Enable the `twoFactor` plugin + enrollment/verify flow. |
| B3 | **Signing challenges not persisted + no rate limit** — `/api/keys/challenge` has no DB/Redis persistence or throttling. | Security | Brute-force/challenge-replay exposure. | 🟡 | Persist challenges (DB/Redis) + rate-limit the endpoint. |
| B4 | **Signer identity verification not built** — SMS OTP, KYC/ID, knowledge-based (roadmap §8.3). | Feature (identity) | No identity proofing beyond account login. | 🟡 | Design per `identity/identity-verification.md`; ship SMS OTP first. |
| B5 | **Package expiration not enforced** — `packages.expirationDate` exists; unclear if checked at sign/finalize. | Feature (policy) | Expired packages may still be signable. | 🟡 | Enforce `expirationDate` at sign/finalize (hard vs. soft decision). |

## 3. Not blockers (polish / separate track)

- Tier-model refinements and key-payload spec notes (see `keys/recommendations.md`).
- Post-quantum key migration (roadmap P3; additive).

## 4. Suggested order

1. **B1 / B2** — enable Better Auth email verification + 2FA (low effort, high security value).
2. **B3** — persist challenges + rate-limit.
3. **B5** — enforce package expiration.
4. **B4** — identity verification (larger; overlaps O5).

> Related: `docs/ai/roadmap.md` §1/§6 · `docs/ai/keys/recommendations.md` ·
> `docs/ai/keys/payloads.md` · `docs/ai/identity/identity-verification.md`
