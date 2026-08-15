# Fillable Form Fields

> Status: **Draft — design, not implemented**
> Created: 2026-08-16
> Repo: `diego-yason/pirma`
> Related:
> - `docs/ai/roadmap.md` §8.1 (form fields)
> - `docs/ai/keys/recommendations.md` §9 (signing payload strengthening)
> - `docs/ai/pdfa/pdfa-compliance.md` Phase 2 (flattening)
> - `src/lib/client/types/SignatureBoxTypes.d.ts` (`PlacedRect`)
> - `src/routes/(app)/doc/[pageId]/sign/+page.server.ts`, `+page.svelte`

## Purpose

Today `placementFields` are **signature boxes only** (`PlacedRect`). This adds fillable fields
so signers can enter data (initials, date, text, checkbox, dropdown) that is validated, stored,
**bound into the signed payload**, and flattened into the final PDF/A artifact.

## Field model

Extend `PlacedRect` with a kind + per-type config (existing boxes default to `kind:
"signature"`, so no breakage):

```ts
type FieldKind = "signature" | "initials" | "date" | "text" | "checkbox" | "dropdown";

interface PlacementField extends PlacedRect {
    kind: FieldKind;
    required?: boolean;          // must be filled before finalize
    placeholder?: string;        // text / date
    format?: string;             // date: "yyyy-MM-dd"; text: format hint
    maxLength?: number;          // text
    options?: string[];          // dropdown (single-select)
    defaultValue?: string | boolean;
}
```

| kind | Input | Stored value |
|---|---|---|
| `signature` (existing) | signature image | `{ imageStoragePath }` |
| `initials` | initials image (new) | `{ imageStoragePath }` |
| `date` | calendar picker | ISO date string |
| `text` | single-line input | string |
| `checkbox` | toggle | boolean |
| `dropdown` | options list | selected option string |

## Values storage

- Field **definitions** (kind + config) stay in `documents.placementFields` (richer objects;
  add a `fieldVersion` marker for migration if desired).
- Field **values** per signer per document → new `signatures.fieldValues: jsonb`:

  ```jsonc
  {
    "field_abc": { "kind": "text",   "value": "Jane Doe" },
    "field_def": { "kind": "date",   "value": "2026-08-16" },
    "field_ghi": { "kind": "checkbox","value": true },
    "field_jkl": { "kind": "dropdown","value": "Option 2" },
    "field_mno": { "kind": "initials","imageStoragePath": "signatures/…" }
  }
  ```

- **Initials** need a new `user_signatures.type` enum (`signature` | `initials`) and the
  SignatureCreator UI to produce/select them.

## Validation (server-side, in `finalize`)

1. Only fields **assigned to the signer** can be submitted (same ownership rule as signatures).
2. `required` fields must have a value — reject otherwise.
3. Type checks: date parses, `maxLength` respected, dropdown value ∈ `options`, checkbox is
   boolean, text/initials non-empty.
4. Unknown/extra field IDs rejected (mirrors the existing `sigFieldDoc` check).

## Signing payload (critical)

The existing payload is `"${documentHash}:${fieldCount}"`. With form values, a signer could
change a text/date/checkbox **after** signing without detection. So **values must be bound into
what is signed**:

```
payload = "${documentHash}:${fieldCount}:${sha256(canonicalJson(fieldValues))}"
```

- This is the payload-strengthening already flagged in `keys/recommendations.md` §9; the
  `fieldValues` hash is the additive piece for form fields.
- Server recomputes the same payload from stored `fieldValues` and verifies.

## Rendering & flattening

- `PDFViewer.svelte` overlays become per-kind widgets (input/date/checkbox/dropdown/initials
  stamp) positioned at each rect, editable by the assigned signer before `finalize`.
- PDF/A Phase 2 flattening burns values into the artifact: draw text/date/dropdown, draw the
  checkbox checked state, stamp signature/initials images — then re-run the PDF/A pass.

## Schema changes (via `drizzle-kit generate`)

- `documents.placementFields` — richer objects (no column change; optional `fieldVersion`).
- `signatures.fieldValues` — new `jsonb` column (nullable).
- `user_signatures.type` — new `enum("signature" | "initials")` default `"signature"`.

## Open decisions

1. **v1 field set** — ship all six, or start with `initials` + `text` + `date` (recommended) and
   add `checkbox`/`dropdown` after?
2. **Value binding** — confirm values are part of the signed payload (recommended; it changes
   `buildSigningPayload` and the payload hash spec).
3. Validation strictness — required + type only (default) vs. custom formats (`format`).
4. Whether non-signature fields must be "signed" too, or only require the signature fields
   (recommended: all required fields + at least one signature).
