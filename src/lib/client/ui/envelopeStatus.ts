/**
 * Shared envelope/document status helpers.
 *
 * Extracted from `src/routes/(app)/dashboard/+page.svelte` so the dashboard and
 * the All Documents page (`/doc/list`) render status identically.
 */

export type EnvelopeStatus = "draft" | "finalized" | "executed";

export const statusLabel: Record<string, string> = {
    draft: "Draft",
    finalized: "Awaiting Signatories",
    executed: "Executed",
};

/** Visual treatment per document/envelope status. */
export const statusStyle: Record<
    string,
    { badge: string; dot: string; bar: string; text: string }
> = {
    draft: {
        badge: "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
        dot: "bg-neutral-400",
        bar: "bg-neutral-400",
        text: "text-neutral-500 dark:text-neutral-400",
    },
    finalized: {
        badge: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
        dot: "bg-amber-500 dark:bg-amber-400",
        bar: "bg-amber-500",
        text: "text-amber-600 dark:text-amber-300",
    },
    executed: {
        badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
        dot: "bg-emerald-500 dark:bg-emerald-400",
        bar: "bg-emerald-500",
        text: "text-emerald-600 dark:text-emerald-300",
    },
};

/** Aggregate a package's documents into one envelope status. */
export function envelopeStatus(docs: { status: string }[]): EnvelopeStatus {
    if (docs.some((d) => d.status === "draft")) return "draft";
    if (docs.every((d) => d.status === "executed")) return "executed";
    return "finalized";
}

/** Document-execution progress across an envelope's documents. */
export function envelopeProgress(docs: { status: string }[]) {
    const total = docs.length;
    const executed = docs.filter((d) => d.status === "executed").length;
    return { executed, total, pct: total ? Math.round((executed / total) * 100) : 0 };
}

/** Signature progress: `signed` of `total` signer-document pairs. */
export function signatureProgress(signed: number, total: number) {
    return { signed, total, pct: total ? Math.round((signed / total) * 100) : 0 };
}

/** Short date formatter used across the dashboard and the document list. */
export function fmtDate(iso?: string | Date | null): string {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-PH", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}
