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

<div class="mt-16 ml-5">
    <h1 class="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        Upload and Prepare
    </h1>
    <p class="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
        Begin your document for signing by selecting a template or uploading a new file.
    </p>
</div>

{#snippet step(number, name, state)}
    {@const done = state === "done"}
    {@const active = state === "active"}
    <span class="relative shrink-0 first:ml-2.5 last:mr-0.5">
        <span
            class="grid h-8 w-8 place-items-center rounded-full border text-sm font-semibold transition
                {done
                ? 'border-transparent bg-linear-to-r from-secondary-600 to-primary-700 text-white'
                : active
                  ? 'border-transparent bg-linear-to-r from-secondary-600 to-primary-700 text-white shadow-md shadow-secondary-600/30'
                  : 'border-neutral-300 bg-white text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400'}"
        >
            {#if done}
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    class="size-4"
                >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path>
                </svg>
            {:else}
                {number}
            {/if}
        </span>
        <span
            class="absolute top-full left-1/2 mt-1.5 -translate-x-1/2 text-xs whitespace-nowrap
                {active
                ? 'font-semibold text-secondary-600 dark:text-secondary-400'
                : done
                  ? 'text-neutral-700 dark:text-neutral-200'
                  : 'text-neutral-500 dark:text-neutral-500'}"
        >
            {name}
        </span>
    </span>
{/snippet}

{#snippet line(done)}
    <div
        class="h-0.5 flex-1 self-center rounded-full {done
            ? 'bg-linear-to-r from-secondary-600 to-primary-700'
            : 'bg-neutral-200 dark:bg-neutral-800'}"
    ></div>
{/snippet}

<div class="mt-6 mb-10 ml-5 w-[75%]">
    <div class="flex items-center gap-1">
        {#each STEPS as s, i (s.number)}
            {@const state =
                currentStep > s.number ? "done" : currentStep === s.number ? "active" : "todo"}
            {@render step(s.number, s.name, state)}
            {#if i < STEPS.length - 1}
                {@render line(currentStep > s.number)}
            {/if}
        {/each}
    </div>
</div>

{@render children()}
