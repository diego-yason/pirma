# O3 — Independent Long-Term Verifiability (PDF/A + Anchoring) — Blockers

> **Objective (O3 — see `../core-objectives.md`):** produce artifacts that anyone
> can verify against standards and an immutable, independent trail — PDF/A
> conformance + PAdES + on-chain anchoring.
>
> **Status legend:** 🔴 blocking · 🟡 partial / affects quality · 🟢 context / not blocking
> **Created:** 2026-08-23 · **Repo:** `diego-yason/pirma` · **Branch:** `dev`

---

## 1. Current state

Entirely **planned (🔲)** — specs exist (`blockchain/blockchain-integration.md`,
`pdfa/*`) but nothing is built. `signatures.status` never reaches `anchored`;
`documents.hash` is the raw-upload hash, not an artifact hash.

## 2. Blockers

| # | Blocker | Type | Impact | Status | Unblock path |
|---|---|---|---|---|---|
| B1 | **PDF/A ingestion (Phase 1) not built** — no conversion of PDF/DOCX/JPG/PNG → PDF/A-2b. | Feature (ingestion) | Foundation for everything below; non-PDF uploads aren't even renderable today. | 🔴 | Convert at upload (mupdf/Ghostscript) or defer to the document microservice. |
| B2 | **Signed artifact generation (Phase 2) not built** — no flatten + XMP + re-convert. | Feature (artifact) | No signed PDF artifact exists (only DB rows). | 🔴 | Flatten signature images + field values; re-convert to PDF/A; store artifact + hash. |
| B3 | **Blockchain anchoring unimplemented** — `signature_anchors` + anchor client + auto-anchor by **artifact hash** + `signed → anchored` all absent. | Feature (verification) | No independent on-chain proof; `executed` happens without it. | 🔴 | Build `signature_anchors`, anchor client, state machine (roadmap §2). |
| B4 | **PAdES embedding (Phase 3) not built** — shared with O1/B5. | Feature (compliance) | The objective's compliance end-state is unreached. | 🟡 | After artifact generation (B2), build cert/CMS/TSA + two-step finalize. |
| B5 | **Verification (Phase 4) not built** — veraPDF/pdfcpu + PAdES + anchor checks. | Feature (verification) | No independent verify path for artifacts. | 🟡 | Add `/verify` (or stored validation results) once artifacts exist. |
| B6 | **PQC Merkle-root anchoring** (supplementary) not started. | Feature (crypto) | Long-term post-quantum hardening. | 🟢 | Additive after B3; see `blockchain/pqc-post-quantum.md`. |

## 3. Not blockers (decisions / separate track)

- On-chain data minimization (hashes only) — already decided.
- Anchor granularity decision (per-document vs. per-signature) — pending, not blocking.

## 4. Suggested order

1. **B1** — ingestion conversion (foundation).
2. **B2** — artifact generation (the real "signed document").
3. **B3** — anchoring (can run in parallel once artifact hash exists).
4. **B4** — PAdES (with O1).
5. **B5** — verification · **B6** — PQC (backlog).

> Related: `docs/ai/roadmap.md` §2/§3 · `docs/ai/blockchain/blockchain-integration.md` ·
> `docs/ai/pdfa/pdfa-compliance.md` · `docs/ai/pdfa/pades-baseline-t-spec.md` ·
> `docs/ai/blockchain/pqc-post-quantum.md`
