<script lang="ts">
    import type { PlacedRect } from "../../types/SignatureBoxTypes";

    let {
        box,
        onchange,
    }: {
        /** The placed box being edited (mutated in place — reactive). */
        box: PlacedRect;
        /** Called after any change so the parent can persist/sync. */
        onchange: (box: PlacedRect) => void;
    } = $props();

    function addChoice() {
        if (!box.choices) box.choices = [];
        if (box.choices.length >= 20) return;
        box.choices.push(`Option ${box.choices.length + 1}`);
        onchange(box);
    }

    function removeChoice(index: number) {
        if (!box.choices) return;
        box.choices.splice(index, 1);
        onchange(box);
    }

    function handleInput() {
        onchange(box);
    }
</script>

<span
    class="block shrink-0 px-1 py-0.5 text-xs text-neutral-400 uppercase tracking-wider"
    >Choices</span
>
<div class="flex max-h-36 flex-col gap-1 overflow-y-auto py-1">
    {#each box.choices ?? [] as _, i (i)}
        <div class="flex items-center gap-1">
            <input
                type="text"
                placeholder="e.g. 'Yes'"
                class="w-full min-w-0 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                bind:value={box.choices![i]}
                oninput={handleInput}
            />
            <button
                type="button"
                class="shrink-0 rounded p-1 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                onclick={() => removeChoice(i)}
                aria-label="Remove choice"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-3.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    {/each}
</div>
{#if (box.choices?.length ?? 0) < 20}
    <button
        type="button"
        class="flex w-full items-center justify-center gap-1 rounded px-2 py-1 text-xs font-medium text-secondary-600 transition hover:bg-secondary-500/10 dark:text-secondary-300 dark:hover:bg-secondary-500/15"
        onclick={addChoice}
    >
        + Add choice
    </button>
{/if}
<p class="px-1 pt-0.5 text-[10px] text-neutral-400">
    A list of choices the signer can pick from (e.g. shown as a dropdown).
</p>
