<script lang="ts">
    let { active = false, onselect }: { active?: boolean; onselect?: (doc: RecentDoc) => void } =
        $props();

    interface RecentDoc {
        id: string;
        title: string;
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
</script>

<div class="space-y-2">
    {#if loading}
        <p class="text-sm text-neutral-500">Loading…</p>
    {:else if error}
        <p class="text-sm text-red-500">{error}</p>
    {:else if docs.length === 0}
        <p class="text-sm text-neutral-500">No recently uploaded documents.</p>
    {:else}
        {#each docs as doc (doc.id)}
            <button
                type="button"
                class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                onclick={() => onselect?.(doc)}
            >
                <span class="font-medium">{doc.title}</span>
            </button>
        {/each}
    {/if}
</div>
