<script lang="ts">
    import { resolve } from "$app/paths";
    import { page } from "$app/state";
    import type { PageProps } from "./$types";
    import SignatureRequest from "./SignatureRequest.svelte";

    let { data }: PageProps = $props();

    const pendingCount = $derived(data.pendingPackages.length);
    const completedCount = $derived(data.completedDocuments.length);
    const recentCount = $derived(data.recentDocuments.length);
    const viewableCount = $derived(data.viewablePackages.length);
    const userName = $derived(page.data.user?.name?.split(" ")[0] ?? "there");

    const statusLabel: Record<string, string> = {
        draft: "Draft",
        finalized: "Awaiting Signatories",
        executed: "Executed",
    };

    function fmtDate(iso?: string | Date | null): string {
        if (!iso) return "";
        return new Date(iso).toLocaleDateString("en-SG", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    }
</script>

<div class="mx-auto max-w-5xl px-6 py-8 lg:px-10">
    <!-- Greeting -->
    <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
            <h1
                class="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-neutral-50"
            >
                Welcome back, {userName}
            </h1>
            <p class="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                Here's what needs your attention today.
            </p>
        </div>
        <a
            href={resolve("doc/new")}
            class="inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-secondary-600 to-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-secondary-500 hover:to-primary-600"
        >
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="size-4"
            >
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"></path>
            </svg>
            New Document
        </a>
    </div>

    <!-- Stat cards -->
    <div class="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <a
            href="#waiting"
            class="group rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-secondary-500/50 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:bg-neutral-900"
        >
            <div class="flex items-center justify-between">
                <p class="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                    Waiting for you
                </p>
                <span
                    class="grid size-8 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        class="size-4"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                        ></path>
                    </svg>
                </span>
            </div>
            <p class="mt-3 text-3xl font-bold text-neutral-900 dark:text-neutral-50">
                {pendingCount}
            </p>
        </a>
        <div
            class="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/60"
        >
            <div class="flex items-center justify-between">
                <p class="text-sm font-medium text-neutral-500 dark:text-neutral-400">Completed</p>
                <span
                    class="grid size-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        class="size-4"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M9 12l2 2 4-4m5-1a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                        ></path>
                    </svg>
                </span>
            </div>
            <p class="mt-3 text-3xl font-bold text-neutral-900 dark:text-neutral-50">
                {completedCount}
            </p>
        </div>
        <div
            class="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/60"
        >
            <div class="flex items-center justify-between">
                <p class="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                    Recent envelopes
                </p>
                <span
                    class="grid size-8 place-items-center rounded-lg bg-secondary-500/15 text-secondary-600 dark:text-secondary-400"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        class="size-4"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
                        ></path>
                    </svg>
                </span>
            </div>
            <p class="mt-3 text-3xl font-bold text-neutral-900 dark:text-neutral-50">
                {recentCount}
            </p>
        </div>
        <div
            class="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/60"
        >
            <div class="flex items-center justify-between">
                <p class="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                    Shared with you
                </p>
                <span
                    class="grid size-8 place-items-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        class="size-4"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m6-1.13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-5-1a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
                        ></path>
                    </svg>
                </span>
            </div>
            <p class="mt-3 text-3xl font-bold text-neutral-900 dark:text-neutral-50">
                {viewableCount}
            </p>
        </div>
    </div>

    <!-- Waiting for You -->
    <section id="waiting" class="mt-10">
        <div class="mb-4 flex items-center justify-between">
            <div>
                <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                    Waiting for You
                </h2>
                <p class="text-sm text-neutral-600 dark:text-neutral-500">
                    Packages that need your review and signature.
                </p>
            </div>
        </div>

        <div class="flex flex-col gap-3">
            {#each data.pendingPackages as pkg (pkg.id)}
                {@const due = data.expirationDates.get(pkg.id)}
                {@const owner = data.ownerInfo.get(pkg.id)}
                <SignatureRequest
                    title={pkg.name}
                    flags={due ? ["due-soon"] : []}
                    dueDate={due ?? undefined}
                    from={owner?.name}
                    fromEmail={owner?.email}
                    docCount={pkg.docCount}
                    href={resolve(`doc/${pkg.id}`)}
                />
            {/each}
            {#if pendingCount === 0}
                <div
                    class="rounded-xl border border-dashed border-neutral-300 bg-neutral-100/50 px-6 py-12 text-center dark:border-neutral-800 dark:bg-neutral-900/30"
                >
                    <p class="text-3xl">🎉</p>
                    <p class="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        You're all caught up!
                    </p>
                    <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-500">
                        No packages are waiting for your signature right now.
                    </p>
                </div>
            {/if}
        </div>
    </section>

    <!-- Recent Envelopes -->
    <section class="mt-10">
        <div class="mb-4 flex items-center justify-between">
            <div>
                <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                    Recent Envelopes
                </h2>
                <p class="text-sm text-neutral-600 dark:text-neutral-500">
                    Documents you've sent or are working on.
                </p>
            </div>
            <a
                href={resolve("doc/list")}
                class="text-sm font-medium text-secondary-600 transition hover:text-secondary-500 dark:text-secondary-400 dark:hover:text-secondary-300"
            >
                View all →
            </a>
        </div>

        {#if data.recentDocuments.length === 0}
            <div
                class="rounded-xl border border-dashed border-neutral-300 bg-neutral-100/50 px-6 py-12 text-center dark:border-neutral-800 dark:bg-neutral-900/30"
            >
                <p class="text-2xl">📄</p>
                <p class="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    No envelopes yet
                </p>
                <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-500">
                    Upload your first document to get started.
                </p>
                <a
                    href={resolve("doc/new")}
                    class="mt-4 inline-block text-sm font-semibold text-secondary-600 transition hover:text-secondary-500 dark:text-secondary-400 dark:hover:text-secondary-300"
                >
                    Upload a document →
                </a>
            </div>
        {:else}
            <div
                class="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800"
            >
                {#each data.recentDocuments as pkg, i (pkg.id)}
                    <div
                        class="border-b border-neutral-200 last:border-b-0 dark:border-neutral-800"
                    >
                        <div
                            class="flex items-center justify-between gap-3 bg-neutral-50 px-5 py-3.5 dark:bg-neutral-900/60"
                        >
                            <div class="min-w-0 flex-1">
                                <p
                                    class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100"
                                >
                                    {pkg.name}
                                </p>
                                <p class="mt-0.5 text-xs text-neutral-600 dark:text-neutral-500">
                                    {pkg.documents.length} doc{pkg.documents.length !== 1
                                        ? "s"
                                        : ""}
                                    · Updated {fmtDate(pkg.documents[0]?.updatedAt)}
                                </p>
                            </div>
                            <div class="flex shrink-0 items-center gap-3 text-xs">
                                {#if pkg.documents.some((d) => d.status === "draft")}
                                    <span
                                        class="rounded-full bg-neutral-200 px-2.5 py-1 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                                    >
                                        {statusLabel.draft}
                                    </span>
                                {:else if pkg.documents.every((d) => d.status === "executed")}
                                    <span
                                        class="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-600 dark:text-emerald-300"
                                    >
                                        {statusLabel.executed}
                                    </span>
                                {:else}
                                    <span
                                        class="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-600 dark:text-amber-300"
                                    >
                                        {statusLabel.finalized}
                                    </span>
                                {/if}
                                <a
                                    href={resolve(`doc/${pkg.id}`)}
                                    class="font-medium text-secondary-600 transition hover:text-secondary-500 hover:underline dark:text-secondary-400 dark:hover:text-secondary-300"
                                >
                                    View
                                </a>
                            </div>
                        </div>
                        <div
                            class="divide-y divide-neutral-200/60 bg-neutral-100/50 dark:divide-neutral-800/60 dark:bg-neutral-950/40"
                        >
                            {#each pkg.documents as doc (doc.id)}
                                <a
                                    href={doc.status === "draft"
                                        ? resolve(`doc/new/${pkg.id}`)
                                        : resolve(`doc/${pkg.id}`)}
                                    class="flex items-center gap-2.5 px-5 py-2.5 pl-8 text-sm text-neutral-700 transition hover:bg-neutral-200/50 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900/40 dark:hover:text-neutral-100"
                                >
                                    <span class="shrink-0 text-neutral-400 dark:text-neutral-600"
                                        >└─</span
                                    >
                                    <span class="truncate">{doc.title}</span>
                                    <span
                                        class="ml-auto shrink-0 text-xs text-neutral-400 dark:text-neutral-600"
                                    >
                                        {fmtDate(doc.updatedAt ?? doc.createdAt)}
                                    </span>
                                </a>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </section>
</div>
