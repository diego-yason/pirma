<script lang="ts">
    import type { PlacedRect } from "../../types/SignatureBoxTypes";
    import { fieldToolFor } from "../../types/field-tools.js";

    let {
        box,
        onchange,
    }: {
        /** The placed box being edited (mutated in place — reactive). */
        box: PlacedRect;
        /** Called after any change so the parent can persist/sync. */
        onchange: (box: PlacedRect) => void;
    } = $props();

    // Phone is "a text field with a validator" — the rule lives on the registry.
    const validation = fieldToolFor("phone").validation;

    function toggleRequired() {
        box.required = !box.required;
        onchange(box);
    }
</script>

<span
    class="block shrink-0 px-1 py-0.5 text-xs text-neutral-400 uppercase tracking-wider"
    >Phone Field</span
>
<label
    class="flex items-center gap-2 px-1 py-1 text-sm text-neutral-700 dark:text-neutral-200"
>
    <input
        type="checkbox"
        class="size-4 rounded border-neutral-300 text-secondary-600 focus:ring-secondary-500/20 dark:border-neutral-700"
        checked={box.required ?? false}
        onchange={toggleRequired}
    />
    Required — signer must fill this in
</label>
{#if validation}
    <p class="px-1 pt-0.5 text-[10px] text-neutral-400">
        Validated as a phone number
        {#if validation.hint}(e.g. {validation.hint}){/if}.
    </p>
{/if}
