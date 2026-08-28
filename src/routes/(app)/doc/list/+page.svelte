<script lang="ts">
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";
    import { page } from "$app/state";
    import { SvelteURLSearchParams } from "svelte/reactivity";
    import type { PageProps } from "./$types";
    import EnvelopeRow from "#lib/client/ui/EnvelopeRow.svelte";
    import { fmtDate, statusLabel, statusStyle } from "#lib/client/ui/envelopeStatus.js";

    let { data }: PageProps = $props();

    const segments = [
        { id: "all", label: "All" },
        { id: "waiting", label: "Waiting on me" },
        { id: "sent", label: "Sent by me" },
        { id: "shared", label: "Shared with me" },
        { id: "drafts", label: "Drafts" },
    ] as const;

    const statusChips = [
        { id: "all", label: "All" },
        { id: "draft", label: "Draft" },
        { id: "finalized", label: "Awaiting signatures" },
        { id: "executed", label: "Completed" },
    ] as const;

    const activeSegment = $derived(data.segment as (typeof segments)[number]["id"]);
    const activeStatus = $derived(data.status as (typeof statusChips)[number]["id"]);

    const docWord = $derived(data.totalDocuments === 1 ? "document" : "documents");
    const envStart = $derived((data.page - 1) * data.pageSize + 1);
    const envEnd = $derived(envStart + data.envelopes.length - 1);
    const draftStart = $derived((data.page - 1) * data.pageSize + 1);
    const draftEnd = $derived(draftStart + data.drafts.length - 1);

    const hasFilters = $derived(data.segment !== "all" || data.status !== "all" || data.q !== "");

    let searchInput = $state(data.q);

    /**
     * Navigate with updated query params. Passing `null`/`""`/`"all"` removes the
     * param (back to its default). By default the page is reset to 1.
     */
    function navigate(updates: Record<string, string | null>, resetPage = true) {
        const params = new SvelteURLSearchParams(page.url.search);
        for (const [key, value] of Object.entries(updates)) {
            if (value == null || value === "" || value === "all") params.delete(key);
            else params.set(key, value);
        }
        if (resetPage) params.set("page", "1");
        goto(`${page.url.pathname}?${params.toString()}`, { reset: false });
    }

    // Debounced server-side search: navigate once the user pauses typing. The
    // `value !== data.q` guard avoids a loop once navigation lands.
    $effect(() => {
        const value = searchInput.trim();
        const timer = setTimeout(() => {
            if (value !== data.q) {
                navigate(value ? { q: value } : { q: null });
            }
        }, 350);
        return () => clearTimeout(timer);
    });

    function clearFilters() {
        searchInput = "";
        navigate({ segment: null, status: null, q: null });
    }

    function formatSize(bytes: number): string {
        if (bytes == null || bytes < 0) return "";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
</script>

<div class="mx-auto max-w-5xl px-6 py-8 lg:px-10">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
            <h1
                class="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-neutral-50"
            >
                All Documents
            </h1>
            <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                {data.totalDocuments}
                {docWord}
            </p>
        </div>
        <a
            href={resolve("doc/new")}
            class="inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-secondary-600 to-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-secondary-500 hover:to-primary-600"
        >
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="size-4"
            >
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"></path>
            </svg>
            New Document
        </a>
    </div>

    <!-- Search -->
    <div class="mt-6">
        <input
            type="search"
            bind:value={searchInput}
            placeholder="Search documents…"
            aria-label="Search documents"
            class="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
        />
    </div>

    <!-- Segments -->
    <div
        class="mt-6 flex flex-wrap gap-1 rounded-xl border border-neutral-200 bg-neutral-100/60 p-1 dark:border-neutral-800 dark:bg-neutral-900/60"
        role="tablist"
        aria-label="Filter documents"
    >
        {#each segments as seg (seg.id)}
            <button
                type="button"
                role="tab"
                aria-selected={activeSegment === seg.id}
                onclick={() => navigate({ segment: seg.id })}
                class="rounded-lg px-3 py-1.5 text-sm font-medium transition {activeSegment ===
                seg.id
                    ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'}"
            >
                {seg.label}
            </button>
        {/each}
    </div>

    <!-- Status filter chips -->
    <div class="mt-4 flex flex-wrap items-center gap-2">
        {#each statusChips as chip (chip.id)}
            <button
                type="button"
                onclick={() => navigate({ status: chip.id })}
                class="rounded-full px-3 py-1 text-xs font-semibold transition {activeStatus ===
                chip.id
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'border border-neutral-300 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'}"
            >
                {chip.label}
            </button>
        {/each}
    </div>

    {#if !data.isDraftsSegment}
        <!-- Envelope list -->
        {#if data.envelopes.length === 0}
            <div
                class="mt-6 rounded-xl border border-dashed border-neutral-300 bg-neutral-100/50 px-6 py-14 text-center dark:border-neutral-800 dark:bg-neutral-900/30"
            >
                {#if data.q}
                    <p class="text-3xl">🔍</p>
                    <p class="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        No matches for "{data.q}"
                    </p>
                    <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-500">
                        Try a different search term.
                    </p>
                    <button
                        type="button"
                        onclick={() => {
                            searchInput = "";
                            navigate({ q: null });
                        }}
                        class="mt-4 text-sm font-semibold text-secondary-600 transition hover:text-secondary-500 dark:text-secondary-400 dark:hover:text-secondary-300"
                    >
                        Clear search
                    </button>
                {:else if data.segment === "shared"}
                    <p class="text-3xl">📥</p>
                    <p class="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Nothing shared with you yet
                    </p>
                    <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-500">
                        When someone adds you as a recipient or viewer on a package, it will
                        appear here.
                    </p>
                    {#if hasFilters}
                        <button
                            type="button"
                            onclick={clearFilters}
                            class="mt-4 text-sm font-semibold text-secondary-600 transition hover:text-secondary-500 dark:text-secondary-400 dark:hover:text-secondary-300"
                        >
                            Clear filters
                        </button>
                    {/if}
                {:else if data.totalDocuments === 0}
                    <p class="text-3xl">📄</p>
                    <p class="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        No documents yet
                    </p>
                    <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-500">
                        Upload your first document to get started.
                    </p>
                    <a
                        href={resolve("doc/new")}
                        class="mt-4 inline-block text-sm font-semibold text-secondary-600 transition hover:text-secondary-500 dark:text-secondary-400 dark:hover:text-secondary-300"
                    >
                        Upload a document →
                    </a>
                {:else}
                    <p class="text-3xl">🗂️</p>
                    <p class="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Nothing here
                    </p>
                    <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-500">
                        No envelopes match the current filters.
                    </p>
                    {#if hasFilters}
                        <button
                            type="button"
                            onclick={clearFilters}
                            class="mt-4 text-sm font-semibold text-secondary-600 transition hover:text-secondary-500 dark:text-secondary-400 dark:hover:text-secondary-300"
                        >
                            Clear filters
                        </button>
                    {/if}
                {/if}
            </div>
        {:else}
            <div class="mt-6 flex flex-col gap-3">
                {#each data.envelopes as pkg (pkg.id)}
                    <EnvelopeRow {pkg} />
                {/each}
            </div>

            {#if data.envelopeTotal > data.pageSize}
                <nav
                    class="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm"
                    aria-label="Pagination"
                >
                    <span class="text-neutral-600 dark:text-neutral-400">
                        Showing {envStart}–{envEnd} of {data.envelopeTotal}
                    </span>
                    <div class="flex gap-2">
                        <button
                            type="button"
                            disabled={data.page <= 1}
                            onclick={() => navigate({ page: String(data.page - 1) }, false)}
                            class="rounded-lg border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:text-neutral-100"
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            disabled={!data.hasMoreEnvelopes}
                            onclick={() => navigate({ page: String(data.page + 1) }, false)}
                            class="rounded-lg border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:text-neutral-100"
                        >
                            Next
                        </button>
                    </div>
                </nav>
            {/if}
        {/if}

        <!-- Standalone drafts section (All segment) -->
        {#if data.showDraftsSection}
            <section class="mt-10" aria-label="Standalone drafts">
                <div class="mb-4">
                    <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                        Standalone drafts
                    </h2>
                    <p class="text-sm text-neutral-600 dark:text-neutral-500">
                        Uploaded documents that aren't in a package yet.
                    </p>
                </div>
                <div
                    class="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/60"
                >
                    <div class="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                        {#each data.drafts as draft (draft.id)}
                            <div
                                class="flex items-center gap-3 px-5 py-3 text-sm text-neutral-700 dark:text-neutral-300"
                            >
                                <span
                                    class="size-1.5 shrink-0 rounded-full {statusStyle[draft.status]
                                        .dot}"
                                ></span>
                                <span class="min-w-0 truncate font-medium">{draft.title}</span>
                                <span
                                    class="hidden shrink-0 text-xs text-neutral-400 sm:inline dark:text-neutral-500"
                                >
                                    {draft.pageCount}
                                    {draft.pageCount === 1 ? "page" : "pages"} ·
                                    {formatSize(draft.fileSize)}
                                </span>
                                <span
                                    class="ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold {statusStyle[
                                        draft.status
                                    ].badge}"
                                >
                                    {statusLabel[draft.status] ?? "Draft"}
                                </span>
                                <a
                                    href={resolve("doc/new")}
                                    class="shrink-0 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:text-neutral-100"
                                >
                                    Send
                                </a>
                            </div>
                        {/each}
                    </div>
                </div>
            </section>
        {/if}
    {:else}
        <!-- Drafts segment: drafts are the primary list -->
        {#if data.drafts.length === 0}
            <div
                class="mt-6 rounded-xl border border-dashed border-neutral-300 bg-neutral-100/50 px-6 py-14 text-center dark:border-neutral-800 dark:bg-neutral-900/30"
            >
                {#if data.q}
                    <p class="text-3xl">🔍</p>
                    <p class="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        No matches for "{data.q}"
                    </p>
                    <button
                        type="button"
                        onclick={() => {
                            searchInput = "";
                            navigate({ q: null });
                        }}
                        class="mt-4 text-sm font-semibold text-secondary-600 transition hover:text-secondary-500 dark:text-secondary-400 dark:hover:text-secondary-300"
                    >
                        Clear search
                    </button>
                {:else}
                    <p class="text-3xl">📝</p>
                    <p class="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        No drafts
                    </p>
                    <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-500">
                        Documents you upload before sending them to a package appear here.
                    </p>
                    <a
                        href={resolve("doc/new")}
                        class="mt-4 inline-block text-sm font-semibold text-secondary-600 transition hover:text-secondary-500 dark:text-secondary-400 dark:hover:text-secondary-300"
                    >
                        Upload a document →
                    </a>
                {/if}
            </div>
        {:else}
            <div
                class="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/60"
            >
                <div class="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                    {#each data.drafts as draft (draft.id)}
                        <div
                            class="flex items-center gap-3 px-5 py-3 text-sm text-neutral-700 dark:text-neutral-300"
                        >
                            <span
                                class="size-1.5 shrink-0 rounded-full {statusStyle[draft.status]
                                    .dot}"
                            ></span>
                            <span class="min-w-0 truncate font-medium">{draft.title}</span>
                            <span
                                class="hidden shrink-0 text-xs text-neutral-400 sm:inline dark:text-neutral-500"
                            >
                                {draft.pageCount}
                                {draft.pageCount === 1 ? "page" : "pages"} ·
                                {formatSize(draft.fileSize)} · Updated {fmtDate(draft.updatedAt)}
                            </span>
                            <span
                                class="ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold {statusStyle[
                                    draft.status
                                ].badge}"
                            >
                                {statusLabel[draft.status] ?? "Draft"}
                            </span>
                            <a
                                href={resolve("doc/new")}
                                class="shrink-0 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:text-neutral-100"
                            >
                                Send
                            </a>
                        </div>
                    {/each}
                </div>
            </div>

            {#if data.draftTotal > data.pageSize}
                <nav
                    class="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm"
                    aria-label="Pagination"
                >
                    <span class="text-neutral-600 dark:text-neutral-400">
                        Showing {draftStart}–{draftEnd} of {data.draftTotal}
                    </span>
                    <div class="flex gap-2">
                        <button
                            type="button"
                            disabled={data.page <= 1}
                            onclick={() => navigate({ page: String(data.page - 1) }, false)}
                            class="rounded-lg border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:text-neutral-100"
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            disabled={!data.hasMoreEnvelopes && draftEnd >= data.draftTotal}
                            onclick={() => navigate({ page: String(data.page + 1) }, false)}
                            class="rounded-lg border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:text-neutral-100"
                        >
                            Next
                        </button>
                    </div>
                </nav>
            {/if}
        {/if}
    {/if}
</div>
