# O4 — Guest & Recipient Journey — Blockers

> **Objective (O4 — see `../core-objectives.md`):** let anyone sign — registered
> or not — with a smooth, supported experience.
>
> **Status legend:** 🔴 blocking · 🟡 partial / affects quality · 🟢 context / not blocking
> **Created:** 2026-08-23 · **Repo:** `diego-yason/pirma` · **Branch:** `dev`

---

## 1. Current state (what works)

- Guest tokens + email OTP (`guest_otps`, migration `0002`).
- Signer email invitations + notifications; owner sign/reject notifications.
- Password reset; package-viewer permission enforcement.
- Guest finalize (2026-08-23): linked guests sign via the authenticated flow; a
  token-only finalize escalates to the linked user, or prompts email verification (OTP).

## 2. Blockers

| # | Blocker | Type | Impact | Status | Unblock path |
|---|---|---|---|---|---|
| B1 | **Guest finalize blocked** — guests could fill the sign page but couldn't actually sign. *(Shared with O1-B1.)* | Functional (signing) | Guests are advertised (pricing/OTP) but couldn't complete the primary action. | ✅ resolved 2026-08-23 | `resolveParty` returns the recipient's linked `userId`; `finalize` escalates a linked guest to the authenticated flow and prompts unlinked guests to verify their email (OTP). |
| B2 | **Reject flow client dialog TODO** — server side works (status + reason + notify), but the confirmation UI is unfinished. | Feature (UX) | Incomplete reject experience. | 🟡 | Finish the client confirmation dialog; wire to the server `reject` action. |
| B3 | **`guestTokens.revokedAt` never enforced** — the DB is meant to be the source of truth but the field isn't checked. | Security | Revoked tokens keep working. | 🟡 | Check `revokedAt` during token verification (P1 security). |
| B4 | **Email binding of guest token** not implemented (planned). | Feature (security) | Token isn't bound to a specific email address. | 🟡 | Bind token to email at issuance; verify on use. |
| B5 | **Document templates + Contacts** — UI stubs with no handlers (nav "Templates"/"Contacts" → `/`). | Feature (workspace) | Dead navigation entries. | 🟡 | Build handlers per `signing/signing-workspace-features.md`. |
| B6 | **Token-expiry / link-expired self-service** not built (resend invite / request new link). | Feature (support) | Expired links strand guests. | 🟡 | Add self-service resend/regenerate (ties to B3/B4). |
| B7 | **Guided signing ceremony + mobile/accessibility (WCAG)** not built. | Feature (UX) | Sub-par mobile/assistive signing. | 🟡 | Design per `signing/signing-ux.md`; implement after core flow. |
| B8 | **JWT migration** (`jose`, HS256, standard claims, dedicated secret) — backlog. | Tech-debt (security) | Current token approach is non-standard. | 🟢 | Backlog (roadmap §4, P3). |

## 3. Not blockers (separate track)

- In-app notifications / activity feed (P3, separate).
- Email verification (see O2-B1).

## 4. Suggested order

1. **B1** — ✅ guest finalize implemented (linked-guest escalation + OTP prompt).
2. **B3 / B4** — token revocation + email binding (security).
3. **B2** — reject dialog.
4. **B5 / B6 / B7** — templates/contacts, self-service, UX.

> Related: `docs/ai/roadmap.md` §4/§5/§8.2 · `docs/ai/identity/guest-tokens.md` ·
> `docs/ai/signing/signing-ux.md` · `docs/ai/signing/signing-workspace-features.md`
