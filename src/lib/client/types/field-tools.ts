import type { FieldKind, FieldValidation } from "./SignatureBoxTypes";

/** Design-mode box styling for a field kind. */
export interface FieldAccent {
    /** Border + background classes for the box in design mode. */
    box: string;
    /** Label text color classes for the box in design mode. */
    text: string;
}

/** Default (signature) accent — blue. */
export const DEFAULT_ACCENT: FieldAccent = {
    box: "border-blue-500 bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-300",
};

/**
 * Standardized definition for every field tool (Signature, Text Field, Choices,
 * and future kinds like checkbox, date, initials…). Everything the UI needs to
 * render, place, style and configure a field is declared here — so adding a new
 * field type is purely additive:
 *
 *   1. Extend `FieldKind` in `SignatureBoxTypes.d.ts` (e.g. `"checkbox"`).
 *   2. Add a `FieldToolDef` to `FIELD_TOOLS` below
 *      (`group: "alternative"` → shows in the "Others" dropdown;
 *       `group: "primary"`   → shows as its own button in Field Tools).
 *   3. Optional behavior slots (both data-driven, no edits to the shared
 *      render template in `PDFViewer.svelte`):
 *      - a config editor component in `src/lib/client/ui/field-configs/{kind}.svelte`
 *        (rendered automatically in the context menu when `hasConfig: true`),
 *      - a sign-time input component in `src/lib/client/ui/field-inputs/{kind}.svelte`
 *        (rendered automatically for the signer).
 */
export interface FieldToolDef {
    /** The field kind this tool produces. */
    kind: FieldKind;
    /** Button / box label shown to the user. */
    label: string;
    /** 24×24 SVG path used for the tool button icon. */
    icon: string;
    /** "primary" tools get a dedicated button; "alternative" go in the Others dropdown. */
    group: "primary" | "alternative";
    /** Default box size when the field is placed on the document. */
    width: number;
    height: number;
    /** choices fields: placeholder choices seeded when the field is placed. */
    placeholderChoices?: string[];
    /** Design-mode box accent (defaults to the signature blue). */
    accent: FieldAccent;
    /** Small icon shown inside the placed box (e.g. a list icon for Choices). */
    boxIcon?: string;
    /** Whether this kind has a config editor (rendered in the context menu). */
    hasConfig?: boolean;
    /**
     * Default validation rule (e.g. a phone-number regex) enforced at signing time.
     * Signers enter values in per-kind widgets, `finalize` validates against this
     * pattern and stores values on `signatures.field_values`, and their hash is
     * bound into the signed payload. See docs/ai/form-fields.md.
     */
    validation?: FieldValidation;
}

export const FIELD_TOOLS: FieldToolDef[] = [
    {
        kind: "signature",
        label: "Signature",
        group: "primary",
        icon: "M3 17c3.5-2 6-2.5 8-2.5 2 0 2.5 1 5 .5 2-.4 4-2 4-2m-9 3.5c2.5 0 3.5 1.5 6 1.5 1.5 0 3-.5 3-.5",
        width: 200,
        height: 60,
        accent: DEFAULT_ACCENT,
    },
    {
        kind: "text",
        label: "Text Field",
        group: "primary",
        icon: "M4 6h16M4 12h16M4 18h10",
        width: 200,
        height: 40,
        accent: DEFAULT_ACCENT,
    },
    {
        kind: "choices",
        label: "Choices",
        group: "alternative",
        icon: "M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
        width: 220,
        height: 60,
        accent: {
            box: "border-amber-500 bg-amber-500/10",
            text: "text-amber-700 dark:text-amber-300",
        },
        boxIcon: "M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
        placeholderChoices: ["Option 1", "Option 2", "Option 3"],
        hasConfig: true,
    },
    {
        // Phone Number — essentially a text field with a validator.
        kind: "phone",
        label: "Phone Number",
        group: "alternative",
        icon: "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z",
        width: 220,
        height: 40,
        accent: DEFAULT_ACCENT,
        boxIcon: "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z",
        hasConfig: true,
        validation: {
            pattern: "^\\+?[0-9\\s().-]{7,20}$",
            message: "Enter a valid phone number",
            hint: "+1 (555) 000-0000",
        },
    },
    {
        // Checkbox — a boolean toggle the signer ticks.
        kind: "checkbox",
        label: "Checkbox",
        group: "alternative",
        icon: "M3.75 5.25h16.5v13.5H3.75zM8 11l2.5 2.5L16 8",
        width: 32,
        height: 32,
        accent: {
            box: "border-emerald-500 bg-emerald-500/10",
            text: "text-emerald-700 dark:text-emerald-300",
        },
        boxIcon: "M3.75 5.25h16.5v13.5H3.75zM8 11l2.5 2.5L16 8",
        hasConfig: true,
    },
    {
        // Radio — a single choice from a group; radios sharing a `radioGroup`
        // are mutually exclusive at signing time.
        kind: "radio",
        label: "Radio",
        group: "alternative",
        icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z",
        width: 32,
        height: 32,
        accent: {
            box: "border-violet-500 bg-violet-500/10",
            text: "text-violet-700 dark:text-violet-300",
        },
        boxIcon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z",
        hasConfig: true,
    },
    // ── Future field types ─────────────────────────────────────────
    // Fully declarative: add the kind + this entry, then drop optional
    // `field-configs/{kind}.svelte` / `field-inputs/{kind}.svelte`
    // components for the config/behavior slots. No PDFViewer edits needed.
    // {
    //     kind: "date",
    //     label: "Date",
    //     group: "alternative",
    //     icon: "M6.75 3v2.25M17.25 3v2.25M3 9.75h18M5.25 6h13.5A2.25 2.25 0 0 1 21 8.25v10.5A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6Z",
    //     width: 120,
    //     height: 40,
    //     accent: DEFAULT_ACCENT,
    //     boxIcon: "M6.75 3v2.25M17.25 3v2.25M3 9.75h18M5.25 6h13.5A2.25 2.25 0 0 1 21 8.25v10.5A2.25 2.25 0 0 1 18.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6Z",
    //     hasConfig: true,
    // },
    // {
    //     kind: "initials",
    //     label: "Initials",
    //     group: "alternative",
    //     icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9 9.5h6M9 14h4",
    //     width: 120,
    //     height: 48,
    //     accent: DEFAULT_ACCENT,
    // },
];

/** The field kind placed by default when no tool is selected. */
export const DEFAULT_FIELD_KIND: FieldKind = "signature";

/** Look up a tool definition by kind (falls back to the default tool). */
export function fieldToolFor(kind: FieldKind | undefined | null): FieldToolDef {
    return FIELD_TOOLS.find((t) => t.kind === kind) ?? FIELD_TOOLS[0];
}

/** Human-readable label for a field kind (or its placed box). */
export function fieldLabelFor(kind: FieldKind | undefined | null): string {
    return fieldToolFor(kind).label;
}

/** Default box size for a field kind. */
export function fieldDefaultsFor(kind: FieldKind | undefined | null): {
    width: number;
    height: number;
} {
    const def = fieldToolFor(kind);
    return { width: def.width, height: def.height };
}

/** Label + kind + seeded choices + validation for a newly placed field. */
export function fieldMetaFor(kind: FieldKind | undefined | null): {
    label: string;
    kind: FieldKind;
    choices?: string[];
    validation?: FieldValidation;
} {
    const def = fieldToolFor(kind);
    return {
        label: def.label,
        kind: def.kind,
        choices: def.placeholderChoices ? [...def.placeholderChoices] : undefined,
        validation: def.validation ? { ...def.validation } : undefined,
    };
}
