/** The kind of fillable field a placed box represents. */
export type FieldKind = "signature" | "text" | "choices" | "phone";

/** A validation rule a text-like field's value must satisfy at signing time. */
export interface FieldValidation {
    /** RegExp source (without delimiters) the value must fully match. */
    pattern: string;
    /** User-facing error message shown when the value is invalid. */
    message: string;
    /** Placeholder / example hint shown to the signer. */
    hint?: string;
}

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
}

export interface RecipientInfo {
    id: string;
    name: string;
    personNum: number;
}
