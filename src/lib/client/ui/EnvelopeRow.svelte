<script lang="ts">
    import { resolve } from "$app/paths";
    import {
        envelopeStatus,
        fmtDate,
        signatureProgress,
        statusLabel,
        statusStyle,
    } from "./envelopeStatus.js";

    interface EnvelopeDoc {
        id: string;
        title: string;
        status: string;
        updatedAt?: string | null;
    }

    interface Props {
        pkg: {
            id: string;
            name: string;
            documents: EnvelopeDoc[];
            signedCount: number;
            totalSignatures: number;
            needsMe: boolean;
            expirationDate?: string | null;
            updatedAt?: string | null;
        };
    }

    let { pkg }: Props = $props();

    const st = $derived(envelopeStatus(pkg.documents));
    const prog = $derived(signatureProgress(pkg.signedCount, pkg.totalSignatures));
    const overdue = $derived(
        pkg.expirationDate != null && new Date(pkg.expirationDate).getTime() < Date.now(),
    );

    // Lightweight kebab menu: close on outside pointerdown.
    let menuOpen = $state(false);
    let menuRef = $state<HTMLElement | undefined>();

    $effect(() => {
        if (!menuOpen) return;
        function onPointerDown(event: PointerEvent) {
            if (menuRef && !menuRef.contains(event.target as Node)) {
                menuOpen = false;
            }
        }
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    });
</script>

<div
    class="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white px-5 py-4 transition hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-neutral-700"
>
    <!-- Document icon -->
    <span
        class="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
    >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-5">
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
            ></path>
        </svg>
    </span>

    <!-- Name + meta + progress -->
    <div class="min-w-0 grow">
        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <a
                href={resolve(`doc/${pkg.id}`)}
                class="truncate text-sm font-semibold text-neutral-900 transition hover:text-secondary-600 dark:text-neutral-100 dark:hover:text-secondary-400"
            >
                {pkg.name}
            </a>
            {#if pkg.needsMe}
                <span
                    class="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary-500/15 px-2 py-0.5 text-[11px] font-semibold text-secondary-700 dark:text-secondary-300"
                >
                    <span class="size-1.5 rounded-full bg-secondary-500"></span>
                    Needs me
                </span>
            {/if}
        </div>

        <p class="mt-0.5 truncate text-xs text-neutral-600 dark:text-neutral-500">
            {pkg.documents.length}
            {pkg.documents.length === 1 ? "document" : "documents"} · Updated
            {fmtDate(pkg.updatedAt)}
            {#if pkg.expirationDate}
                · Due {fmtDate(pkg.expirationDate)}{overdue ? " (overdue)" : ""}
            {/if}
        </p>

        <!-- Signature progress -->
        <div class="mt-2 max-w-xs">
            <div
                class="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400"
            >
                <span>Signature progress</span>
                <span class="tabular-nums">{prog.signed}/{prog.total} signed</span>
            </div>
            <div
                class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
            >
                <div
                    class="h-full rounded-full transition-all {statusStyle[st].bar}"
                    style="width: {prog.pct}%"
                ></div>
            </div>
        </div>
    </div>

    <!-- Status badge -->
    <span
        class="hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-block {statusStyle[
            st
        ].badge}"
    >
        {statusLabel[st]}
    </span>

    <!-- Row actions (kebab menu) -->
    <div class="relative shrink-0">
        <button
            type="button"
            aria-label={`Actions for ${pkg.name}`}
            aria-expanded={menuOpen}
            class="grid size-8 place-items-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            onclick={() => (menuOpen = !menuOpen)}
        >
            <svg viewBox="0 0 24 24" fill="currentColor" class="size-4">
                <circle cx="5" cy="12" r="1.6"></circle>
                <circle cx="12" cy="12" r="1.6"></circle>
                <circle cx="19" cy="12" r="1.6"></circle>
            </svg>
        </button>

        {#if menuOpen}
            <div
                bind:this={menuRef}
                class="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
            >
                {#if pkg.needsMe}
                    <a
                        href={resolve(`doc/${pkg.id}/sign`)}
                        class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                        onclick={() => (menuOpen = false)}
                    >
                        Sign
                    </a>
                {/if}
                <a
                    href={resolve(`doc/${pkg.id}/view`)}
                    class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    onclick={() => (menuOpen = false)}
                >
                    View
                </a>
            </div>
        {/if}
    </div>
</div>
