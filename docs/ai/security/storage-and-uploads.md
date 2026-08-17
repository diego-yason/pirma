# Storage & Uploads — Security Note

> Last checked: **2026-08-16**
> Verdict: ✅ **Clear** (no significant issues; two low observations below)

## Scope
`src/lib/server/storage/` (Supabase client, signed-URL cache), `doc/new/+page.server.ts`
(upload), `settings/+page.server.ts` (signature upload/delete), `api/signature/[id]` (download).

## Verified OK

- **Upload (`doc/new`)**: auth required, 50 MB cap, MIME allowlist
  (PDF/DOCX/JPG/PNG), SHA-256 computed server-side, random storage path, `upsert: false`.
- **Signature upload (`settings`)**: auth required, 5 MB cap, image allowlist, path scoped to
  `signatures/{userId}/{uuid}.{ext}`.
- **Signature delete**: soft delete scoped to `userId = locals.user.id` (no cross-user delete).
- **Supabase client**: service-role key used only server-side; never exposed to the browser.

## Low observations (optional hardening)

1. **`url-cache.ts`** — signed URLs are TTL-checked on read but **never actively evicted**, so the
   in-memory `Map` grows unbounded (one entry per storage path ever accessed). Add periodic
   eviction or an LRU cap.
2. **`api/signature/[id]` GET** — serves a signature image by UUID with no auth check. Signature
   images are low-sensitivity and the UUID is unguessable, but consider requiring a session (or
   signed URL) if this ever stores more sensitive imagery.

No High/Medium findings.
