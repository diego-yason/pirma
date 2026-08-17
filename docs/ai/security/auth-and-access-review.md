# Auth & Access Control — Security Review

> Status: **Review (2026-08-16)** — findings, not yet fixed
> Scope: Better Auth config, guest tokens, package/document access checks, recipient sync,
> upload, storage URL cache, and DB RLS posture.
>
> Severity: **High** (fix before production) · **Medium** (fix soon) · **Low** (harden over time).

## Summary

Authentication is built on Better Auth with a strong set of plugins (email/password + OPAQUE,
passkey, anonymous). The gaps are concentrated in **authorization** — specifically, `package_viewers`
is defined but never enforced, and one action updates a document by an unverified `docId`. Auth
hardening options (email verification, 2FA, rate limiting) are available in Better Auth but not
enabled.

## Findings

| ID | Severity | Finding | Location |
|---|---|---|---|
| AAR-01 | **High** | `package_viewers` is never enforced | `doc/[pageId]/+page.server.ts`, `view/+page.server.ts` |
| AAR-02 | **High** | `syncRecipients` updates a document by an unverified `docId` (IDOR) | `doc/new/[packageId]/+page.server.ts` |
| AAR-03 | **Medium** | Guest token revocation not enforced; secret reused from auth secret | `auth/guest-token.ts` |
| AAR-04 | **Medium** | Email verification, 2FA, and rate limiting not enabled | `auth/index.ts` |
| AAR-05 | **Low** | Upload trusts client-supplied MIME type + `pageCount` | `doc/new/+page.server.ts` |
| AAR-06 | **Low** | In-memory signed-URL cache (unbounded) + shareable 1h URLs | `storage/url-cache.ts`, page loaders |
| AAR-07 | **Low** | Anonymous account creation is unlimited | Better Auth `anonymous()` plugin |
| AAR-08 | **Info** | RLS enabled on tables but no policies; relies on service-role bypass | `schema.ts` |

---

## AAR-01 — `package_viewers` never enforced (High)

**Where** — `src/routes/(app)/doc/[pageId]/+page.server.ts` and `view/+page.server.ts` both gate
access as `isOwner || recipientRow` only. `doc/[pageId]` even has the explicit
`// TODO: also check package_viewers once that feature is wired up`.

**Risk** — anyone added as a viewer (role `viewer`, or the `package_viewers` table) is denied —
but more importantly the reverse: the `package_viewers` table exists and is written, yet provides
**no access at all**, and viewers silently fall back to being recipients. Until it's wired, the
model is inconsistent and any future misconfiguration could over-grant.

**Recommendation** — add the `package_viewers` lookup to both loaders and reject/redirect when the
user is neither owner, recipient, nor viewer. Roadmap P0.

**Status (2026-08-16)** — ✅ **Fixed.** Both `doc/[pageId]/+page.server.ts` and
`view/+page.server.ts` now query `package_viewers` and allow access as `owner || recipient || viewer`.

## AAR-02 — `syncRecipients` updates a document by an unverified `docId` (High)

**Where** — `src/routes/(app)/doc/new/[packageId]/+page.server.ts` `syncRecipients`:

```ts
const docId = formData.get("documentId")?.toString();
if (docId) {
    await db.update(documents).set({ placementFields }).where(eq(documents.id, docId));
}
```

The action verifies the user owns the **package** (`requirePackageOwnership`), but the **document**
is updated purely by client-supplied `docId` with no check that the document belongs to this
package.

**Risk** — a broken object-level authorization (IDOR): an owner of *any* package who knows/guesses
a document UUID can overwrite that document's `placementFields`, even for documents in other
users' packages.

**Recommendation** — scope the update to documents assigned to the verified package, e.g. join
`document_assignments` (`documentId = docId AND packageId = params.packageId`) or check
`documents.owner = locals.user.id` in the same query.

## AAR-03 — Guest token revocation not enforced; secret reused (Medium)

**Where** — `src/lib/server/auth/guest-token.ts`.

**Risk** — `verifyGuestToken` is stateless (signature + expiry); `guestTokens.revokedAt` is never
consulted, so a revoked token remains valid for its full 7-day window. The token is also signed
with `BETTER_AUTH_SECRET`, coupling guest-token security to the session secret and invalidating
all guest tokens on rotation.

**Recommendation** — on every verification, look up the `guest_tokens` row and reject when
`revokedAt` is set; add a dedicated `GUEST_TOKEN_SECRET` with fallback (per
`docs/ai/guest-tokens.md`). Roadmap P1.

## AAR-04 — Email verification, 2FA, and rate limiting not enabled (Medium)

**Where** — `src/lib/server/auth/index.ts`: `emailAndPassword: { enabled: true, sendResetPassword }`
with no `requireEmailVerification`, no `twoFactor` plugin, no `rateLimit`.

**Risk** — anyone can register with an arbitrary email (no ownership proof) and appear as a
"registered signer"; accounts can be probed; reset/sign-in endpoints are unthrottled.

**Recommendation** — enable `requireEmailVerification`, add the `twoFactor` plugin (relevant to
`mfaRequired`), and set Better Auth `rateLimit`. Roadmap §6 items.

## AAR-05 — Upload trusts client-supplied MIME type + `pageCount` (Low)

**Where** — `src/routes/(app)/doc/new/+page.server.ts` validates against `file.type`
(the client-declared MIME) and stores a client-supplied `pageCount`.

**Risk** — MIME can be spoofed (a disallowed file labeled `application/pdf`), and `pageCount` is
stored unvalidated (negative/absurd values). Size + type allowlist + hashing are otherwise good.

**Recommendation** — sniff magic bytes for the accepted types; clamp/derive `pageCount`
server-side (or drop it).

## AAR-06 — In-memory signed-URL cache (unbounded) + shareable 1h URLs (Low)

**Where** — `storage/url-cache.ts` (`getSignedUrl`/`setSignedUrl` Map) used by every document
loader.

**Risk** — entries are TTL-checked on read but never actively evicted, so the Map grows without
bound (one entry per storage path ever accessed); signed URLs (1 hour) are reused across requests
and users, and a leaked URL grants read access to the draft for its validity window.

**Recommendation** — add TTL/eviction (or LRU cap) to the cache; use shorter-lived URLs and
enforce access at the route (already done) rather than relying on URL secrecy.

## AAR-07 — Anonymous account creation is unlimited (Low)

**Where** — Better Auth `anonymous()` plugin, invoked freely on the sign page.

**Risk** — unbounded anonymous accounts can be minted; combined with guest OTP this is bounded for
the *signing* path, but the accounts themselves are unthrottled.

**Recommendation** — acceptable for v1 given OTP gating; consider a per-IP rate limit on
`signIn.anonymous` if abuse is observed.

## AAR-08 — RLS enabled but no policies; service-role reliance (Info)

**Where** — `schema.ts` calls `.enableRLS()` on most tables; the app connects via
`DATABASE_URL` and uses the Supabase service key for storage.

**Risk** — RLS without policies is effectively "deny for non-bypass roles"; the app works only
because the connection role bypasses RLS. If the connection is ever switched to a restricted role
(which RLS suggests is intended), all queries would fail. This is a configuration posture to
verify, not an immediate vulnerability.

**Recommendation** — confirm the DB role used by the app is intentionally `BYPASSRLS`/owner, and
decide whether to define real RLS policies (tenant/user scoping) before locking down.

---

## Done right (no action)

- Package ownership enforced via `requirePackageOwnership` on create/edit/finalize.
- Recipient membership checked on the detail/view/sign page loaders.
- Upload enforces auth, size cap (50 MB), type allowlist, SHA-256 hashing, random storage path,
  and `upsert: false`.
- OPAQUE + passkey for strong account auth; guest signing requires email OTP (see email review).
- `syncRecipients` enforces a max recipient count.

## Suggested fix order

1. AAR-02 (docId IDOR) — small change, high impact.
2. AAR-01 (package viewers enforcement) — closes a P0 gap.
3. AAR-03 (guest token revocation) — closes a P1 gap; aligns with OTP flow.
4. AAR-04 (email verification / 2FA / rate limit) — account trust model.
5. AAR-05 → AAR-08 as hardening.
