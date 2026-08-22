# O6 — E-Notary Expansion — Blockers

> **Objective (O6 — see `../core-objectives.md`):** extend the platform to
> notaries — commissions, compliance onboarding, journaling, and remote/in-person
> notarization.
>
> **Status legend:** 🔴 blocking · 🟡 partial / affects quality · 🟢 context / not blocking
> **Created:** 2026-08-23 · **Repo:** `diego-yason/pirma` · **Branch:** `dev`

---

## 1. Current state

Entirely **planned (🔲)** — design in `notary/notary.md`; nothing built. The
notary flow and its certificate/journal paths are roadmap P3.

## 2. Blockers

| # | Blocker | Type | Impact | Status | Unblock path |
|---|---|---|---|---|---|
| B1 | **Notary commission not built** (license, state/jurisdiction, expiry). | Feature (gate) | Nothing else can proceed without a commission record + admin approval. | 🔴 | Build commission fields + approval flow per `notary/notary.md` §1. |
| B2 | **Compliance onboarding not built** (process video + quiz + certificate + court filing). | Feature (gate) | Acting as a notary is gated on onboarding. | 🔴 | Implement the four onboarding steps (platform-managed filing). |
| B3 | **Notary journal (ROR) not built** — its own private blockchain. | Feature (journal) | Required record for notarial acts. | 🔴 | Use the `blockchain-integration.md` mechanism (private-chain variant). |
| B4 | **ION (in-person) notarization** not built. | Feature (notarization) | Core in-person notarial act. | 🟡 | Ship ION first (v1.x revision, notary step, no audit pages). |
| B5 | **Acknowledgment vs. jurat wording** not built (per-jurisdiction templates). | Feature (legal) | Act wording not jurisdiction-correct. | 🟡 | Add per-jurisdiction templates per `notary/notary.md` §4. |
| B6 | **RON (remote, audiovisual)** — deferred. | Feature (notarization) | Two-way AV + recording; later. | 🟢 | Backlog after ION. |
| B7 | **Witnesses + e-notary seal / QR validator** not built. | Feature | Supplementary to acts. | 🟢 | Backlog. |

## 3. Not blockers

- Notary support channel (see O7) and commission-expiry notifications (extend email set).

## 4. Suggested order

1. **B1** — commission + approval.
2. **B2** — compliance onboarding.
3. **B3** — journal (ROR).
4. **B4** — ION, then **B5** — acknowledgment/jurat, then **B6/B7**.

> Related: `docs/ai/roadmap.md` §8.4 · `docs/ai/notary/notary.md` ·
> `docs/ai/blockchain/blockchain-integration.md` · `docs/ai/blockchain/pqc-post-quantum.md`
