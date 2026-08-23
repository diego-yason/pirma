import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { flattenPdf } from "./flatten-pdf.js";

// A valid 1x1 PNG.
const PNG_1x1 = Uint8Array.from(
    Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "base64",
    ),
);

async function makePdf(pages = 1): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages; i++) doc.addPage([595.28, 841.89]); // A4
    return doc.save();
}

const rect = {
    page: 0,
    x: 297.64, // canvas units (A4 * 2 → 1190.56 x 1683.78)
    y: 841.89 / 2 + 100, // center near the middle
    width: 400,
    height: 120,
};

describe("flattenPdf (O3-B2 artifact generation)", () => {
    it("returns a valid PDF with the same page count", async () => {
        const pdf = await makePdf(2);
        const out = await flattenPdf(pdf, []);
        const doc = await PDFDocument.load(out);
        expect(doc.getPageCount()).toBe(2);
    });

    it("burns a signature image into the PDF (contain-fit within the rect)", async () => {
        const pdf = await makePdf(1);
        const out = await flattenPdf(pdf, [
            {
                ...rect,
                kind: "signature",
                imageBytes: PNG_1x1,
                imageMime: "image/png",
            },
        ]);
        const doc = await PDFDocument.load(out);
        expect(doc.getPageCount()).toBe(1);
        // Embedding an image must change the artifact (vs. the original).
        expect(out.byteLength).toBeGreaterThan(pdf.byteLength);
    });

    it("draws submitted text values", async () => {
        const pdf = await makePdf(1);
        const out = await flattenPdf(pdf, [{ ...rect, kind: "text", value: "Jane Doe" }]);
        const doc = await PDFDocument.load(out);
        expect(doc.getPageCount()).toBe(1);
        expect(out.byteLength).toBeGreaterThan(pdf.byteLength);
    });

    it("draws checkbox and radio only when selected", async () => {
        const pdf = await makePdf(1);
        const checked = await flattenPdf(pdf, [
            { ...rect, kind: "checkbox", value: true },
            { ...rect, kind: "radio", value: true },
        ]);
        const unchecked = await flattenPdf(pdf, [
            { ...rect, kind: "checkbox", value: false },
            { ...rect, kind: "radio", value: false },
        ]);
        const checkedDoc = await PDFDocument.load(checked);
        const uncheckedDoc = await PDFDocument.load(unchecked);
        expect(checkedDoc.getPageCount()).toBe(1);
        expect(uncheckedDoc.getPageCount()).toBe(1);
        // Unselected boxes add no visual marks → smaller output.
        expect(unchecked.byteLength).toBeLessThan(checked.byteLength);
    });

    it("skips invalid pages and missing image data gracefully", async () => {
        const pdf = await makePdf(1);
        const out = await flattenPdf(pdf, [
            { ...rect, page: 99, kind: "text", value: "nope" },
            { ...rect, kind: "signature" }, // no imageBytes
            { ...rect, kind: "signature", imageBytes: PNG_1x1, imageMime: "image/bmp" },
        ]);
        const doc = await PDFDocument.load(out);
        expect(doc.getPageCount()).toBe(1);
    });
});
