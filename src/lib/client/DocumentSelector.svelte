<script lang="ts">
    interface DocItem {
        url: string;
        title: string;
    }

    let {
        documents = [] as DocItem[],
        selected = $bindable(0),
    }: {
        documents?: DocItem[];
        selected?: number;
    } = $props();
</script>

<div
    class="shrink-0 w-48 border-r border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 p-3 flex flex-col gap-2"
>
    <span class="text-xs text-neutral-400 uppercase tracking-wider font-medium">Documents</span>
    {#if documents.length > 0}
        {#each documents as doc (doc.url)}
            {@const index = documents.findIndex((d) => d.url === doc.url)}
            <button
                type="button"
                class="w-full text-left px-2 py-1.5 text-sm rounded transition truncate"
                class:bg-blue-100={selected === index}
                class:text-blue-700={selected === index}
                class:dark:bg-blue-950={selected === index}
                class:dark:text-blue-300={selected === index}
                class:hover:bg-neutral-100={selected !== index}
                class:dark:hover:bg-neutral-800={selected !== index}
                onclick={() => (selected = index)}
            >
                {doc.title}
            </button>
        {/each}
    {:else}
        <p class="text-xs text-neutral-500 italic">No documents</p>
    {/if}
</div>
