import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { convertToPdf, DOCX_MIME } from "./convert-to-pdf.js";

// A valid 1x1 PNG.
const PNG_1x1 = Uint8Array.from(
    Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "base64",
    ),
);

async function makePdf(pages = 1): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages; i++) doc.addPage();
    return doc.save();
}

describe("convertToPdf (ingestion)", () => {
    it("keeps a PDF as-is and reports its page count", async () => {
        const pdf = await makePdf(2);
        const res = await convertToPdf(pdf, "application/pdf");
        expect(res.converted).toBe(false);
        expect(res.pageCount).toBe(2);
        expect(res.bytes.byteLength).toBe(pdf.byteLength);
    });

    it("converts a PNG into a single-page PDF", async () => {
        const res = await convertToPdf(PNG_1x1, "image/png");
        expect(res.converted).toBe(true);
        expect(res.pageCount).toBe(1);
        const doc = await PDFDocument.load(res.bytes);
        expect(doc.getPageCount()).toBe(1);
    });

    it("throws for unsupported types (e.g. DOCX — deferred)", async () => {
        await expect(convertToPdf(PNG_1x1, DOCX_MIME)).rejects.toThrow();
    });

    it("throws for invalid PDF bytes", async () => {
        await expect(convertToPdf(new Uint8Array([1, 2, 3]), "application/pdf")).rejects.toThrow();
    });
});
