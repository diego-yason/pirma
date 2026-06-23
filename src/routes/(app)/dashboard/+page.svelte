<script lang="ts">
    import type { PageProps } from "./$types";
    import SignatureRequest from "./SignatureRequest.svelte";

    let { data }: PageProps = $props();

    const pendingCount = $derived(data.pendingDocuments.length);
    const completedCount = $derived(data.completedDocuments.length);

    const statusLabel: Record<string, string> = {
        draft: "Draft",
        finalized: "Awaiting Signatories",
        executed: "Executed",
    };
</script>

<!-- consistent R-padding is 4 -->

<h2 class="text-3xl px-4 font-bold mt-16">Waiting for You</h2>
<p class="text-lg px-4 mb-4 text-neutral-200">
    You have {pendingCount} document{pendingCount !== 1 ? "s" : ""} waiting for your review and signature
    and received {completedCount} document{completedCount !== 1 ? "s" : ""} that
    {completedCount === 1 ? "is" : "are"} completely signed.
</p>

<div class="flex flex-col px-5 gap-3">
    {#each data.pendingDocuments as doc}
        <SignatureRequest
            title={doc.title}
            flags={doc.status === "finalized" ? ["due-soon"] : []}
        />
    {/each}
    {#if pendingCount === 0}
        <p class="text-neutral-500 text-sm px-2">No pending signatures. 🎉</p>
    {/if}
</div>

<div class="px-4 mt-8">
    <div class="py-2 border border-neutral-800 items-center rounded-t-md flex justify-between px-4">
        <h2 class="text-2xl font-semibold tracking-wide">Recent Documents</h2>
        <a class="text-secondary-500 tracking-wide" href="">View All</a>
    </div>
    <!-- header -->
    <div class="text-sm grid border-neutral-800 grid-cols-8 border border-t-0 py-4 px-4">
        <p class="font-medium text-neutral-500 tracking-wider uppercase col-span-3">
            Document Name
        </p>
        <p class="font-medium text-neutral-500 tracking-wider uppercase col-span-2">Owner</p>
        <p class="font-medium text-neutral-500 tracking-wider uppercase">Date</p>
        <p class="font-medium text-neutral-500 tracking-wider uppercase">Status</p>
        <p class="font-medium text-neutral-500 tracking-wider uppercase">view</p>
    </div>
    {#each data.recentDocuments as doc}
        <div
            class="text-sm grid py-4 border border-t-0 border-neutral-800 rounded-b-md grid-cols-8 px-4 items-center"
        >
            <p class="col-span-3">{doc.title}</p>
            <p class="col-span-2">You</p>
            <p class="">
                {new Date(doc.createdAt).toLocaleDateString("en-SG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                })}
            </p>
            <p class="">{statusLabel[doc.status] ?? doc.status}</p>
            <a href="" class="text-secondary-200">View Document</a>
        </div>
    {/each}
    {#if data.recentDocuments.length === 0}
        <p
            class="text-neutral-500 text-sm px-4 py-4 border border-t-0 border-neutral-800 rounded-b-md"
        >
            No documents yet. Upload your first document to get started.
        </p>
    {/if}
</div>
