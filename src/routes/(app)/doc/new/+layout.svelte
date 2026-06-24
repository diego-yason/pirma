<script lang="ts">
    // @ts-nocheck snippets lol

    import { setContext } from "svelte";
    import type { LayoutProps } from "./$types";

    let { children }: LayoutProps = $props();

    interface StepDefinition {
        number: number;
        name: string;
    }

    const STEPS: StepDefinition[] = [
        { number: 1, name: "Upload" },
        { number: 2, name: "Recipients & Fields" },
        // { number: 3, name: "Place Fields" },
        { number: 3, name: "Send" },
    ];

    let currentStep = $state(1);

    function setStep(n: number) {
        currentStep = n;
    }

    setContext("step", { setStep });
</script>

<h1 class="text-3xl ml-5 mt-16">Upload and Prepare</h1>
<p class="text-lg ml-5">
    Begin your document for signing by selecting a template or uploading a new file.
</p>

{#snippet step(number, name, active)}
    <span class="relative shrink-0 first:ml-2.5 last:mr-0.5">
        <span
            class="border rounded-lg w-8 h-8 flex items-center justify-center text-sm"
            class:bg-secondary-500={active}
            class:border-secondary-500={active}
        >
            {number}
        </span>
        <span
            class="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-center text-sm whitespace-nowrap"
            class:text-secondary-500={active}
            class:font-semibold={active}
        >
            {name}
        </span>
    </span>
{/snippet}

{#snippet line()}
    <div class="border-b border-gray-300 flex-1 h-0 self-center"></div>
{/snippet}

<div class="mt-4 mb-10 ml-5 w-[75%]">
    <div class="flex items-center gap-1">
        {#each STEPS as s, i (s.number)}
            {@render step(s.number, s.name, currentStep >= s.number)}
            {#if i < STEPS.length - 1}
                {@render line()}
            {/if}
        {/each}
    </div>
</div>

{@render children()}
