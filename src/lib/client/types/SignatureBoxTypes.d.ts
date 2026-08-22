/** The kind of fillable field a placed box represents. */
export type FieldKind = "signature" | "text" | "choices" | "phone" | "checkbox" | "radio";

/** A validation rule a text-like field's value must satisfy at signing time. */
export interface FieldValidation {
    /** RegExp source (without delimiters) the value must fully match. */
    pattern: string;
    /** User-facing error message shown when the value is invalid. */
    message: string;
    /** Placeholder / example hint shown to the signer. */
    hint?: string;
}

/**
 * A single field's submitted value. `radio` stores the id of the checked radio
 * box; `checkbox` stores a boolean; text/phone/choices store a string.
 */
export interface FieldValue {
    kind: FieldKind;
    value: string | boolean;
}

/** Submitted field values keyed by field (box) id. */
export type FieldValues = Record<string, FieldValue>;

export interface PlacedRect {
    id: string;
    page: number;
    /** center x in px (at 2x scale) */
    x: number;
    /** center y in px (at 2x scale) */
    y: number;
    width: number;
    height: number;
    label?: string;
    /** recipient ID this box is assigned to, or "me" for the current user */
    assignedTo?: string;
    /** field type; defaults to "signature" for legacy boxes */
    kind?: FieldKind;
    /** choices: the list of options the signer can pick from */
    choices?: string[];
    /** text-like fields: whether the signer must fill this in before finalize */
    required?: boolean;
    /** radio: the group this option belongs to — radios in the same group are mutually exclusive */
    radioGroup?: string;
    /** Validation rule carried on the box (seeded from the registry at placement). */
    validation?: FieldValidation;
}

export interface RecipientInfo {
    id: string;
    name: string;
    personNum: number;
}
