import { PDFDocument } from "pdf-lib";

export const PDF_MIME = "application/pdf";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface ConvertedPdf {
    /** Final PDF bytes (post-conversion) — these are what gets stored + hashed. */
    bytes: Uint8Array;
    /** Page count of the final PDF (authoritative). */
    pageCount: number;
    /** True when the input was converted (image → PDF); false for a kept PDF. */
    converted: boolean;
}

// A4 portrait in points.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;

/**
 * Normalizes an uploaded file into a PDF for storage/signing:
 *
 * - `application/pdf` — kept as-is (validated; page count read).
 * - `image/jpeg` / `image/png` — embedded into a single A4 page (aspect kept,
 *   centered, scaled down to fit; never upscaled).
 * - Anything else (incl. DOCX) — throws. **DOCX → PDF is deferred**: it needs
 *   LibreOffice headless or the document microservice (see
 *   `docs/ai/pdfa/pdfa-compliance.md` §4 — "Phase 1 can reject DOCX").
 *
 * This is the Phase-1 ingestion conversion (roadmap §3 / O3-B1), done in-process.
 */
export async function convertToPdf(
    bytes: Uint8Array | ArrayBuffer,
    mimeType: string,
): Promise<ConvertedPdf> {
    if (mimeType === PDF_MIME) {
        const doc = await PDFDocument.load(bytes); // throws if not a valid PDF
        return {
            bytes: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
            pageCount: doc.getPageCount(),
            converted: false,
        };
    }

    const isPng = mimeType === "image/png";
    const isJpeg = mimeType === "image/jpeg";
    if (!isPng && !isJpeg) {
        throw new Error(`Unsupported file type for conversion: ${mimeType}`);
    }

    const doc = await PDFDocument.create();
    const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);

    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const maxW = PAGE_WIDTH - MARGIN * 2;
    const maxH = PAGE_HEIGHT - MARGIN * 2;
    const scale = Math.min(maxW / image.width, maxH / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;

    page.drawImage(image, {
        x: (PAGE_WIDTH - width) / 2,
        y: (PAGE_HEIGHT - height) / 2,
        width,
        height,
    });

    const out = await doc.save();
    return { bytes: out, pageCount: 1, converted: true };
}
