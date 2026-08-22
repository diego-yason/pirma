# Fillable Form Fields

> Status: **Partially implemented** — declarative field system + sign-time value collection
> (validated, stored, and bound into the signed payload) are live; PDF/A flattening + more
> kinds still pending
> Created: 2026-08-16 (updated 2026-08-23)
> Repo: `diego-yason/pirma`
> Related:
> - `docs/ai/field-system.md` — **implemented architecture** + how to add a field type
> - `docs/ai/roadmap.md` §8.1 (form fields)
> - `docs/ai/keys/recommendations.md` §9 (signing payload strengthening)
> - `docs/ai/pdfa/pdfa-compliance.md` Phase 2 (flattening)
> - `src/lib/client/types/SignatureBoxTypes.d.ts` (`PlacedRect`, `FieldKind`)
> - `src/lib/client/types/field-tools.ts` (field tool registry)
> - `src/routes/(app)/doc/[pageId]/sign/+page.server.ts`, `+page.svelte`

## Purpose

Fillable fields let signers enter data (text, a list of choices, and later initials, date,
checkbox…) that is validated, stored, **bound into the signed payload**, and flattened into the
final PDF/A artifact.

**Implemented today:** a declarative field system — a data-driven field registry, the Step 2
 tool UI, design-mode rendering (accent + icon per kind), per-kind config editors, JSONB
 persistence, and **sign-time value collection**: the signer fills text/phone/choices/
 checkbox/radio widgets, values are validated in `finalize`, stored on `signatures.field_values`,
 and their hash is bound into the signed payload.

**Not yet implemented:** PDF/A flattening (burning values into the artifact) and the remaining
 kinds (`date`, `initials`).
## Field model

Every placed box is a `PlacedRect` with a `kind` and, for choice fields, a `choices` list
(legacy boxes default to `kind: "signature"`, so there's no breakage):

```ts
type FieldKind = "signature" | "text" | "choices" | "phone" | "checkbox" | "radio";  // planned: "date" | "initials"

interface PlacementField extends PlacedRect {
    kind: FieldKind;
    choices?: string[];   // choices field: the list the signer picks from
    required?: boolean;   // text-like fields: must be filled before finalize
    // future per-type config (design only): placeholder?, format?, maxLength?, defaultValue?
}
```

| kind | Design (implemented) | Sign-time input (implemented) | Stored value (implemented) |
|---|---|---|---|
| `signature` (existing) | signature box | signature image | `{ imageStoragePath }` |
| `text` | text box | single-line input | string |
| `choices` | choice-list box (amber + list icon) | select / dropdown / radio | selected choice string |
| `phone` | text box + phone icon (validated) | phone input w/ validator | string |
| `checkbox` | checkbox box (emerald) | toggle | boolean |
| `radio` | radio box (violet, group-aware) | mutually exclusive radio group | selected choice string |
| `date` (planned) | — | calendar picker | ISO date string |
| `initials` (planned) | — | initials image | `{ imageStoragePath }` |

> Originally specced as `dropdown` with `options?: string[]`. Renamed to **`choices`** with
> `choices?: string[]` — the user-facing concept is a *list of choices*, which may be rendered
> as a literal dropdown later. `docs/ai/field-system.md` documents the registry.

## Values storage

- Field **definitions** (kind + config) stay in `documents.placementFields` (`placement_fields`,
  JSONB) — already implemented; richer objects persist without a schema change.
- Field **values** per signer per document → `signatures.field_values` (JSONB, column added to
  the runtime schema — migration to be generated/applied). Stored value semantics:
  `text`/`phone`/`choices` → string (typed / selected value), `radio` → the id of the checked
  radio box, `checkbox` → boolean:

  ```jsonc
  {
    "field_abc": { "kind": "text",    "value": "Jane Doe" },
    "field_def": { "kind": "date",    "value": "2026-08-16" },
    "field_ghi": { "kind": "checkbox", "value": true },
    "field_jkl": { "kind": "choices", "value": "Option 2" },
    "field_mno": { "kind": "initials", "imageStoragePath": "signatures/…" }
  }
  ```

- **Initials** (planned) need a new `user_signatures.type` enum (`signature` | `initials`) and a
  SignatureCreator flow to produce/select them.

## Validation (server-side, in `finalize`) — implemented

1. Only fields **assigned to the signer** can be submitted (same ownership rule as signatures).
2. `required` value fields must have a value — rejected otherwise.
3. Per-kind checks: `choices` value ∈ `choices`; `checkbox` is boolean; `radio` references a
   radio box in the same `radioGroup`; `phone` matches its `validation.pattern`.
4. Unknown/extra field IDs rejected (mirrors the existing `sigFieldDoc` check).

## Signing payload (critical) — implemented

The payload binds the package, document, document hash, sorted signed field ids, signer, and a
hash of the document's submitted field values — so a signer can't change fillable data after
signing without detection.

```
payload = "${packageId}:${documentId}:${documentHash}:${sortedFieldIds}:${signerUserId}:${sha256(canonicalFieldValues(fieldValues))}"
```

- Implemented in `src/lib/shared/signing-payload.ts` (`canonicalFieldValues` + `sha256Hex`);
  the client signs it and the server recomputes it from the submitted values and verifies.
- This is the payload-strengthening flagged in `keys/recommendations.md` §9.
- **Compliance requirement: the signature payload is PAdES-compliant.** The electronic
  signature must be an embedded **PAdES-BASELINE-T** (ETSI EN 319 142-1) signature in the PDF/A
  artifact. **Decision (Option B, 2026-08-23): PAdES replaces the custom text payload above
  entirely** — no detached ECDSA is produced for new documents; the values it bound are
  flattened into the artifact, so the PAdES ByteRange digest covers them. See
  `docs/ai/pdfa/pades-baseline-t-spec.md`.

## Rendering & flattening

- Design mode (implemented): `PDFViewer.svelte` overlays render per-kind (accent + box icon from
  the field registry) and host per-kind config editors in the context menu.
- Sign mode (implemented): overlays render per-kind input widgets (text/phone input, choices
  select, checkbox toggle, radio group) positioned at each rect, editable by the assigned
  signer before `finalize`.
- PDF/A Phase 2 flattening (pending) burns values into the artifact: draw text/date/choices,
  draw the checkbox checked state, stamp signature/initials images — then re-run the PDF/A pass.

## Schema changes

- `documents.placementFields` — richer objects (no column change; works).
- `signatures.field_values` — **new `jsonb` column** (added to the runtime schema; migration
  pending). ✅
- `user_signatures.type` — planned `enum("signature" | "initials")` for the initials kind.

## Open decisions

1. **v1 field set** — `text`, `choices`, `phone`, `checkbox`, `radio` implemented; ship
   `date`/`initials` next (easy via the registry, see `docs/ai/field-system.md`).
2. **Value binding** — ✅ done: the field-values hash is part of the signed payload.
3. Validation strictness — required + type (done) vs. custom formats (`format`) if needed.
4. Model: value fields are filled, signature fields are signed; at least one signature per
   document (values-only packages without a signature aren't supported yet).

