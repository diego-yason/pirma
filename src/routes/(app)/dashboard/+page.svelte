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

    /** Visual treatment per document/envelope status. */
    const statusStyle: Record<string, { badge: string; dot: string; bar: string; text: string }> = {
        draft: {
            badge: "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
            dot: "bg-neutral-400",
            bar: "bg-neutral-400",
            text: "text-neutral-500 dark:text-neutral-400",
        },
        finalized: {
            badge: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
            dot: "bg-amber-500 dark:bg-amber-400",
            bar: "bg-amber-500",
            text: "text-amber-600 dark:text-amber-300",
        },
        executed: {
            badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
            dot: "bg-emerald-500 dark:bg-emerald-400",
            bar: "bg-emerald-500",
            text: "text-emerald-600 dark:text-emerald-300",
        },
    };

    type EnvStatus = "draft" | "finalized" | "executed";
    /** Aggregate a package's documents into one envelope status. */
    function envelopeStatus(docs: { status: string }[]): EnvStatus {
        if (docs.some((d) => d.status === "draft")) return "draft";
        if (docs.every((d) => d.status === "executed")) return "executed";
        return "finalized";
    }

    /** Signature completion across the envelope's documents. */
    function envelopeProgress(docs: { status: string }[]) {
        const total = docs.length;
        const executed = docs.filter((d) => d.status === "executed").length;
        return { executed, total, pct: total ? Math.round((executed / total) * 100) : 0 };
    }

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
    <div class="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <a
            href="#waiting"
            class="group flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-secondary-500/50 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-secondary-500/40"
        >
            <span
                class="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    class="size-5"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    ></path>
                </svg>
            </span>
            <div class="min-w-0">
                <p class="text-3xl leading-none font-bold text-neutral-900 dark:text-neutral-50">
                    {pendingCount}
                </p>
                <p
                    class="mt-1.5 truncate text-sm font-medium text-neutral-500 dark:text-neutral-400"
                >
                    Waiting for you
                </p>
            </div>
        </a>
        <div
            class="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/60"
        >
            <span
                class="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    class="size-5"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9 12l2 2 4-4m5-1a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    ></path>
                </svg>
            </span>
            <div class="min-w-0">
                <p class="text-3xl leading-none font-bold text-neutral-900 dark:text-neutral-50">
                    {completedCount}
                </p>
                <p
                    class="mt-1.5 truncate text-sm font-medium text-neutral-500 dark:text-neutral-400"
                >
                    Completed
                </p>
            </div>
        </div>
        <div
            class="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/60"
        >
            <span
                class="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary-500/15 text-secondary-600 dark:text-secondary-400"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    class="size-5"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
                    ></path>
                </svg>
            </span>
            <div class="min-w-0">
                <p class="text-3xl leading-none font-bold text-neutral-900 dark:text-neutral-50">
                    {recentCount}
                </p>
                <p
                    class="mt-1.5 truncate text-sm font-medium text-neutral-500 dark:text-neutral-400"
                >
                    Recent envelopes
                </p>
            </div>
        </div>
        <div
            class="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/60"
        >
            <span
                class="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    class="size-5"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m6-1.13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-5-1a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
                    ></path>
                </svg>
            </span>
            <div class="min-w-0">
                <p class="text-3xl leading-none font-bold text-neutral-900 dark:text-neutral-50">
                    {viewableCount}
                </p>
                <p
                    class="mt-1.5 truncate text-sm font-medium text-neutral-500 dark:text-neutral-400"
                >
                    Shared with you
                </p>
            </div>
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
            <div class="flex flex-col gap-4">
                {#each data.recentDocuments as pkg (pkg.id)}
                    {@const st = envelopeStatus(pkg.documents)}
                    {@const prog = envelopeProgress(pkg.documents)}
                    {@const firstDoc = pkg.documents[0]}
                    <div
                        class="overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-neutral-700"
                    >
                        <div class="flex items-center justify-between gap-3 px-5 py-4">
                            <div class="flex min-w-0 items-center gap-3">
                                <span
                                    class="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        class="size-5"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
                                        ></path>
                                    </svg>
                                </span>
                                <div class="min-w-0">
                                    <a
                                        href={resolve(`doc/${pkg.id}`)}
                                        class="block truncate text-sm font-semibold text-neutral-900 transition hover:text-secondary-600 dark:text-neutral-100 dark:hover:text-secondary-400"
                                    >
                                        {pkg.name}
                                    </a>
                                    <p
                                        class="mt-0.5 text-xs text-neutral-600 dark:text-neutral-500"
                                    >
                                        {pkg.documents.length}
                                        {pkg.documents.length !== 1 ? "documents" : "document"} · Updated
                                        {fmtDate(firstDoc?.updatedAt ?? firstDoc?.createdAt)}
                                    </p>
                                </div>
                            </div>
                            <span
                                class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold {statusStyle[
                                    st
                                ].badge}"
                            >
                                {statusLabel[st]}
                            </span>
                        </div>

                        <!-- Signature progress -->
                        <div class="px-5 pb-4">
                            <div
                                class="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400"
                            >
                                <span>Signature progress</span>
                                <span class="tabular-nums">{prog.executed}/{prog.total} signed</span
                                >
                            </div>
                            <div
                                class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
                            >
                                <div
                                    class="h-full rounded-full transition-all {statusStyle[st].bar}"
                                    style="width: {prog.pct}%"
                                ></div>
                            </div>
                        </div>

                        <!-- Documents -->
                        <div
                            class="divide-y divide-neutral-200/60 border-t border-neutral-200/60 bg-neutral-50/50 dark:divide-neutral-800/60 dark:border-neutral-800/60 dark:bg-neutral-950/40"
                        >
                            {#each pkg.documents as doc (doc.id)}
                                {@const dSt = doc.status}
                                <a
                                    href={doc.status === "draft"
                                        ? resolve(`doc/new/${pkg.id}`)
                                        : resolve(`doc/${pkg.id}`)}
                                    class="flex items-center gap-2.5 px-5 py-2.5 pl-8 text-sm text-neutral-700 transition hover:bg-neutral-200/50 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900/40 dark:hover:text-neutral-100"
                                >
                                    <span
                                        class="size-1.5 shrink-0 rounded-full {statusStyle[dSt]
                                            .dot}"
                                    ></span>
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
