<script lang="ts">
    let { active = false, onselect }: { active?: boolean; onselect?: (doc: RecentDoc) => void } =
        $props();

    interface RecentDoc {
        id: string;
        title: string;
        pageCount?: number | null;
        fileSize?: number | null;
    }

    interface ListResponse {
        documents: RecentDoc[];
    }

    let docs = $state<RecentDoc[]>([]);
    let loading = $state(false);
    let error = $state("");
    let loaded = $state(false);

    $effect(() => {
        if (active) {
            loadDocs();
        }
    });

    async function loadDocs() {
        if (loaded || loading) return;
        loading = true;

        try {
            const res = await fetch("/doc/list");
            if (!res.ok) throw new Error("Failed to load recent uploads");

            const payload = (await res.json()) as ListResponse;
            docs = payload.documents ?? [];
            loaded = true;
        } catch (err) {
            error = err instanceof Error ? err.message : "Could not load recent uploads";
        } finally {
            loading = false;
        }
    }

    function formatSize(bytes?: number | null): string {
        if (bytes == null || bytes < 0) return "";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
</script>

<div>
    {#if loading}
        <p class="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
    {:else if error}
        <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
    {:else if docs.length === 0}
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
            No recently uploaded documents.
        </p>
    {:else}
        <div class="grid grid-cols-2 gap-3">
            {#each docs as doc (doc.id)}
                <button
                    type="button"
                    class="group overflow-hidden rounded-xl border border-neutral-200 bg-white text-left transition hover:border-secondary-500/50 hover:shadow-md hover:shadow-secondary-500/5 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                    onclick={() => onselect?.(doc)}
                >
                    <!-- Thumbnail placeholder -->
                    <div
                        class="relative flex aspect-4/3 items-center justify-center bg-linear-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            class="size-10 text-neutral-400 transition group-hover:text-secondary-500 dark:text-neutral-500 dark:group-hover:text-secondary-400"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
                            ></path>
                        </svg>
                        {#if doc.pageCount != null}
                            <span
                                class="absolute right-1.5 bottom-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white"
                            >
                                {doc.pageCount} pg
                            </span>
                        {/if}
                    </div>

                    <!-- Meta -->
                    <div class="px-2.5 py-2">
                        <p
                            class="truncate text-sm font-medium text-neutral-900 dark:text-neutral-50"
                        >
                            {doc.title}
                        </p>
                        <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                            {doc.pageCount != null
                                ? `${doc.pageCount} page${doc.pageCount !== 1 ? "s" : ""}`
                                : "Document"}
                            {#if formatSize(doc.fileSize)}
                                &middot; {formatSize(doc.fileSize)}
                            {/if}
                        </p>
                    </div>
                </button>
            {/each}
        </div>
    {/if}
</div>
