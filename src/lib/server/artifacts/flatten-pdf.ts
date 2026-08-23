import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

/**
 * Render instructions for one placed field, in the coordinate space used by the
 * placement system: `x`/`y` are the rect CENTER in canvas units (pdfjs viewport
 * at `CANVAS_SCALE`), `page` is 0-based.
 */
export interface FlattenRender {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    kind: "signature" | "text" | "phone" | "choices" | "checkbox" | "radio";
    /** Signature image (raw bytes) for `signature` fields. */
    imageBytes?: Uint8Array;
    imageMime?: string;
    /** Submitted value for value fields. */
    value?: string | boolean;
}

// The placement canvas is rendered by pdfjs at this scale, so canvas units →
// PDF points is a uniform 1/CANVAS_SCALE ratio per page.
const CANVAS_SCALE = 2;

const GREEN = rgb(0.12, 0.5, 0.32);

/**
 * Flattens signature images + field values into a PDF artifact.
 *
 * Maps each render rect from canvas units to PDF points (inverting the Y axis —
 * PDF origin is bottom-left), then:
 * - `signature` → draws the signer's image (contain-fit within the rect).
 * - `text`/`phone`/`choices` → draws the submitted string (fits height, then width).
 * - `checkbox` (value true) → draws a check mark.
 * - `radio` (value true) → draws a filled dot.
 *
 * Rendering is best-effort per field: a field missing its data is skipped.
 */
export async function flattenPdf(
    pdfBytes: Uint8Array,
    renders: FlattenRender[],
): Promise<Uint8Array> {
    const doc = await PDFDocument.load(pdfBytes);
    const pages = doc.getPages();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    for (const r of renders) {
        const page = pages[r.page];
        if (!page || r.width <= 0 || r.height <= 0) continue;

        const pageW = page.getWidth();
        const pageH = page.getHeight();
        const canvasW = pageW * CANVAS_SCALE;
        const canvasH = pageH * CANVAS_SCALE;

        // Center-based canvas rect → bottom-left PDF rect.
        const leftPdf = ((r.x - r.width / 2) / canvasW) * pageW;
        const bottomPdf = pageH - ((r.y + r.height / 2) / canvasH) * pageH;
        const widthPdf = (r.width / canvasW) * pageW;
        const heightPdf = (r.height / canvasH) * pageH;

        if (r.kind === "signature") {
            await drawSignature(doc, page, r.imageBytes, r.imageMime, {
                x: leftPdf,
                y: bottomPdf,
                width: widthPdf,
                height: heightPdf,
            });
            continue;
        }

        if (r.kind === "checkbox") {
            if (r.value === true) drawCheckMark(page, leftPdf, bottomPdf, widthPdf, heightPdf);
            continue;
        }

        if (r.kind === "radio") {
            if (r.value === true) drawRadio(page, leftPdf, bottomPdf, widthPdf, heightPdf);
            continue;
        }

        if (typeof r.value === "string" && r.value.trim() !== "") {
            drawText(page, font, r.value, leftPdf, bottomPdf, widthPdf, heightPdf);
        }
    }

    return doc.save();
}

interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

async function drawSignature(
    doc: PDFDocument,
    page: PDFPage,
    imageBytes: Uint8Array | undefined,
    mimeType: string | undefined,
    box: Box,
) {
    if (!imageBytes || !mimeType) return;
    const isPng = mimeType === "image/png";
    const isJpeg = mimeType === "image/jpeg";
    if (!isPng && !isJpeg) return;

    const image = isPng ? await doc.embedPng(imageBytes) : await doc.embedJpg(imageBytes);
    // contain-fit (object-contain): preserve aspect, center in the rect.
    const scale = Math.min(box.width / image.width, box.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, {
        x: box.x + (box.width - width) / 2,
        y: box.y + (box.height - height) / 2,
        width,
        height,
    });
}

function drawText(
    page: PDFPage,
    font: PDFFont,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
) {
    let size = Math.min(height * 0.85, 22);
    // Fit width (best-effort, single line).
    const textWidth = font.widthOfTextAtSize(text, size);
    if (textWidth > width) size = Math.max(4, size * (width / textWidth));
    page.drawText(text, {
        x,
        y: y + (height - size) / 2,
        size,
        font,
        color: GREEN,
    });
}

function drawCheckMark(page: PDFPage, x: number, y: number, width: number, height: number) {
    const lw = Math.max(1, Math.min(width, height) * 0.1);
    // Simple check: two strokes inside the box.
    page.drawLine({
        start: { x: x + width * 0.2, y: y + height * 0.5 },
        end: { x: x + width * 0.42, y: y + height * 0.28 },
        thickness: lw,
        color: GREEN,
    });
    page.drawLine({
        start: { x: x + width * 0.42, y: y + height * 0.28 },
        end: { x: x + width * 0.82, y: y + height * 0.72 },
        thickness: lw,
        color: GREEN,
    });
}

function drawRadio(page: PDFPage, x: number, y: number, width: number, height: number) {
    const radius = Math.min(width, height) * 0.3;
    page.drawCircle({
        x: x + width / 2,
        y: y + height / 2,
        size: radius,
        color: GREEN,
    });
}
