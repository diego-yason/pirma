# Organizations, Admin & Commercial

> Status: **Draft — design, not implemented**
> Created: 2026-08-16
> Repo: `diego-yason/pirma`
> Related:
> - `docs/ai/roadmap.md` §8.6
> - Better Auth `organization` plugin (installed, unused)

## 1. Organizations / teams & roles

**Purpose:** multi-user accounts — foundational architectural change.

- Enable Better Auth's **organization plugin** (already installed, unused).
- An org owns packages/docs/contacts; members get roles:
  - `owner` — full control, billing
  - `admin` — manage docs/members/notaries
  - `member` — create/send packages
- Org invitations (email via the notification module).
- **Migration**: existing users become a personal org (or `org` null → personal workspace) so
  current data keeps working.

**Open:** personal-org-per-user vs. nullable-org migration; how recipients in a package relate
to org members (autocomplete from org members first, then contacts).

## 2. Billing / usage metering

- **Metered unit**: envelopes (packages sent) + signatures; limit checks at send time
  (`PUBLIC_MAX_RECIPIENTS` is an early hint of caps).
- **Provider**: Stripe (default) for subscriptions/invoices; a `usage_events`/`plan` model.
- Enforced server-side at `confirm`/`createPackage` and `finalize`.

**Open:** pricing model (per-seat vs. per-envelope); Stripe vs. other.

## 3. Admin console

- Platform-wide: users, documents/packages, notaries (approve commissions), disputes, audit
  search.
- Access-gated to platform admins (a `role` on user, or a `platform_admins` list).

## 4. Reports / analytics

- Completion funnel (sent → opened → signed → executed), avg time-to-sign, per-signer stats,
  per-org usage (for billing).
- v1: SQL aggregates; later a reporting store.

**Open:** internal-only vs. customer-facing reports.
