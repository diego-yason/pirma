<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { deserialize } from "$app/forms";
    import type { PageProps } from "./$types";
    import { fmtDate } from "#lib/client/ui/envelopeStatus.js";

    let { data }: PageProps = $props();

    interface TemplateItem {
        id: string;
        name: string;
        documentId: string;
        pageCount: number;
        fileSize: number;
        useCount: number;
        lastUsedAt: string | null;
        createdAt: string;
        previewUrl: string;
    }

    const templates = $derived(data.templates as TemplateItem[]);

    let uploading = $state(false);
    let uploadError = $state("");

    let previewing = $state<TemplateItem | null>(null);
    let renaming = $state<TemplateItem | null>(null);
    let renameValue = $state("");
    let renameError = $state("");
    let renameBusy = $state(false);
    let deleting = $state<TemplateItem | null>(null);
    let deleteBusy = $state(false);

    function formatSize(bytes: number): string {
        if (bytes == null || bytes < 0) return "";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    async function handleUpload(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;

        uploading = true;
        uploadError = "";
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("name", file.name.replace(/\.(pdf|jpe?g|png)$/i, ""));
            const res = await fetch("/templates?/uploadTemplate", {
                method: "POST",
                body: formData,
                headers: { "x-sveltekit-action": "true" },
            });
            const result = deserialize(await res.text());
            if (result.type === "success") {
                await invalidateAll();
            } else {
                uploadError =
                    result.type === "failure"
                        ? (result.data as { error?: string } | undefined)?.error ??
                          "Upload failed. Please try again."
                        : "Upload failed. Please try again.";
            }
        } catch (err) {
            uploadError = err instanceof Error ? err.message : "Upload failed. Please try again.";
        } finally {
            uploading = false;
        }
    }

    function openRename(item: TemplateItem) {
        renaming = item;
        renameValue = item.name;
        renameError = "";
    }

    async function handleRename() {
        if (!renaming || !renameValue.trim() || renameBusy) return;
        renameBusy = true;
        renameError = "";
        try {
            const res = await fetch("/templates?/renameTemplate", {
                method: "POST",
                headers: { "x-sveltekit-action": "true" },
                body: new URLSearchParams({ templateId: renaming.id, name: renameValue.trim() }),
            });
            const result = deserialize(await res.text());
            if (result.type === "success") {
                renaming = null;
                await invalidateAll();
            } else {
                renameError =
                    result.type === "failure"
                        ? (result.data as { error?: string } | undefined)?.error ??
                          "Rename failed."
                        : "Rename failed.";
            }
        } catch (err) {
            renameError = err instanceof Error ? err.message : "Rename failed.";
        } finally {
            renameBusy = false;
        }
    }

    async function handleDelete() {
        if (!deleting || deleteBusy) return;
        deleteBusy = true;
        try {
            const res = await fetch("/templates?/deleteTemplate", {
                method: "POST",
                headers: { "x-sveltekit-action": "true" },
                body: new URLSearchParams({ templateId: deleting.id }),
            });
            const result = deserialize(await res.text());
            if (result.type === "success") {
                deleting = null;
                await invalidateAll();
            }
        } finally {
            deleteBusy = false;
        }
    }
</script>

<div class="mx-auto max-w-5xl px-6 py-8 lg:px-10">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
            <h1
                class="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-neutral-50"
            >
                Templates
            </h1>
            <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                {templates.length} {templates.length === 1 ? "template" : "templates"} · Start a
                new document from a saved template
            </p>
        </div>
        <button
            type="button"
            onclick={() => document.getElementById("templateFileInput")?.click()}
            disabled={uploading}
            class="inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-secondary-600 to-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-secondary-500 hover:to-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
            {#if uploading}
                <span class="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
                Uploading…
            {:else}
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    class="size-4"
                >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"></path>
                </svg>
                Upload template
            {/if}
        </button>
        <input
            id="templateFileInput"
            type="file"
            class="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
            onchange={handleUpload}
        />
    </div>

    {#if uploadError}
        <p class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
            {uploadError}
        </p>
    {/if}

    <!-- Grid -->
    {#if templates.length === 0}
        <div
            class="mt-6 rounded-xl border border-dashed border-neutral-300 bg-neutral-100/50 px-6 py-16 text-center dark:border-neutral-800 dark:bg-neutral-900/30"
        >
            <p class="text-3xl">📋</p>
            <p class="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                No templates yet
            </p>
            <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-500">
                Upload a PDF (or mark an existing document) to reuse it as a starting point.
            </p>
            <button
                type="button"
                onclick={() => document.getElementById("templateFileInput")?.click()}
                class="mt-4 inline-block text-sm font-semibold text-secondary-600 transition hover:text-secondary-500 dark:text-secondary-400 dark:hover:text-secondary-300"
            >
                Upload a template →
            </button>
        </div>
    {:else}
        <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {#each templates as item (item.id)}
                <div
                    class="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:border-secondary-500/50 hover:shadow-md hover:shadow-secondary-500/5 dark:border-neutral-800 dark:bg-neutral-900/60"
                >
                    <!-- Thumbnail / preview -->
                    <button
                        type="button"
                        class="relative flex aspect-4/3 items-center justify-center bg-linear-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900"
                        onclick={() => (previewing = item)}
                        aria-label={`Preview ${item.name}`}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            class="size-10 text-neutral-400 transition group-hover:text-secondary-500 dark:text-neutral-500 dark:group-hover:text-secondary-400"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
                            ></path>
                        </svg>
                        <span
                            class="absolute right-1.5 bottom-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white"
                        >
                            {item.pageCount} {item.pageCount === 1 ? "page" : "pages"}
                        </span>
                    </button>

                    <!-- Meta -->
                    <div class="flex flex-1 flex-col px-3 py-2.5">
                        <p
                            class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-50"
                        >
                            {item.name}
                        </p>
                        <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                            Used {item.useCount} {item.useCount === 1 ? "time" : "times"}
                            {#if item.lastUsedAt}
                                · Last used {fmtDate(item.lastUsedAt)}
                            {/if}
                        </p>
                        <p class="text-xs text-neutral-400 dark:text-neutral-500">
                            Created {fmtDate(item.createdAt)} · {formatSize(item.fileSize)}
                        </p>

                        <div class="mt-3 flex flex-wrap items-center gap-1.5">
                            <form method="POST" action="?/startFromTemplate" class="flex-1">
                                <input type="hidden" name="templateId" value={item.id} />
                                <button
                                    type="submit"
                                    class="w-full rounded-lg bg-linear-to-r from-secondary-600 to-primary-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-secondary-500 hover:to-primary-600"
                                >
                                    Use template
                                </button>
                            </form>
                            <a
                                href={`/templates/${item.id}`}
                                class="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:text-neutral-100"
                            >
                                Edit
                            </a>
                            <button
                                type="button"
                                class="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:text-neutral-100"
                                onclick={() => (previewing = item)}
                            >
                                Preview
                            </button>
                            <button
                                type="button"
                                class="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:text-neutral-100"
                                onclick={() => openRename(item)}
                            >
                                Rename
                            </button>
                            <button
                                type="button"
                                class="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-700 dark:border-neutral-700 dark:text-red-400 dark:hover:text-red-300"
                                onclick={() => (deleting = item)}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>

<!-- Preview modal -->
{#if previewing}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${previewing.name}`}
        onclick={(e) => {
            if (e.target === e.currentTarget) previewing = null;
        }}
        onkeydown={(e) => e.key === "Escape" && (previewing = null)}
        tabindex="-1"
    >
        <div
            class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-neutral-900"
        >
            <div
                class="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800"
            >
                <h2 class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                    {previewing.name}
                </h2>
                <button
                    type="button"
                    class="grid size-8 place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                    onclick={() => (previewing = null)}
                    aria-label="Close preview"
                >
                    ✕
                </button>
            </div>
            <div class="min-h-0 flex-1 bg-neutral-100 dark:bg-neutral-950">
                {#if previewing.previewUrl}
                    <iframe
                        src={previewing.previewUrl}
                        title={`Preview of ${previewing.name}`}
                        class="h-[70vh] w-full"
                    ></iframe>
                {:else}
                    <div class="grid h-[70vh] place-items-center text-sm text-neutral-500">
                        Preview unavailable
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}

<!-- Rename modal -->
{#if renaming}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Rename template"
        onclick={(e) => {
            if (e.target === e.currentTarget) renaming = null;
        }}
        onkeydown={(e) => e.key === "Escape" && (renaming = null)}
        tabindex="-1"
    >
        <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-neutral-900">
            <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                Rename template
            </h2>
            <label
                for="rename-template-input"
                class="mt-4 mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                >Name</label
            >
            <input
                id="rename-template-input"
                type="text"
                bind:value={renameValue}
                placeholder="Template name"
                class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                onkeydown={(e) => e.key === "Enter" && handleRename()}
            />
            {#if renameError}
                <p class="mt-2 text-sm text-red-600 dark:text-red-400">{renameError}</p>
            {/if}
            <div class="mt-5 flex justify-end gap-2">
                <button
                    type="button"
                    class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    onclick={() => (renaming = null)}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="rounded-lg bg-linear-to-r from-secondary-600 to-primary-700 px-4 py-2 text-sm font-semibold text-white transition hover:from-secondary-500 hover:to-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={renameBusy || !renameValue.trim()}
                    onclick={handleRename}
                >
                    {renameBusy ? "Saving…" : "Save"}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Delete confirm -->
{#if deleting}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Delete template"
        onclick={(e) => {
            if (e.target === e.currentTarget) deleting = null;
        }}
        onkeydown={(e) => e.key === "Escape" && (deleting = null)}
        tabindex="-1"
    >
        <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-neutral-900">
            <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                Delete template?
            </h2>
            <p class="mt-2 text-sm text-neutral-600 dark:text-neutral-500">
                "{deleting.name}" will be removed. Existing documents created from it are not
                affected.
            </p>
            <div class="mt-5 flex justify-end gap-2">
                <button
                    type="button"
                    class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    onclick={() => (deleting = null)}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={deleteBusy}
                    onclick={handleDelete}
                >
                    {deleteBusy ? "Deleting…" : "Delete"}
                </button>
            </div>
        </div>
    </div>
{/if}
