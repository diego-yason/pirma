<script lang="ts">
    import type { PlacedRect } from "../../types/SignatureBoxTypes";

    let {
        box,
        boxes = [],
        onchange,
    }: {
        /** The placed box being edited (mutated in place — reactive). */
        box: PlacedRect;
        /** All placed boxes in the document (used to suggest existing groups). */
        boxes?: PlacedRect[];
        /** Called after any change so the parent can persist/sync. */
        onchange: (box: PlacedRect) => void;
    } = $props();

    // Existing radio groups in this document (excluding this box's current group).
    let existingGroups = $derived(
        [...new Set((boxes ?? []).map((b) => b.radioGroup).filter((g): g is string => !!g))].filter(
            (g) => g !== box.radioGroup,
        ),
    );

    function setGroup(group: string) {
        box.radioGroup = group.trim() || undefined;
        onchange(box);
    }

    function normalizeLabel() {
        const v = box.label?.trim();
        box.label = v || undefined;
        onchange(box);
    }

    function toggleRequired() {
        box.required = !box.required;
        onchange(box);
    }
</script>

<span
    class="block shrink-0 px-1 py-0.5 text-xs text-neutral-400 uppercase tracking-wider"
    >Radio</span
>
<div class="px-1 pb-1">
    <span class="mb-0.5 block text-[11px] font-medium text-neutral-500 dark:text-neutral-400"
        >Label</span
    >
    <input
        type="text"
        placeholder="e.g. Yes / No / Option text"
        class="w-full min-w-0 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
        bind:value={box.label}
        oninput={() => onchange(box)}
        onblur={normalizeLabel}
    />
</div>
<div class="px-1 pb-1">
    <span class="mb-0.5 block text-[11px] font-medium text-neutral-500 dark:text-neutral-400"
        >Group</span
    >
    <input
        type="text"
        placeholder="e.g. Delivery Method"
        class="w-full min-w-0 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
        bind:value={box.radioGroup}
        oninput={() => onchange(box)}
        onblur={() => setGroup(box.radioGroup ?? "")}
    />
    {#if existingGroups.length > 0}
        <div class="mt-1 flex flex-wrap gap-1">
            {#each existingGroups as g (g)}
                <button
                    type="button"
                    class="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-600 transition hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-violet-500/50 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
                    onclick={() => setGroup(g)}
                >
                    {g}
                </button>
            {/each}
        </div>
    {/if}
    <p class="pt-0.5 text-[10px] text-neutral-400">
        Radios in the same group are mutually exclusive — the signer picks one.
    </p>
</div>
<label
    class="flex items-center gap-2 px-1 py-1 text-sm text-neutral-700 dark:text-neutral-200"
>
    <input
        type="checkbox"
        class="size-4 rounded border-neutral-300 text-secondary-600 focus:ring-secondary-500/20 dark:border-neutral-700"
        checked={box.required ?? false}
        onchange={toggleRequired}
    />
    Required — signer must pick one in this group
</label>
