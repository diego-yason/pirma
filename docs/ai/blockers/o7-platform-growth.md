# O7 — Platform Growth (Orgs, Commercial, Integrations, Support) — Blockers

> **Objective (O7 — see `../core-objectives.md`):** scale beyond single users —
> teams, commerce, integrations, and self-service help.
>
> **Status legend:** 🔴 blocking · 🟡 partial / affects quality · 🟢 context / not blocking
> **Created:** 2026-08-23 · **Repo:** `diego-yason/pirma` · **Branch:** `dev`

---

## 1. Current state

Entirely **planned (🔲)** — Better Auth `organization` plugin is installed but
unused. Design docs exist (`platform/organizations-and-admin.md`, `platform/support.md`,
`platform/integrations-upload.md`, `compliance/compliance-and-public-api.md`).

## 2. Blockers

| # | Blocker | Type | Impact | Status | Unblock path |
|---|---|---|---|---|---|
| B1 | **Organizations / teams & roles not built** — org plugin unused; no RBAC. | Feature (foundation) | Everything in this objective builds on orgs. | 🔴 | Enable the Better Auth `organization` plugin + roles/permissions. |
| B2 | **Admin console not built** (incl. support-agent tooling). | Feature (admin) | No platform management surface. | 🟡 | Build admin console per `platform/organizations-and-admin.md`. |
| B3 | **Billing / usage metering not built.** | Feature (commercial) | No monetization/limits. | 🟡 | Usage metering + plans (e.g. `PUBLIC_MAX_RECIPIENTS` cap hints at intent). |
| B4 | **Help center / FAQ not built** (party + notary personas). | Feature (support) | No self-service help. | 🟡 | Static routes per `platform/support.md`. |
| B5 | **In-app contact-support form not built** (auto-attached context). | Feature (support) | No in-app escalation. | 🟡 | Build per `platform/support.md` (package/token/anchorId auto-derived). |
| B6 | **Upload integrations not built** (cloud storage / sources). | Feature (integrations) | Uploads limited to local files. | 🟡 | Per `platform/integrations-upload.md`. |
| B7 | **Reports / analytics not built.** | Feature (analytics) | No usage insights. | 🟢 | Backlog. |
| B8 | **Public developer API + webhooks** — explicitly **long after release**. | Feature (API) | Not needed for launch. | 🟢 | Backlog per `compliance/compliance-and-public-api.md`. |
| B9 | **Priority notary support channel** not built. | Feature (support) | Two-tier support missing. | 🟢 | Extends B4/B5 after O6 exists. |

## 3. Not blockers

- These are all post-launch features by design; nothing here blocks the signing core (O1).

## 4. Suggested order

1. **B1** — organizations/RBAC (foundation).
2. **B2** — admin console.
3. **B3** — billing/metering.
4. **B4 / B5** — help center + support form.
5. **B6+** — integrations, reports, API (backlog).

> Related: `docs/ai/roadmap.md` §8.6–§8.8 · `docs/ai/platform/organizations-and-admin.md` ·
> `docs/ai/platform/support.md` · `docs/ai/platform/integrations-upload.md` ·
> `docs/ai/compliance/compliance-and-public-api.md`
