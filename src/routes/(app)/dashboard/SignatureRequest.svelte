<script lang="ts">
    type Flag = "urgent" | "important" | "due-soon";

    interface Props {
        flags?: Flag[];
        title?: string;
        from?: string;
        fromEmail?: string;
        dueDate?: string;
        docCount?: number;
        href?: string;
    }

    let {
        flags = ["due-soon"],
        title = "Non-Disclosure Agreement (Q3 Project)",
        from = "Prima Corp Legal",
        fromEmail = "legal@example.com",
        dueDate = undefined,
        docCount = 1,
        href = undefined,
    }: Props = $props();

    const flagConfig: Record<Flag, { label: string; chip: string; dot: string }> = {
        urgent: {
            label: "URGENT",
            chip: "bg-red-500/15 text-red-600 dark:text-red-300",
            dot: "bg-red-500 dark:bg-red-400",
        },
        important: {
            label: "IMPORTANT",
            chip: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
            dot: "bg-amber-500 dark:bg-amber-400",
        },
        "due-soon": {
            label: "DUE SOON",
            chip: "bg-secondary-500/15 text-secondary-600 dark:text-secondary-300",
            dot: "bg-secondary-500 dark:bg-secondary-400",
        },
    };

    // Canonical display order — always show flags in this sequence
    const flagOrder: Flag[] = ["urgent", "important", "due-soon"];
    const sortedFlags = $derived(
        flags.toSorted((a, b) => flagOrder.indexOf(a) - flagOrder.indexOf(b)),
    );

    const cardColor: Record<Flag, string> = {
        urgent: "border-red-500/60",
        important: "border-amber-500/60",
        "due-soon": "border-secondary-500/60",
    };

    const leftBorder = $derived(
        sortedFlags.length > 0
            ? cardColor[sortedFlags[0]]
            : "border-neutral-300 dark:border-neutral-700",
    );

    const initial = $derived(((from ?? "?").trim().charAt(0) || "?").toUpperCase());
</script>

<div
    class="group flex items-center gap-4 rounded-xl border border-l-4 border-neutral-200 bg-white px-5 py-5 transition hover:border-neutral-300 hover:bg-neutral-50 {leftBorder} dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
>
    <span
        class="grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-br from-secondary-600 to-primary-700 text-base font-bold text-white shadow-sm"
        aria-hidden="true"
    >
        {initial}
    </span>

    <div class="min-w-0 grow">
        <div class="flex flex-wrap items-center gap-2.5">
            <p class="truncate text-base font-semibold text-neutral-900 dark:text-neutral-50">
                {title}
            </p>
            {#each sortedFlags as flag (flag)}
                <span
                    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold {flagConfig[
                        flag
                    ].chip}"
                >
                    <span class="size-1.5 rounded-full {flagConfig[flag].dot}"></span>
                    {flagConfig[flag].label}
                </span>
            {/each}
        </div>
        <p class="mt-1 truncate text-sm text-neutral-500 dark:text-neutral-400">
            From: <span class="font-medium text-neutral-700 dark:text-neutral-200">{from}</span>
            {#if fromEmail}&lt;{fromEmail}&gt;{/if}
        </p>
        <div
            class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-500"
        >
            {#if dueDate}
                <span
                    class="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 font-medium text-amber-700 dark:text-amber-300"
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
                            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                        ></path>
                    </svg>
                    Due {dueDate}
                </span>
            {/if}
            <span class="inline-flex items-center gap-1.5">
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"
                    ></path>
                </svg>
                {docCount} Document{docCount !== 1 ? "s" : ""}
            </span>
        </div>
    </div>

    {#if href}
        <a
            {href}
            class="shrink-0 rounded-lg bg-linear-to-r from-secondary-600 to-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-secondary-500 hover:to-primary-600"
        >
            Review &amp; Sign
        </a>
    {:else}
        <button
            type="button"
            class="shrink-0 cursor-pointer rounded-lg bg-linear-to-r from-secondary-600 to-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-secondary-500 hover:to-primary-600"
        >
            Review &amp; Sign
        </button>
    {/if}
</div>
