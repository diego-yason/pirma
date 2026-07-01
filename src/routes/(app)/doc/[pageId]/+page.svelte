<script lang="ts">
    import type { PageProps } from "./$types";
    import { resolve } from "$app/paths";

    let { data }: PageProps = $props();

    function statusBadgeClass(status: string): string {
        switch (status) {
            case "finalized":
                return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
            case "executed":
                return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
            case "draft":
                return "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400";
            default:
                return "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400";
        }
    }

    function sigStatusBadge(signed: boolean, status: string): string {
        if (signed)
            return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
        if (status === "rejected")
            return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
        return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
    }

    function sigLabel(signed: boolean, status: string): string {
        if (signed) return "Signed";
        if (status === "rejected") return "Rejected";
        return "Pending";
    }

    function overallProgress(recipients: typeof data.recipients): {
        total: number;
        signed: number;
    } {
        let total = 0;
        let signed = 0;
        for (const r of recipients) {
            if (r.role !== "signer") continue;
            for (const ds of r.docStatuses) {
                total++;
                if (ds.signed) signed++;
            }
        }
        return { total, signed };
    }

    let progress = $derived(overallProgress(data.recipients));
    let progressPct = $derived(
        progress.total > 0 ? Math.round((progress.signed / progress.total) * 100) : 0,
    );

    // Group recipients by signing group
    let maxGroup = $derived(Math.max(0, ...data.recipients.map((r) => r.signingGroup ?? 0)));
    let groupedRecipients = $derived(
        Array.from({ length: maxGroup + 1 }, (_, i) => {
            const groupNum = i === 0 ? null : i;
            return {
                groupNum,
                recipients: data.recipients.filter((r) => (r.signingGroup ?? null) === groupNum),
            };
        }).filter((g) => g.recipients.length > 0),
    );
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
        <div>
            <h1 class="text-2xl font-bold">{data.pkg.name}</h1>
            <p class="text-sm text-neutral-500 mt-1">
                {data.pkg.signingOrderEnabled ? "Sequential signing" : "Parallel signing"}
                {data.pkg.mfaRequired ? " · MFA required" : ""}
                {#if data.pkg.expirationDate}
                    · Expires {new Date(data.pkg.expirationDate).toLocaleDateString()}
                {/if}
            </p>
        </div>
        {#if data.isRecipient}
            <a
                href={resolve(`/doc/${data.pkg.id}/sign`)}
                class="rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
                Sign Document
            </a>
        {/if}
        <a
            href={resolve(`/doc/${data.pkg.id}/view`)}
            class="rounded-md border border-neutral-300 dark:border-neutral-600 px-6 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
        >
            View
        </a>
    </div>

    <!-- Progress bar -->
    <div class="mb-8">
        <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                Signing Progress
            </span>
            <span class="text-sm text-neutral-500">
                {progress.signed} of {progress.total} fields signed ({progressPct}%)
            </span>
        </div>
        <div class="h-3 w-full rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
            <div
                class="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style="width: {progressPct}%"
            ></div>
        </div>
    </div>

    <!-- Documents -->
    <div class="mb-8">
        <h2 class="text-lg font-semibold mb-3">Documents</h2>
        <div class="flex flex-col gap-2">
            {#each data.documents as doc (doc.id)}
                <div
                    class="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-700 px-4 py-3"
                >
                    <div>
                        <p class="font-medium">{doc.title}</p>
                        <p class="text-xs text-neutral-500">
                            {doc.pageCount} page{doc.pageCount !== 1 ? "s" : ""}
                            {#if doc.fileSize}
                                · {(doc.fileSize / 1024).toFixed(0)} KB
                            {/if}
                        </p>
                    </div>
                    <span
                        class="rounded-full px-2.5 py-0.5 text-xs font-medium {statusBadgeClass(
                            doc.status,
                        )}"
                    >
                        {doc.status}
                    </span>
                </div>
            {/each}
        </div>
    </div>

    <!-- Recipients & Signing Status -->
    <div>
        <h2 class="text-lg font-semibold mb-3">Recipients</h2>
        {#if data.pkg.signingOrderEnabled && groupedRecipients.length > 1}
            {#each groupedRecipients as group (group.groupNum)}
                {#if group.groupNum !== null}
                    <div class="mb-4">
                        <h3
                            class="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-2"
                        >
                            Group {group.groupNum}
                        </h3>
                        <div class="flex flex-col gap-2">
                            {#each group.recipients as r (r.id)}
                                {@render RecipientCard({ r, documents: data.documents })}
                            {/each}
                        </div>
                    </div>
                {:else}
                    <div class="flex flex-col gap-2 mb-4">
                        {#each group.recipients as r (r.id)}
                            {@render RecipientCard({ r, documents: data.documents })}
                        {/each}
                    </div>
                {/if}
            {/each}
        {:else}
            <div class="flex flex-col gap-2">
                {#each data.recipients as r (r.id)}
                    {@render RecipientCard({ r, documents: data.documents })}
                {/each}
            </div>
        {/if}
    </div>
</div>

{#snippet RecipientCard(props: {
    r: (typeof data.recipients)[number];
    documents: typeof data.documents;
})}
    {@const r = props.r}
    <div
        class="rounded-lg border border-neutral-200 dark:border-neutral-700 px-4 py-3"
        class:border-emerald-200={r.isMe}
        class:dark:border-emerald-800={r.isMe}
        class:bg-emerald-50={r.isMe}
        class:dark:bg-emerald-950={r.isMe}
    >
        <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
                <p class="font-medium">
                    {r.name}
                    {#if r.isMe}
                        <span
                            class="ml-2 rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200"
                        >
                            You
                        </span>
                    {/if}
                </p>
                <span
                    class="rounded-full px-2 py-0.5 text-xs font-medium {r.role === 'signer'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'}"
                >
                    {r.role}
                </span>
            </div>
            <p class="text-xs text-neutral-500">{r.email}</p>
        </div>
        {#if r.role === "signer"}
            <div class="flex flex-wrap gap-2 mt-1">
                {#each r.docStatuses as ds (ds.documentId)}
                    <span
                        class="rounded-full px-2 py-0.5 text-xs font-medium {sigStatusBadge(
                            ds.signed,
                            ds.status,
                        )}"
                    >
                        {ds.documentTitle}: {sigLabel(ds.signed, ds.status)}
                    </span>
                {/each}
            </div>
        {/if}
    </div>
{/snippet}
