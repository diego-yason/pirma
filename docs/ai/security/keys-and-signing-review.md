# Keys & Signing — Security Review

> Status: **Review (2026-08-16)** — fixed since review: KSR-01 (finalize authz), KSR-02 (payload
> binding), KSR-07 (sequential order), KSR-08 (fail-closed verification, 2026-08-19), plus
> tier-2/MFA enforcement and rotation/revocation at signing time + `POST /api/keys/revoke`.
> 2026-08-22: KSR-03 **partially addressed** by the tier-model revision (tier-1 keys become
> single-use/never-stored; tier-2 flag validated at signing) — see `docs/ai/keys/recommendations.md`.
> Open: KSR-04/05/06 (and a server-verifiable password proof for tier-2 uploads).
> Scope: `/api/keys/*`, `src/lib/server/crypto/*`, `sign/+page.server.ts` `finalize`,
> `signing-payload.ts`, `setup-device-keys.ts` (client).
>
> Severity: **High** (fix before production) · **Medium** (fix soon) · **Low** (harden over time).

## Summary

The key lifecycle is well designed at the crypto layer (ECDSA P-256 keys held in the service
worker, challenge + proof-of-possession on upload, prior same-level keys revoked in a
transaction, rotation policy). The main gaps are **authorization at signing time** and **weak
binding of the signed payload** — i.e. what a signature actually proves.

## Findings

| ID | Severity | Finding | Location |
|---|---|---|---|
| KSR-01 | **High** | No server-side authorization in `finalize` (signatory membership + field ownership) | `sign/+page.server.ts` `finalize` |
| KSR-02 | **Medium** | Signing payload binds only `docHash:count` — no package/field/signer/version | `signing-payload.ts` |
| KSR-03 | **Medium** | `keyLevel` trusted from the client on key upload | `/api/keys/upload` |
| KSR-04 | **Low** | Legacy ECDSA `register` stores a pubkey with no possession proof | `/api/keys/register` |
| KSR-05 | **Low** | WebAuthn `register` stores pubkey/credential without attestation/challenge | `/api/keys/register` |
| KSR-06 | **Low** | Challenges held in an in-memory Map (multi-instance + no rate limit) | `crypto/key-challenge.ts`, `/api/keys/challenge` |
| KSR-07 | **Low** | Sequential signing order not enforced server-side | `sign/+page.server.ts` `finalize` |
| KSR-08 | **Low** | `verifyEcdsaSignature` can throw on malformed input → 500 (✅ Fixed 2026-08-19) | `crypto/verify-signature.ts` |

---

## KSR-01 — No server-side authorization in `finalize` (High)

**Where** — `sign/+page.server.ts` `finalize`.

For authenticated users, `resolveParty` returns `{ type: "user", userId }` straight from the
session with **no membership check**. The action then:

1. loads the signing key by `kid` + owner + not-revoked, and
2. verifies the signature over `docHash:count`, and
3. upserts `signatures` rows for whatever `signedFields` were submitted.

It never checks that the user is a `package_recipients` **signer** of this package, nor that the
submitted field IDs are actually assigned to them (`placementFields[].assignedTo`).

**Risk** — any authenticated user who can obtain a document hash + field IDs (e.g. any signer, or
anyone with read access to a draft) can submit signatures for fields assigned to other people, or
for documents they are not a party to. This breaks the core integrity guarantee of the product.

**Recommendation** — in `finalize` (user branch), enforce:
- the user has a `package_recipients` row with `role = "signer"` for this package, and
- every `signedFields` ID belongs to a field in a document of this package **and** is assigned to
  this recipient (or to the owner's `"me"`).

This is already tracked as the roadmap P0 item — close it before any real use.

**Status (2026-08-16)** — ✅ **Fixed.** `finalize` now enforces signatory membership (signer
recipient or owner-with-"me") and rejects any submitted field not assigned to that signer.
Sequential signing order (KSR-07) and payload binding (KSR-02) are now also fixed (2026-08-16).

**Status (2026-08-16)** — ✅ **Fixed** for KSR-01; see KSR-02/KSR-07 below for their resolutions.

## KSR-02 — Signing payload binds only `docHash:count` (Medium)

**Where** — `src/lib/shared/signing-payload.ts`:

```ts
return `${documentHash}:${fieldCount}`;
```

**Risk** — a signature is valid for *any* document with the same content hash and the same field
count, and does not bind:
- the package / version,
- the specific field IDs signed,
- the signer identity.

Replay and cross-document substitution are possible (e.g. two identical documents in different
packages, or re-signing a different set of fields with the same count).

**Recommendation** — build a canonical, deterministic payload that includes package id, document
id/version, the sorted list of field IDs, and the signer's recipient identity, e.g.
`sha256(packageId | documentId | sort(fieldIds) | signerId)`, then sign that. Keep it
deterministic and versioned (roadmap P1 "strengthen signing payload").

**Status (2026-08-16)** — ✅ **Fixed.** `buildSigningPayload` now binds
`packageId:documentId:documentHash:sortedFieldIds:signerUserId`; both the client
(`sign/+page.svelte`) and server (`sign/+page.server.ts`) build it identically.

## KSR-03 — `keyLevel` trusted from the client on key upload (Medium)

**Where** — `/api/keys/upload` accepts `keyLevel` from the request body and stores it.

**Risk** — level-2 keys are intended to be "password-bound" (higher assurance, to satisfy
`mfaRequired`). The server cannot verify the key was actually derived/encrypted with the user's
password — the client simply declares the level. A compromised session could register a
self-chosen level-2 key. Today the impact is limited because `mfaRequired` is not enforced
(KSR/roadmap), but it undermines the tiering model.

**Recommendation** — prove the T2 key is password-bound using the **OPAQUE login challenge itself**,
not a stored hash. When a user completes an OPAQUE login (`completeLogin`), the server stamps the
session as password-authenticated (a short-lived `passwordVerifiedAt` capability). `POST
/api/keys/upload` requires that marker before accepting `keyLevel: 2`, in addition to the existing
key-possession challenge. This is the **"auth for identity, signature for device"** trust model:
the session proves *who* (password-authenticated user), the challenge signature proves *which
device/key*. Do **not** rely on Better Auth's `verifyPassword`/`signInEmail` (they require a
`providerId: "credential"` account with a stored hash that OPAQUE accounts don't have), and do
**not** accept a client-supplied password-derived signature as proof (the server can't verify which
password was used without a verifier, and storing one defeats OPAQUE).

**Status (2026-08-22)** — **Partially addressed by the tier-model revision**
(`docs/ai/keys/recommendations.md` § "Tier model revision"). Tier is no longer trusted from
metadata for tier-1 keys — they are single-use, hour-bounded, and never written to disk, so there
is no stored tier-1 metadata to forge. For tier-2, the `keyLevel` flag is retained but **must be
validated** against the stored row at signing time (already enforced in `finalize` via the
`kid`/`keyLevel` match). **Open:** stamping the session `passwordVerifiedAt` at OPAQUE
`completeLogin` and requiring it for T2 upload (per the recommendation above) — the strongest
remaining fix for the persistent tier. Note: the T2 key-wrapping password is the user's account
password (compatible with OPAQUE — see `docs/ai/keys/recommendations.md` §4), and OAuth sign-in is
slated for removal.

## KSR-04 — Legacy ECDSA `register` has no possession proof (Low)

**Where** — `/api/keys/register` "Legacy ECDSA registration" inserts `{ userId, pubkey, keyLevel: 1 }`
without a challenge/signature.

**Risk** — a user can register a key they don't control. They can't *use* it (they can't sign with
a key they don't own), so practical impact is limited, but it pollutes key state and skips the
upload path's stronger guarantees. Prefer the `upload` endpoint everywhere and deprecate this
path.

## KSR-05 — WebAuthn `register` stores credential without attestation (Low)

**Where** — `/api/keys/register` `keyType === "webauthn"` inserts `{ pubkey, credentialId, keyType: "webauthn", keyLevel: 2 }` with no server-side challenge or attestation verification.

**Risk** — these rows represent a higher-assurance "webauthn" key but nothing cryptographically
ties them to a real WebAuthn ceremony. (Note: the actual account passkey login is handled by
Better Auth's `passkey` plugin and is separate — this is about the document-signing keys.)

**Recommendation** — verify the credential via the WebAuthn attestation flow, or drop this path
until it's properly implemented.

## KSR-06 — Challenges held in an in-memory Map (Low)

**Where** — `crypto/key-challenge.ts` (`const challenges = new Map()`) + `/api/keys/challenge`.

**Risk** — challenges don't survive restarts, don't work across multiple instances/load balancers,
and are unthrottled. A session holder can request unbounded challenges (low harm). The challenge
nonce is also logged (`logger.info("challengeEndpoint", …, nonce)`).

**Recommendation** — persist challenges (DB/Redis) with TTL + rate limit, and stop logging the
nonce (or log only a prefix). Roadmap P1.

## KSR-07 — Sequential signing order not enforced server-side (Low)

**Where** — `sign/+page.server.ts` sets `canSign = false` for later signing groups but `finalize`
never re-checks the order.

**Risk** — a direct API caller can sign out of order, bypassing `signingOrderEnabled`.

**Recommendation** — enforce group ordering in `finalize` (reject if any earlier signing group is
incomplete).

**Status (2026-08-16)** — ✅ **Fixed.** `finalize` now rejects when `signingOrderEnabled` is on and
the signer is in a later group whose earlier groups haven't all signed every document.

## KSR-08 — `verifyEcdsaSignature` can throw on malformed input (Low)

**Where** — `crypto/verify-signature.ts` — no length/format guard before DER conversion, and
`verify.verify()` may throw on malformed DER.

**Risk** — malformed base64/signature yields an unhandled 500 rather than a clean 400.

**Recommendation** — wrap verification in try/catch and return `false` on malformed input; enforce
the expected signature length (64-byte P1363 or valid DER).

**Status (2026-08-19)** — ✅ **Fixed.** `verifyEcdsaSignature` now wraps verification in a
`try/catch` and returns `false` on any error — fail-closed, no throw → no 500. Covered by
`src/lib/server/crypto/verify-signature.spec.ts` (empty/garbage/truncated signature, invalid
public key all return `false`).

---

## Done right (no action)

- Key upload requires a fresh single-use challenge + ECDSA proof-of-possession.
- Prior same-level keys are revoked in a DB transaction on upload (old keys retained for
  verification).
- `finalize` does check the signing key is not revoked (`isNull(revokedAt)`).
- Rotation policy covers age / idle / usage count / algorithm.
- ECDSA verification supports both P1363 and DER encodings.

## Suggested fix order

1. KSR-01 (finalize authorization) — critical correctness/security gate.
2. KSR-02 (payload binding) — do together with KSR-01 so the payload format is final.
3. KSR-03 (level-2 proof) — before enabling `mfaRequired`.
4. KSR-04 → KSR-08 as hardening.
