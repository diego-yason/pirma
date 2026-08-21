# Signing Payloads — T1 / T2 / T3 (Key Tiers)

> Status: **Design (2026-08-22)**
> Source-of-truth links: `docs/ai/keys/recommendations.md` (tier model revision + trust model),
> `docs/ai/security/keys-and-signing-review.md` (KSR-03).
> This doc specifies **what gets signed / uploaded** for each tier and **what each payload proves**.
> Not yet implemented — the current code only builds the **base payload** (T1/T2 share one format).

## Tier definitions

| Tier | Meaning | Trust anchor | Proves |
|---|---|---|---|
| **T1** | Device only | Session key (in-memory, never written to disk) | *this device* signed |
| **T2** | Identity + device | Password-authenticated session (OPAQUE) **and** persistent device key | *this user* on *this device* |
| **T3** | HW key | Hardware-backed key (WebAuthn / secure enclave / TPM), non-extractable | *this hardware* signed (attestable) |

Model recap ("auth for identity, signature for device"):
- T1 = signature only (device).
- T2 = signature (device) **+** password-authenticated session (identity).
- T3 = signature (device/HW) **+** attestation (the key provably lives in hardware).

---

## 0. Common: the base document payload (unchanged)

Every tier signs the **same base payload** — one signature per document, not per field:

```
pkg:{packageId}:doc:{documentId}:hash:{documentHash}:fields:{sortedFieldIds}:signer:{signerUserId}
```

- Built by `src/lib/shared/signing-payload.ts` (`buildSigningPayload`).
- `sortedFieldIds` = deduped, lexicographically sorted, comma-joined.
- Binds package, document, content hash, exact field set, and signer — prevents replay/across-document/attribution attacks.

**Change:** the payload is wrapped in a **tier envelope** (below) so the server can distinguish *what kind* of key produced the signature and enforce tier-specific rules.

---

## 1. T1 — device only

### Signed payload

The base payload, wrapped with the tier + a device key fingerprint + a timestamp (for the 1-hour rule):

```
pirma-sig:v1:tier:T1
key-fp:{sha256(spki-pubkey)}
payload:{pkg}:{doc}:{hash}:{fields}:{signer}
ts:{issuedAtISO}
```

Fields:
- `key-fp` — `sha256` of the SPKI public key (hex). T1 keys are **never stored**, so this fingerprint is what ties the signature to the device in the audit row.
- `ts` — ISO timestamp; the server rejects if `now - ts > 1h` (the "same hour as the signed payload" rule).

### Wire upload (registration)

T1 keys are never registered server-side. There is **no `cryptoKeys` row** and no `/upload` call for T1. The key is minted in the service worker per packet and discarded. (For audit, `finalize` stores `sha256(pubkey)` + the signature.)

### What it proves / server check at `finalize`

- Proves: possession of the in-memory session key ⇒ *this device* signed.
- Server cannot do a `kid` lookup (nothing stored) — the pubkey must travel **in the packet**. Server verifies the ECDSA signature against the in-message pubkey, checks the `1h` timestamp, then persists only `key-fp` + signature.

---

## 2. T2 — identity and device

### Signed payload

```
pirma-sig:v1:tier:T2
kid:{keyId}
payload:{pkg}:{doc}:{hash}:{fields}:{signer}
```

Fields:
- `kid` — the persistent key's server-side id (matches the `cryptoKeys.kid` row).
- No `key-fp` needed — the server looks up the pubkey by `kid` (owned by user, not revoked).
- No separate `ts` — freshness is enforced via the **session** (`passwordVerifiedAt`), not a payload timestamp.

### Wire upload (registration)

```
POST /api/keys/upload
{
  "pubkey": "<SPKI PEM>",
  "keyLevel": 2,
  "algorithm": "ECDSA-P256",
  "nonce": "<challenge nonce>",
  "kid": "<uuid>",
  "signature": "<base64 ECDSA over JSON.stringify(challenge)>",
  "deviceInfo": { "...": "..." },
  // NEW (KSR-03): proof the session was password-authenticated
  "sessionProof": "<OPAQUE passwordVerifiedAt capability>"
}
```

- `sessionProof` is the server-issued marker set at OPAQUE `completeLogin` (short-lived,
  session-bound). Without it, `keyLevel: 2` is rejected — the client cannot self-declare a T2 key.

### What it proves / server check at `finalize`

- Proves (together): **identity** — the session is password-authenticated (`passwordVerifiedAt`)
  — **and** **device** — the persistent key signed the payload.
- Server: looks up `cryptoKeys` by `(userId, kid)` not revoked; confirms stored `keyLevel === 2`;
  confirms the session carries `passwordVerifiedAt` (for `mfaRequired`); verifies the ECDSA
  signature over the envelope against the stored pubkey; runs rotation policy.

---

## 3. T3 — HW key

### Signed payload

```
pirma-sig:v1:tier:T3
cred:{credentialId}
payload:{pkg}:{doc}:{hash}:{fields}:{signer}
```

Fields:
- `cred` — the WebAuthn / hardware credential id (maps to a stored `cryptoKeys.credentialId` row
  with `keyType: "webauthn"`).
- T3 signatures are produced by a **non-extractable** hardware-backed key (WebAuthn `credential` /
  secure enclave / TPM) — the private key cannot leave the hardware.

### Wire upload (registration)

```
POST /api/keys/upload   (or /api/keys/register, keyType "webauthn")
{
  "pubkey": "<SPKI PEM>",
  "keyLevel": 3,
  "algorithm": "ECDSA-P256",
  "nonce": "<challenge nonce>",
  "kid": "<uuid>",
  "credentialId": "<WebAuthn credential id>",
  "attestation": "<WebAuthn attestation object>",
  "signature": "<base64 ECDSA over challenge>",
  "deviceInfo": { "...": "..." }
}
```

- **KSR-05:** unlike today, the WebAuthn registration must be verified via the **attestation**
  flow (or the challenge signed by the credential during a real `navigator.credentials.create`
  ceremony) — no unverified `keyLevel: 3` rows.

### What it proves / server check at `finalize`

- Proves: the signature came from a key **bound to specific hardware** (attestation-verified at
  registration; the credential id maps to the stored key).
- Server: looks up `cryptoKeys` by `(userId, credentialId)`; confirms `keyType`/`keyLevel` is HW;
  verifies the ECDSA signature against the stored pubkey; enforces rotation policy.

---

## 4. Envelope format note

The three envelopes differ only in the **binding segment**:

| Tier | Binding segment | Meaning |
|---|---|---|
| T1 | `key-fp:{sha256(pubkey)}` | device (fingerprint of an un-stored key) |
| T2 | `kid:{keyId}` | device (persistent key row) |
| T3 | `cred:{credentialId}` | hardware (attestable credential) |

The base `payload:` segment is identical across tiers — a T1/T2/T3 signature over the same
document covers the same semantic content; the tier only changes *what binds* the signer to the
device/hardware.

---

## 5. Verification matrix

| Check | T1 | T2 | T3 |
|---|---|---|---|
| ECDSA sig valid vs pubkey | ✅ (in-packet) | ✅ (by `kid`) | ✅ (by `cred`) |
| Pubkey lookup server-side | ❌ (never stored) | ✅ | ✅ |
| Requires password-authenticated session | ❌ | ✅ | ❌ |
| Hardware attestation | ❌ | ❌ | ✅ |
| `finalize` enforces tier for `mfaRequired` | reject | require | **require (T3 HW key satisfies `mfaRequired`)** |
| Rotation policy | n/a (ephemeral) | ✅ | ✅ |

\* T3 proves hardware, not password — **decision (2026-08-22): a T3 hardware key DOES satisfy
`mfaRequired`** (hardware-backed signing is treated as a strong second factor; the attestation-
verified credential is the factor, not the password session).

---

## 6. Server checks at `finalize` (to implement)

1. Parse envelope, read `tier`.
2. **T1:** take pubkey from packet → `verifyEcdsaSignature(pubkey, envelope, sig)` → check
   `ts` within 1h → store `key-fp` + sig in the signature row.
3. **T2:** load key by `(userId, kid)` not revoked → assert `keyLevel === 2` → if
   `mfaRequired`, assert session `passwordVerifiedAt` → verify sig.
4. **T3:** load key by `(userId, credentialId)` → assert HW type → verify sig → if
   `mfaRequired`, assert a **hardware-backed credential was used** (satisfied — decision
   2026-08-22).

`buildSigningPayload` is extended to accept `tier` + binding fields and emit the envelope;
`verifyEcdsaSignature` stays as-is (it operates on the envelope string).
