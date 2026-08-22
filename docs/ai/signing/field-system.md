# Field System (Fillable Fields)

> Status: **Partially implemented** (declarative field registry + Choices field; value
> binding into the signed payload still pending)
> Created: 2026-08-23
> Repo: `diego-yason/pirma`
> Related:
> - `docs/ai/signing/form-fields.md` — feature design & roadmap (values storage, validation, payload
>   binding, PDF/A flattening)
> - `src/lib/client/types/field-tools.ts` — **the field tool registry** (single source of truth)
> - `src/lib/client/types/SignatureBoxTypes.d.ts` — `PlacedRect` / `FieldKind`
> - `src/lib/client/ui/PDFViewer.svelte` — box rendering + context menu (config-editor slot)
> - `src/lib/client/ui/field-configs/` — per-kind config editor components
> - `src/routes/(app)/doc/new/[packageId]/+page.svelte` — Step 2 "Recipients & Fields" tool UI
> - `src/routes/(app)/doc/new/[packageId]/+page.server.ts` — `syncRecipients` action (persistence)

## Overview

Every fillable field type is declared once, in a data-driven registry
(`src/lib/client/types/field-tools.ts`), and everything else — the tool buttons in Step 2,
the default box size/label, the design-mode accent/icon, and the per-kind config editor — is
derived from that registry. Adding a new field type is **purely additive** (see
[Adding a new field type](#adding-a-new-field-type)); there are no `kind ===` switches in the
shared render template.

Field definitions live on each document as `documents.placement_fields` (JSONB, an array of
`PlacedRect`). They are written by the Step 2 `syncRecipients` action, which stores the whole
box objects unchanged — so new properties persist with **no schema migration**.

## File map

| File | Role |
|---|---|
| `src/lib/client/types/SignatureBoxTypes.d.ts` | `PlacedRect` (a placed box) + `FieldKind` union |
| `src/lib/client/types/field-tools.ts` | `FIELD_TOOLS` registry + lookup helpers |
| `src/routes/(app)/doc/new/[packageId]/+page.svelte` | Step 2 tool UI: **Signature \| Text Field / Others ▾** |
| `src/lib/client/ui/PDFViewer.svelte` | places/renders boxes; context menu hosts the config editor |
| `src/lib/client/ui/field-configs/{kind}.svelte` | per-kind config editor (shown on right-click) |
| `src/routes/(app)/doc/new/[packageId]/+page.server.ts` | `syncRecipients` — persists boxes + recipients |

## Field kinds (currently implemented)

| kind | label | group | design accent | config editor |
|---|---|---|---|---|
| `signature` | Signature | `primary` | blue (default) | — |
| `text` | Text Field | `primary` | blue (default) | — |
| `choices` | Choices | `alternative` | amber + list icon | `field-configs/ChoicesConfig.svelte` |
| `phone` | Phone Number | `alternative` | blue (default) + phone icon | `field-configs/PhoneConfig.svelte` |
| `checkbox` | Checkbox | `alternative` | emerald + checkbox icon | `field-configs/CheckboxConfig.svelte` |
| `radio` | Radio | `alternative` | violet + radio icon | `field-configs/RadioConfig.svelte` |

`group: "primary"` tools get a dedicated button; `group: "alternative"` tools appear in the
**Others ▾** dropdown. (The user-facing concept for `choices` is a *list of choices*; it may be
rendered as a literal dropdown at signing time later — the registry field is `choices`, not
`dropdown`.)

> **Radio groups** — a `radio` box carries a group name on `PlacedRect.radioGroup`. Radios
> sharing the same group are mutually exclusive at signing time. The `RadioConfig` editor sets
> the group (with quick-pick chips for groups already used in the document) plus a per-option
> label; `CheckboxConfig` sets a label and `required`.

## The registry: `FieldToolDef`

```ts
export interface FieldToolDef {
    kind: FieldKind;                  // signature/text/choices/phone/checkbox/radio (extend FieldKind too)
    label: string;                    // button / box label
    icon: string;                     // 24×24 SVG path for the tool button
    group: "primary" | "alternative"; // button vs. Others ▾ dropdown
    width: number;                    // default box size when placed
    height: number;
    placeholderChoices?: string[];    // choices: seeded when the field is placed
    accent: FieldAccent;              // design-mode box styling (declarative)
    boxIcon?: string;                 // small SVG shown inside the placed box
    hasConfig?: boolean;              // whether a config editor exists for this kind
    validation?: FieldValidation;     // default validation rule (e.g. a phone regex) at signing time
}
```

Helpers: `fieldToolFor(kind)` (accepts `undefined | null`, falls back to the default tool),
`fieldLabelFor`, `fieldDefaultsFor`, `fieldMetaFor` (label + kind + seeded choices for a new box).

> **Example — Phone Number** (`kind: "phone"`) is exactly "a text field with a validator": it
> reuses the text default size, carries a `boxIcon` (phone glyph), a tiny `PhoneConfig` editor
> (a `required` toggle on `box.required`), and a `validation` rule
> (`^\+?[0-9\s().-]{7,20}$`) that the future sign-time input will enforce.

## Behavior slots (declarative)

The registry drives the box's *looks and config UI* with no template edits:

- **`accent`** — `{ box, text }` Tailwind classes for the design-mode border/bg and label color.
- **`boxIcon`** — small icon rendered inside the box (design + sign/view previews).
- **Config editor** — when `hasConfig: true`, `PDFViewer.svelte` renders
  `CONFIG_COMPONENTS[kind]` in the right-click context menu. Drop a component at
  `src/lib/client/ui/field-configs/{kind}.svelte` and register it in `CONFIG_COMPONENTS`.

Config editor component API (see `field-configs/ChoicesConfig.svelte`):

```ts
let { box, boxes = [], onchange }: {
    box: PlacedRect;                // mutate in place — reactive, shared with the document
    boxes?: PlacedRect[];           // all placed boxes (e.g. for radio-group suggestions)
    onchange: (box: PlacedRect) => void; // call after each change to trigger the parent sync
} = $props();
```

- **Sign input (future)** — the design reserves a per-kind interactive widget slot at
  `src/lib/client/ui/field-inputs/{kind}.svelte` for when sign-time value collection lands
  (see `docs/ai/signing/form-fields.md`).

## How a field flows through the app

1. **Step 2 tool selection** — the UI renders `FIELD_TOOLS`: `Signature` (full-height button),
   `Text Field` (button), and `Others ▾` (dropdown of `group: "alternative"` kinds).
2. **Placement** — `PDFViewer`'s draw handler builds a `PlacedRect` via
   `fieldDefaultsFor(tool)` + `fieldMetaFor(tool)` (size, label, kind, seeded choices).
3. **Persistence** — the client `syncToServer` → `syncRecipients` action writes
   `placementFields` (JSONB) to `documents.placement_fields` for the selected document.
4. **Config editing** — right-click a box → context menu renders the per-kind config component;
   edits call `onchange(box)` → `onmove` → `triggerSync` → `syncRecipients`.
5. **Sign / view rendering** — the box is drawn with its registry `accent`/`boxIcon`; Choices
   shows a list-style preview. (Interactive value widgets are the pending piece.)

## Adding a new field type

1. **Extend `FieldKind`** in `src/lib/client/types/SignatureBoxTypes.d.ts`
   (e.g. `"checkbox"`, `"date"`, `"initials"`).
2. **Add a `FieldToolDef`** to `FIELD_TOOLS` in `field-tools.ts`
   (`group: "alternative"` → Others ▾ dropdown; `group: "primary"` → its own button). Commented
   examples for checkbox/date/initials are already in the file.
3. **Optional behavior slots** (no `PDFViewer` template changes):
   - design accent + in-box icon → set `accent` / `boxIcon`;
   - config editor → create `field-configs/{kind}.svelte` + add it to `CONFIG_COMPONENTS`;
   - sign-time input (later) → create `field-inputs/{kind}.svelte`.

The field then appears in the UI, places with the right size/label, gets the right accent/icon,
and persists automatically.

## Current limitations / next steps

> ✅ **Implemented 2026-08-23:** sign-time value collection + validation + payload binding.
> Value widgets render in sign mode (text/phone input, choices select, checkbox toggle, radio
> group), `finalize` validates and stores values on `signatures.field_values` (column added to
> the runtime schema), and their hash is bound into the signed payload (`canonicalFieldValues`
> + `sha256Hex` in `signing-payload.ts`). The **signature payload compliance target is PAdES**
> (embedded PAdES-BASELINE-T in the PDF/A artifact, see
> `docs/ai/pdfa/pades-baseline-t-spec.md`). **Option B (2026-08-23): PAdES replaces the custom
> text payload** — values are flattened into the artifact, so the PAdES ByteRange digest covers
> them; no detached ECDSA. Remaining: PDF/A flattening + `date`/`initials` kinds.

- Implemented kinds: `signature`, `text`, `choices`, `phone`, `checkbox`, `radio`; date/initials are planned.
