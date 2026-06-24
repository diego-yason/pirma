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
}
