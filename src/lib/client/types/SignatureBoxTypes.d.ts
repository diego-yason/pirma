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
}

export interface RecipientInfo {
    id: string;
    name: string;
    personNum: number;
}
