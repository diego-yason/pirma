# Signing UX — Guided Ceremony & Accessibility

> Status: **Draft — design, not implemented**
> Created: 2026-08-16
> Repo: `diego-yason/pirma`
> Related:
> - `docs/ai/roadmap.md` §8.2
> - `src/routes/(app)/doc/[pageId]/sign/+page.svelte`, `src/lib/client/ui/PDFViewer.svelte`
> - `docs/ai/form-fields.md` (per-kind field widgets)

## 1. Guided signing ceremony

Goal: move from a flat list of overlay fields to a guided, field-by-field signing experience.

**Design**
- **Ordered field list**: the signer's assigned fields (signature/initials/form fields) ordered
  by document + page + position.
- **Current-field highlighting**: the PDF viewer scrolls to and highlights the active field
  (matching rect); completing it advances to the next.
- **Completion checklist**: a side panel shows each field + its status (pending / filled /
  signed), so the signer knows what's left and what's required.
- **Finish gate**: `finalize` only enabled when all `required` fields have values and at least
  one signature is placed (ties to `form-fields.md`).
- Reuses the existing overlay (field widgets, signature draw/upload/type) — this is primarily
  a navigation/sequencing layer on top.

## 2. Mobile & accessibility (WCAG)

- **Responsive**: the signing flow must work on small screens (touch targets ≥44px, no
  hover-only interactions, pinch-zoom preserved).
- **Keyboard**: every field focusable + operable via keyboard; Enter/Tab advances fields.
- **Contrast/labels**: fields have accessible labels (already partially via `label`);
  `aria-required` on required fields; visible focus states.
- **Reduced motion**: disable scroll/highlight animations when `prefers-reduced-motion`.
- **A11y check**: run the existing Storybook a11y addon on the sign page.

**Open decisions**
1. Ceremony granularity — one field at a time (wizard) vs. highlighted-in-place (recommended:
   highlighted-in-place keeps the PDF context).
2. WCAG target — AA (recommended) vs. AAA.
3. Whether the guided view is on by default or a toggle.
