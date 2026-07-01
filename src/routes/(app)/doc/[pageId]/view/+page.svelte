<script lang="ts">
    import type { PageProps } from "./$types";
    import type { PlacedRect } from "$lib/client/types/SignatureBoxTypes";
    import PDFViewer from "$lib/client/ui/PDFViewer.svelte";

    let { data }: PageProps = $props();

    // Currently selected document
    let selectedDocId = $state(data.documents[0]?.id ?? "");
    let selectedDoc = $derived(data.documents.find((d) => d.id === selectedDocId));
    let selectedFields = $derived<PlacedRect[]>((selectedDoc?.fields as PlacedRect[]) ?? []);
    let selectedSignedStatus = $derived<Record<string, boolean>>(selectedDoc?.signedStatus ?? {});
    let selectedFieldUrls = $derived<Record<string, string>>(selectedDoc?.fieldSignatureUrls ?? {});

    // All signed field entries across all documents (for the status sidebar)
    let allFieldEntries = $derived(
        Object.entries(data.fieldStatus).map(([fieldId, status]) => ({
            fieldId,
            status: status.status,
            signerName: status.signerName,
        })),
    );

    function statusBadge(status: string): { label: string; class: string } {
        switch (status) {
            case "signed":
            case "anchored":
                return {
                    label: "Signed",
                    class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                };
            case "rejected":
                return {
                    label: "Rejected",
                    class: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
                };
            default:
                return {
                    label: "Pending",
                    class: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                };
        }
    }

    // Counts
    let signedCount = $derived(
        allFieldEntries.filter((e) => e.status === "signed" || e.status === "anchored").length,
    );
    let pendingCount = $derived(
        allFieldEntries.filter(
            (e) => e.status !== "signed" && e.status !== "anchored" && e.status !== "rejected",
        ).length,
    );
</script>

<div class="flex h-full overflow-hidden">
    <!-- Left: Document List -->
    <div class="w-56 shrink-0 border-r border-neutral-200 dark:border-neutral-800 flex flex-col">
        <div class="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
            <h2 class="text-sm font-semibold text-neutral-500 uppercase tracking-wider">
                Documents
            </h2>
        </div>
        <div class="flex-1 overflow-y-auto">
            {#each data.documents as doc (doc.id)}
                <button
                    class="w-full text-left px-4 py-3 text-sm transition hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    class:bg-neutral-100={doc.id === selectedDocId}
                    class:dark:bg-neutral-900={doc.id === selectedDocId}
                    class:font-semibold={doc.id === selectedDocId}
                    onclick={() => (selectedDocId = doc.id)}
                >
                    <p class="truncate">{doc.title}</p>
                    <p class="text-xs text-neutral-500">
                        {doc.pageCount} page{doc.pageCount !== 1 ? "s" : ""}
                    </p>
                </button>
            {/each}
        </div>
    </div>

    <!-- Center: PDF Viewer -->
    <div class="flex-1 min-w-0 min-h-0 overflow-y-auto">
        {#if selectedDoc?.url}
            <PDFViewer
                pdfUrl={selectedDoc.url}
                elements={selectedFields}
                signedStatus={selectedSignedStatus}
                fieldSignatureUrls={selectedFieldUrls}
                mode="view"
            />
        {:else}
            <div class="flex items-center justify-center h-full text-neutral-500">
                <p>No document available for preview.</p>
            </div>
        {/if}
    </div>

    <!-- Right: Status Center -->
    <div class="w-72 shrink-0 border-l border-neutral-200 dark:border-neutral-800 flex flex-col">
        <div class="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
            <h2 class="text-sm font-semibold text-neutral-500 uppercase tracking-wider">
                Signature Status
            </h2>
        </div>

        <!-- Summary -->
        <div class="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
            <div class="flex justify-between text-sm">
                <span class="text-neutral-500">Pending</span>
                <span class="font-medium text-amber-600">{pendingCount}</span>
            </div>
            <div class="flex justify-between text-sm mt-1">
                <span class="text-neutral-500">Signed</span>
                <span class="font-medium text-emerald-600">{signedCount}</span>
            </div>
            <div class="flex justify-between text-sm mt-1">
                <span class="text-neutral-500">Total Fields</span>
                <span class="font-medium">{allFieldEntries.length}</span>
            </div>
        </div>

        <!-- Field list -->
        <div class="flex-1 overflow-y-auto">
            {#if allFieldEntries.length > 0}
                <div class="flex flex-col">
                    {#each allFieldEntries as entry (entry.fieldId)}
                        {@const badge = statusBadge(entry.status)}
                        <div
                            class="flex items-center justify-between px-4 py-3 text-sm border-b border-neutral-100 dark:border-neutral-900"
                            class:opacity-60={entry.status === "signed" ||
                                entry.status === "anchored"}
                        >
                            <div class="min-w-0 flex-1 mr-2">
                                <p class="truncate font-medium">{entry.fieldId}</p>
                                {#if entry.signerName && (entry.status === "signed" || entry.status === "anchored")}
                                    <p class="text-xs text-neutral-500 truncate">
                                        by {entry.signerName}
                                    </p>
                                {/if}
                            </div>
                            <span
                                class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {badge.class}"
                            >
                                {badge.label}
                            </span>
                        </div>
                    {/each}
                </div>
            {:else}
                <p class="px-4 py-6 text-sm text-neutral-500 text-center">
                    No signature fields found.
                </p>
            {/if}
        </div>

        <!-- Recipients summary -->
        <div class="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800">
            <h3 class="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Recipients
            </h3>
            <div class="flex flex-col gap-1">
                {#each data.recipients as recipient (recipient.id)}
                    <div class="text-sm flex items-center justify-between">
                        <span class="truncate">{recipient.name}</span>
                        {#if recipient.role === "viewer"}
                            <span class="text-xs text-neutral-400 shrink-0">viewer</span>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>
