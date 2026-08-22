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
    >Checkbox</span
>
<div class="px-1 pb-1">
    <span class="mb-0.5 block text-[11px] font-medium text-neutral-500 dark:text-neutral-400"
        >Label</span
    >
    <input
        type="text"
        placeholder="e.g. I agree to the terms"
        class="w-full min-w-0 rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
        bind:value={box.label}
        oninput={() => onchange(box)}
        onblur={normalizeLabel}
    />
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
    Required — signer must tick this
</label>
