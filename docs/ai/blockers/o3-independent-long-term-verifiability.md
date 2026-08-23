# O3 — Independent Long-Term Verifiability (PDF/A + Anchoring) — Blockers

> **Objective (O3 — see `../core-objectives.md`):** produce artifacts that anyone
> can verify against standards and an immutable, independent trail — PDF/A
> conformance + PAdES + on-chain anchoring.
>
> **Status legend:** 🔴 blocking · 🟡 partial / affects quality · 🟢 context / not blocking
> **Created:** 2026-08-23 · **Repo:** `diego-yason/pirma` · **Branch:** `dev`

---

## 1. Current state

Mostly **planned (🔲)** — specs exist (`blockchain/blockchain-integration.md`, `pdfa/*`).
Partial: JPG/PNG uploads are converted to a single-page PDF at ingest
(`src/lib/server/ingest/convert-to-pdf.ts`); signed artifacts are now **flattened and stored**
on execute (O3-B2, `src/lib/server/artifacts/`). Remaining: PDF/A-2b conformance (both phases),
DOCX conversion, XMP metadata, PAdES, and anchoring.

## 2. Blockers

| # | Blocker | Type | Impact | Status | Unblock path |
|---|---|---|---|---|---|
| B1 | **PDF/A ingestion (Phase 1) partially built** — JPG/PNG are converted to a single-page PDF at upload (pdf-lib), but full PDF/A-2b conformance and DOCX → PDF aren't done. | Feature (ingestion) | Non-PDF uploads now render/sign; PDF/A-2b conformance + DOCX remain. | 🟡 | Add PDF/A-2b conformance (mupdf WASM / Ghostscript or microservice) and DOCX → PDF (LibreOffice/microservice). |
| B2 | **Signed artifact generation (Phase 2) mostly built** — flatten implemented (`flatten-pdf.ts`), orchestration + storage + artifact hash wired into `finalize` (`generate-artifact.ts`, `artifacts` bucket, `documents.artifactStoragePath/artifactHash`). XMP metadata + PDF/A re-pass remain. | Feature (artifact) | A flattened signed artifact now exists per executed document. | 🟡 | Add XMP/document-info (signer names, `SignedAt`) + PDF/A re-pass (mupdf/Ghostscript) after flattening. |
| B3 | **Blockchain anchoring unimplemented** — `signature_anchors` + anchor client + auto-anchor by **artifact hash** + `signed → anchored` all absent. | Feature (verification) | No independent on-chain proof; `executed` happens without it. | 🔴 | Build `signature_anchors`, anchor client, state machine (roadmap §2). |
| B4 | **PAdES embedding (Phase 3) not built** — shared with O1/B5. | Feature (compliance) | The objective's compliance end-state is unreached. | 🟡 | After artifact generation (B2), build cert/CMS/TSA + two-step finalize. |
| B5 | **Verification (Phase 4) not built** — veraPDF/pdfcpu + PAdES + anchor checks. | Feature (verification) | No independent verify path for artifacts. | 🟡 | Add `/verify` (or stored validation results) once artifacts exist. |
| B6 | **PQC Merkle-root anchoring** (supplementary) not started. | Feature (crypto) | Long-term post-quantum hardening. | 🟢 | Additive after B3; see `blockchain/pqc-post-quantum.md`. |

## 3. Not blockers (decisions / separate track)

- On-chain data minimization (hashes only) — already decided.
- Anchor granularity decision (per-document vs. per-signature) — pending, not blocking.

## 4. Suggested order

1. **B1** — ingestion conversion (foundation): ✅ JPG/PNG → PDF done (pdf-lib); remaining: PDF/A-2b conformance + DOCX.
2. **B2** — artifact generation (the real "signed document"): ✅ flatten + store + hash done; remaining: XMP metadata + PDF/A re-pass.
3. **B3** — anchoring (can run in parallel once artifact hash exists).
4. **B4** — PAdES (with O1).
5. **B5** — verification · **B6** — PQC (backlog).

> Related: `docs/ai/roadmap.md` §2/§3 · `docs/ai/blockchain/blockchain-integration.md` ·
> `docs/ai/pdfa/pdfa-compliance.md` · `docs/ai/pdfa/pades-baseline-t-spec.md` ·
> `docs/ai/blockchain/pqc-post-quantum.md`
