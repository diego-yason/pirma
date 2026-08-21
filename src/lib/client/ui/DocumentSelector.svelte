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
    class="flex w-56 shrink-0 flex-col gap-2 border-r border-neutral-200 bg-white/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/40"
>
    <span
        class="flex items-center gap-1.5 text-xs font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400"
    >
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="size-3.5"
        >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
            ></path>
        </svg>
        Documents
        {#if documents.length > 0}
            <span
                class="rounded-full bg-secondary-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-secondary-600 dark:text-secondary-300"
            >
                {documents.length}
            </span>
        {/if}
    </span>
    {#if documents.length > 0}
        {#each documents as doc (doc.url)}
            {@const index = documents.findIndex((d) => d.url === doc.url)}
            {@const active = selected === index}
            <button
                type="button"
                class="flex w-full items-center gap-2 truncate rounded-lg px-2.5 py-2 text-left text-sm transition
                    {active
                    ? 'bg-secondary-500/15 font-medium text-secondary-700 dark:bg-secondary-500/10 dark:text-secondary-300'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white'}"
                onclick={() => (selected = index)}
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    class="size-4 shrink-0 {active
                        ? 'text-secondary-600 dark:text-secondary-400'
                        : 'text-neutral-400 dark:text-neutral-500'}"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
                    ></path>
                </svg>
                <span class="truncate">{doc.title}</span>
            </button>
        {/each}
    {:else}
        <p class="text-xs text-neutral-500 italic dark:text-neutral-400">No documents</p>
    {/if}
</div>
