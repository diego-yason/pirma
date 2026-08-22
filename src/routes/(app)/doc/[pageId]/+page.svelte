<script lang="ts">
    import type { PageProps } from "./$types";
    import { resolve } from "$app/paths";

    let { data }: PageProps = $props();

    const statusLabel: Record<string, string> = {
        draft: "Draft",
        finalized: "Awaiting Signatories",
        executed: "Executed",
    };

    /** Visual treatment per document status (matches the dashboard). */
    const statusStyle: Record<string, { badge: string; dot: string; bar: string; text: string }> = {
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

    /** Per-recipient signature state per document. */
    const sigStyle: Record<string, { label: string; badge: string; dot: string }> = {
        signed: {
            label: "Signed",
            badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
            dot: "bg-emerald-500 dark:bg-emerald-400",
        },
        pending: {
            label: "Pending",
            badge: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
            dot: "bg-amber-500 dark:bg-amber-400",
        },
        rejected: {
            label: "Rejected",
            badge: "bg-red-500/15 text-red-600 dark:text-red-300",
            dot: "bg-red-500 dark:bg-red-400",
        },
    };

    function sigState(signed: boolean, status: string): keyof typeof sigStyle {
        if (signed) return "signed";
        if (status === "rejected") return "rejected";
        return "pending";
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

<div class="mx-auto max-w-4xl px-6 py-8 lg:px-10">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
            <h1
                class="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-neutral-50"
            >
                {data.pkg.name}
            </h1>
            <div
                class="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400"
            >
                <span
                    class="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-1 font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                >
                    {data.pkg.signingOrderEnabled ? "Sequential signing" : "Parallel signing"}
                </span>
                {#if data.pkg.mfaRequired}
                    <span
                        class="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-1 font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                    >
                        MFA required
                    </span>
                {/if}
                {#if data.pkg.expirationDate}
                    <span
                        class="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 font-medium text-amber-700 dark:text-amber-300"
                    >
                        Expires {new Date(data.pkg.expirationDate).toLocaleDateString()}
                    </span>
                {/if}
            </div>
        </div>
        <div class="flex items-center gap-2">
            {#if data.isRecipient}
                <a
                    href={resolve(`doc/${data.pkg.id}/sign`)}
                    class="inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-secondary-600 to-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-secondary-500 hover:to-primary-600"
                >
                    Sign Document
                </a>
            {/if}
            <a
                href={resolve(`doc/${data.pkg.id}/view`)}
                class="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
                View
            </a>
        </div>
    </div>

    <!-- Progress -->
    <div
        class="mt-8 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/60"
    >
        <div class="flex items-center justify-between text-sm">
            <span class="font-medium text-neutral-700 dark:text-neutral-200">
                Signing Progress
            </span>
            <span class="text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
                {progress.signed} of {progress.total} fields signed ({progressPct}%)
            </span>
        </div>
        <div
            class="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
        >
            <div
                class="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style="width: {progressPct}%"
            ></div>
        </div>
    </div>

    <!-- Documents -->
    <section class="mt-10">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Documents</h2>
        <div class="mt-3 flex flex-col gap-2">
            {#each data.documents as doc (doc.id)}
                <div
                    class="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 transition hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-neutral-700"
                >
                    <div class="flex min-w-0 items-center gap-3">
                        <span
                            class="grid size-9 shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                class="size-4"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"
                                ></path>
                            </svg>
                        </span>
                        <div class="min-w-0">
                            <p
                                class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100"
                            >
                                {doc.title}
                            </p>
                            <p class="text-xs text-neutral-500 dark:text-neutral-400">
                                {doc.pageCount} page{doc.pageCount !== 1 ? "s" : ""}
                                {#if doc.fileSize}
                                    · {(doc.fileSize / 1024).toFixed(0)} KB
                                {/if}
                            </p>
                        </div>
                    </div>
                    <span
                        class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold {statusStyle[
                            doc.status
                        ].badge}"
                    >
                        <span class="size-1.5 rounded-full {statusStyle[doc.status].dot}"></span>
                        {statusLabel[doc.status]}
                    </span>
                </div>
            {/each}
        </div>
    </section>

    <!-- Recipients & Signing Status -->
    <section class="mt-10">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Recipients</h2>
        {#if data.pkg.signingOrderEnabled && groupedRecipients.length > 1}
            {#each groupedRecipients as group (group.groupNum)}
                {#if group.groupNum !== null}
                    <div class="mt-3">
                        <h3
                            class="mb-2 text-xs font-semibold tracking-wider text-secondary-600 uppercase dark:text-secondary-400"
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
                    <div class="mt-3 flex flex-col gap-2">
                        {#each group.recipients as r (r.id)}
                            {@render RecipientCard({ r, documents: data.documents })}
                        {/each}
                    </div>
                {/if}
            {/each}
        {:else}
            <div class="mt-3 flex flex-col gap-2">
                {#each data.recipients as r (r.id)}
                    {@render RecipientCard({ r, documents: data.documents })}
                {/each}
            </div>
        {/if}
    </section>
</div>

{#snippet RecipientCard(props: {
    r: (typeof data.recipients)[number];
    documents: typeof data.documents;
})}
    {@const r = props.r}
    <div
        class="rounded-xl border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60"
        class:border-emerald-300={r.isMe}
        class:dark:border-emerald-700={r.isMe}
    >
        <div class="flex items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-3">
                <span
                    class="grid size-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-secondary-600 to-primary-700 text-sm font-bold text-white"
                    >{(r.name ?? "?").trim().charAt(0).toUpperCase()}</span
                >
                <div class="min-w-0">
                    <p
                        class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100"
                    >
                        {r.name}
                        {#if r.isMe}
                            <span
                                class="ml-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300"
                            >
                                You
                            </span>
                        {/if}
                    </p>
                    <p class="truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {r.email}
                    </p>
                </div>
            </div>
            <span
                class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold {r.role === 'signer'
                    ? 'bg-secondary-500/15 text-secondary-600 dark:text-secondary-300'
                    : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'}"
            >
                {r.role}
            </span>
        </div>
        {#if r.role === "signer"}
            <div class="mt-2.5 flex flex-wrap gap-1.5">
                {#each r.docStatuses as ds (ds.documentId)}
                    {@const s = sigState(ds.signed, ds.status)}
                    <span
                        class="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium {sigStyle[
                            s
                        ].badge}"
                    >
                        <span class="size-1.5 rounded-full {sigStyle[s].dot}"></span>
                        {ds.documentTitle}: {sigStyle[s].label}
                    </span>
                {/each}
            </div>
        {/if}
    </div>
{/snippet}
