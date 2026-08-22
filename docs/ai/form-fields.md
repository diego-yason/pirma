# Fillable Form Fields

> Status: **Partially implemented** — declarative field system + Choices field are live;
> sign-time value collection + payload binding still pending
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
tool UI, design-mode rendering (accent + icon per kind), per-kind config editors, and JSONB
persistence. Fields can be placed, assigned, sized and configured on the document.

**Not yet implemented:** collecting the signer's value at signing time and binding it into the
signed payload (see [Values storage](#values-storage) and
[Signing payload](#signing-payload-critical--pending) below).

## Field model

Every placed box is a `PlacedRect` with a `kind` and, for choice fields, a `choices` list
(legacy boxes default to `kind: "signature"`, so there's no breakage):

```ts
type FieldKind = "signature" | "text" | "choices" | "phone";  // planned: "checkbox" | "date" | "initials"

interface PlacementField extends PlacedRect {
    kind: FieldKind;
    choices?: string[];   // choices field: the list the signer picks from
    required?: boolean;   // text-like fields: must be filled before finalize
    // future per-type config (design only): placeholder?, format?, maxLength?, defaultValue?
}
```

| kind | Design (implemented) | Sign-time input (planned) | Stored value (planned) |
|---|---|---|---|
| `signature` (existing) | signature box | signature image | `{ imageStoragePath }` |
| `text` | text box | single-line input | string |
| `choices` | choice-list box (amber + list icon) | select / dropdown / radio | selected choice string |
| `phone` | text box + phone icon (validated) | phone input w/ validator | string |
| `checkbox` (planned) | — | toggle | boolean |
| `date` (planned) | — | calendar picker | ISO date string |
| `initials` (planned) | — | initials image | `{ imageStoragePath }` |

> Originally specced as `dropdown` with `options?: string[]`. Renamed to **`choices`** with
> `choices?: string[]` — the user-facing concept is a *list of choices*, which may be rendered
> as a literal dropdown later. `docs/ai/field-system.md` documents the registry.

## Values storage

- Field **definitions** (kind + config) stay in `documents.placementFields` (`placement_fields`,
  JSONB) — already implemented; richer objects persist without a schema change.
- Field **values** per signer per document → new `signatures.fieldValues: jsonb` (**pending**):

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

## Validation (server-side, in `finalize`) — pending

1. Only fields **assigned to the signer** can be submitted (same ownership rule as signatures).
2. `required` fields must have a value — reject otherwise.
3. Type checks: date parses, `maxLength` respected, choices value ∈ `choices`, checkbox is
   boolean, text/initials non-empty.
4. Unknown/extra field IDs rejected (mirrors the existing `sigFieldDoc` check).

## Signing payload (critical) — pending

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

- Design mode (implemented): `PDFViewer.svelte` overlays render per-kind (accent + box icon from
  the field registry) and host per-kind config editors in the context menu.
- Sign mode (pending): overlays become per-kind input widgets (input/date/checkbox/choices/
  initials stamp) positioned at each rect, editable by the assigned signer before `finalize`.
- PDF/A Phase 2 flattening (pending) burns values into the artifact: draw text/date/choices,
  draw the checkbox checked state, stamp signature/initials images — then re-run the PDF/A pass.

## Schema changes (via `drizzle-kit generate`) — pending

- `documents.placementFields` — richer objects (no column change; already works).
- `signatures.field_values` — new `jsonb` column (nullable).
- `user_signatures.type` — new `enum("signature" | "initials")` default `"signature"`.

## Open decisions

1. **v1 field set** — `text` + `choices` are implemented; ship `checkbox`/`date`/`initials` next
   (all easy via the registry, see `docs/ai/field-system.md`).
2. **Value binding** — confirm values are part of the signed payload (recommended; it changes
   `buildSigningPayload` and the payload hash spec).
3. Validation strictness — required + type only (default) vs. custom formats (`format`).
4. Whether non-signature fields must be "signed" too, or only require the signature fields
   (recommended: all required fields + at least one signature).

