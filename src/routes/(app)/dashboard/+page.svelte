<script lang="ts">
    import { resolve } from "$app/paths";
    import type { PageProps } from "./$types";
    import SignatureRequest from "./SignatureRequest.svelte";

    let { data }: PageProps = $props();

    const pendingCount = $derived(data.pendingPackages.length);
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
    You have {pendingCount} package{pendingCount !== 1 ? "s" : ""} waiting for your review and signature
    and received {completedCount} document{completedCount !== 1 ? "s" : ""} that
    {completedCount === 1 ? "is" : "are"} completely signed.
</p>

<div class="flex flex-col px-5 gap-3">
    {#each data.pendingPackages as pkg (pkg.id)}
        {@const due = data.expirationDates.get(pkg.id)}
        {@const owner = data.ownerInfo.get(pkg.id)}
        <SignatureRequest
            title={pkg.name}
            flags={due ? ["due-soon"] : []}
            dueDate={due ?? undefined}
            from={owner?.name}
            fromEmail={owner?.email}
            docCount={pkg.docCount}
        />
    {/each}
    {#if pendingCount === 0}
        <p class="text-neutral-500 text-sm px-2">No pending signatures. 🎉</p>
    {/if}
</div>

<div class="px-4 mt-8 max-w-xl">
    <div class="py-2 border border-neutral-800 items-center rounded-t-md flex justify-between px-4">
        <h2 class="text-2xl font-semibold tracking-wide">Recent Envelopes</h2>

        <a class="text-secondary-500 tracking-wide" href={resolve("doc/list")}>View All</a>
    </div>
    {#each data.recentDocuments as pkg (pkg.id)}
        <div class="border border-t-0 border-neutral-800">
            <div
                class="px-4 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/30"
            >
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold truncate">{pkg.name}</p>
                    <p class="text-xs text-neutral-500 mt-0.5">
                        {pkg.documents.length} doc{pkg.documents.length !== 1 ? "s" : ""}
                        · Created {pkg.documents[0]?.createdAt
                            ? new Date(pkg.documents[0].createdAt).toLocaleDateString("en-SG", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                              })
                            : ""}
                    </p>
                </div>
                <div class="flex items-center gap-3 text-xs shrink-0">
                    {#if pkg.documents.some((d) => d.status === "draft")}
                        <span class="rounded-full bg-neutral-800 px-2 py-0.5 text-neutral-400"
                            >Draft</span
                        >
                    {:else if pkg.documents.every((d) => d.status === "executed")}
                        <span class="rounded-full bg-emerald-900/50 px-2 py-0.5 text-emerald-300"
                            >Executed</span
                        >
                    {:else}
                        <span class="rounded-full bg-amber-900/50 px-2 py-0.5 text-amber-300"
                            >In Progress</span
                        >
                    {/if}
                    <a href={resolve(`doc/${pkg.id}`)} class="text-secondary-200 hover:underline">
                        View
                    </a>
                </div>
            </div>
            <div class="divide-y divide-neutral-900">
                {#each pkg.documents as doc (doc.id)}
                    <a
                        href={doc.status === "draft"
                            ? resolve(`doc/new/${pkg.id}`)
                            : resolve(`doc/${pkg.id}`)}
                        class="flex items-center gap-2 px-4 py-2 pl-10 text-sm hover:bg-neutral-900/20 transition"
                    >
                        <span class="text-neutral-600 shrink-0">└─</span>
                        <span class="truncate">{doc.title}</span>
                    </a>
                {/each}
            </div>
        </div>
    {/each}
    {#if data.recentDocuments.length === 0}
        <p
            class="text-neutral-500 text-sm px-4 py-4 border border-t-0 border-neutral-800 rounded-b-md"
        >
            No envelopes yet. Upload your first document to get started.
        </p>
    {/if}
</div>
