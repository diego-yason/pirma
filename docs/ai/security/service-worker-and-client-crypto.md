# Service Worker & Client Crypto — Security Note

> Last checked: **2026-08-16**
> Verdict: ✅ **Clear** (no significant issues; one low observation below)

## Scope
`src/service-worker/index.ts`, `src/lib/client/crypto/sw-key.ts`,
`setup-device-keys.ts`, `device-fingerprint.ts`.

## Verified OK

- **Level-1 session keys** live only in SW memory (`keyStore` Map) and are never persisted —
  they're gone when the SW restarts.
- **Level-2 keys** are password-wrapped and stored in IndexedDB, unwrapped only after an explicit
  password unlock.
- **Key wrapping** uses PBKDF2 (600,000 iterations), a per-key random 16-byte salt, and AES-GCM
  (12-byte IV) — a sound KDF + AEAD combination.
- **Device fingerprint** hashes ambient browser properties with SHA-256; it is non-invasive and
  not reversible to PII.
- Private key material never leaves the service worker; only public keys and signatures cross the
  page ↔ SW boundary.

## Low observation

1. **`postMessage` RPC (`sw-key.ts`)** — the messenger has no explicit origin/scope verification
   and accepts messages from any script running on the origin. This is standard for SW RPC but
   means a same-origin XSS could invoke key operations. The earlier roadmap note (RPC ID prefixes
   `dk`/`sk`) is a mitigation, not a boundary. Consider validating `event.source`/`origin` and
   keeping the API surface minimal.

No High/Medium findings.
