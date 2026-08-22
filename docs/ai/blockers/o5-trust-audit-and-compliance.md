# O5 — Trust, Audit & Compliance — Blockers

> **Objective (O5 — see `../core-objectives.md`):** evidence and legal posture —
> what happened, when, and that the process meets the law's requirements.
>
> **Status legend:** 🔴 blocking · 🟡 partial / affects quality · 🟢 context / not blocking
> **Created:** 2026-08-23 · **Repo:** `diego-yason/pirma` · **Branch:** `dev`

---

## 1. Current state

Entirely **planned (🔲)** — design docs exist (`identity/audit-trail.md`,
`identity/identity-verification.md`, `compliance/compliance-and-public-api.md`,
`platform/storage-tiering.md`) but nothing is built.

## 2. Blockers

| # | Blocker | Type | Impact | Status | Unblock path |
|---|---|---|---|---|---|
| B1 | **Structured audit trail / event log not built** — no per-event capture (opened, viewed, signed, IP, device, UA, timestamp). | Feature (audit) | No authoritative record of what happened when. | 🔴 | Design per `identity/audit-trail.md`; implement event log + hash-chained checkpoints. |
| B2 | **ESIGN / UETA / eIDAS disclosure & rights not built** — no click-to-consent or right-to-withdraw. | Compliance | Legal posture for e-signature validity is weaker. | 🔴 | Implement disclosures per `compliance/compliance-and-public-api.md`. |
| B3 | **Signer identity verification not built** (SMS OTP, KYC/ID, knowledge-based). *(Shared with O2-B4.)* | Feature (identity) | No proofing beyond login. | 🟡 | Ship SMS OTP first per `identity/identity-verification.md`. |
| B4 | **Geolocation / device attestation capture** not built. | Feature (audit) | Missing context in the record. | 🟡 | Add capture hooks to the audit trail (B1). |
| B5 | **Storage tiering** (hot → cold → arctic) not built. | Feature (ops) | Retention/lifecycle unmanaged. | 🟢 | Design per `platform/storage-tiering.md`. |
| B6 | **Certificate of completion / audit pages** not built (overlaps roadmap §3). | Feature (compliance) | No user-facing completion certificate. | 🟢 | Build after artifacts (O3) exist. |

## 3. Not blockers

- Audit event vocabulary / taxonomy — to be defined during design (B1).

## 4. Suggested order

1. **B2** — disclosures (legal baseline for e-sign validity).
2. **B1** — audit trail (the evidentiary core).
3. **B3 / B4** — identity verification + geolocation/device capture.
4. **B5 / B6** — storage tiers, certificate pages.

> Related: `docs/ai/roadmap.md` §8.3/§8.5 · `docs/ai/identity/audit-trail.md` ·
> `docs/ai/identity/identity-verification.md` · `docs/ai/compliance/compliance-and-public-api.md` ·
> `docs/ai/platform/storage-tiering.md`
