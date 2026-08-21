<script lang="ts">
    import { getContext } from "svelte";
    import { PDFDocument } from "pdf-lib";
    import RecentlyUploaded from "./RecentlyUploaded.svelte";

    interface UploadedFile {
        id: string;
        file?: File;
        name: string;
        size?: string;
        type?: string;
        pageCount?: number;
        uploading?: boolean;
        uploaded?: boolean;
        error?: string;
        storagePath?: string;
    }

    let files = $state<UploadedFile[]>([]);
    let isDragOver = $state(false);
    let showRecentPopup = $state(false);
    let prefetchRecent = $state(false);

    $inspect(files);

    const { setStep } = getContext<{ setStep: (n: number) => void }>("step");
    $effect(() => {
        setStep(1);
    });

    const ACCEPTED_TYPES = ".pdf,.docx,.jpg,.jpeg,.png";

    function formatSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    async function addFiles(fileList: FileList) {
        for (const file of fileList) {
            const id = crypto.randomUUID();

            let pageCount: number | undefined;
            if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
                try {
                    pageCount = await getPages(file);
                } catch {
                    // ignore read errors
                }
            }

            files.push({
                id,
                file,
                name: file.name,
                size: formatSize(file.size),
                type: file.type || (file.name.split(".").pop()?.toUpperCase() ?? "FILE"),
                pageCount,
                uploading: true,
            });

            // Upload file → server → Supabase
            const formData = new FormData();
            formData.append("file", file);
            formData.append("title", file.name);
            if (pageCount != null) {
                formData.append("pageCount", String(pageCount));
            }

            try {
                const res = await fetch("/doc/new?/uploadFile", {
                    method: "POST",
                    body: formData,
                    headers: { "x-sveltekit-action": "true" },
                });
                const result = await res.json();
                const [, docId, storagePath] = JSON.parse(result.data);
                console.log(docId, storagePath);

                files = files.map((f) =>
                    f.id === id
                        ? {
                              ...f,
                              id: docId, // Update to document ID from server
                              uploading: false,
                              uploaded: docId != null,
                              error: result.error ?? undefined,
                              storagePath: storagePath ?? undefined,
                          }
                        : f,
                );
            } catch (err) {
                files = files.map((f) =>
                    f.id === id
                        ? {
                              ...f,
                              uploading: false,
                              error: err instanceof Error ? err.message : "Upload failed",
                          }
                        : f,
                );
            }
        }
    }

    function onFileChange(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files) {
            addFiles(input.files);
            input.value = "";
        }
    }

    async function removeFile(id: string) {
        const f = files.find((x) => x.id === id);

        // If the file was successfully uploaded (has a real document id), delete it
        // server-side too so it doesn't linger as an unused orphan in the database.
        if (f?.uploaded && f.id) {
            try {
                const res = await fetch("/doc/new?/removeFile", {
                    method: "POST",
                    headers: { "x-sveltekit-action": "true" },
                    body: new URLSearchParams({ docId: f.id }),
                });
                const result = await res.json();
                const payload = JSON.parse(result.data ?? "{}");
                if (!result.type || result.type !== "success" || payload.error) {
                    console.warn("[docNew] removeFile failed", payload.error);
                    return; // keep the row; server-side removal failed
                }
            } catch (err) {
                console.warn("[docNew] removeFile error", err);
                return;
            }
        }

        files = files.filter((x) => x.id !== id);
    }

    function addRecentDoc(doc: {
        id: string;
        title: string;
        pageCount?: number | null;
        fileSize?: number | null;
    }) {
        // Prevent duplicates
        if (files.some((f) => f.storagePath === doc.id)) return;

        files.push({
            id: doc.id,
            name: doc.title,
            type: "",
            size: doc.fileSize != null ? formatSize(doc.fileSize) : "",
            pageCount: doc.pageCount ?? undefined,
            uploaded: true,
            uploading: false,
            storagePath: doc.id,
        });

        showRecentPopup = false;
    }

    function onDragOver(e: DragEvent) {
        e.preventDefault();
        isDragOver = true;
    }

    function onDragLeave(e: DragEvent) {
        e.preventDefault();
        isDragOver = false;
    }

    function onDrop(e: DragEvent) {
        e.preventDefault();
        isDragOver = false;
        if (e.dataTransfer?.files) {
            addFiles(e.dataTransfer.files);
        }
    }

    async function getPages(file: File) {
        const buffer = await file.arrayBuffer();
        const doc = await PDFDocument.load(buffer);

        return doc.getPageCount();
    }
</script>

<!-- Upload and Template Selection -->
<div class="ml-5 flex w-3/4 gap-6">
    <!-- Upload area -->
    <div
        class="flex-1 rounded-xl border-2 border-dashed p-8 text-center transition-colors {isDragOver
            ? 'border-secondary-500 bg-secondary-500/5 dark:bg-secondary-500/10'
            : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900/40'}"
        role="region"
        aria-label="File drop zone"
        ondragover={onDragOver}
        ondragleave={onDragLeave}
        ondrop={onDrop}
    >
        <span
            class="mx-auto grid size-14 place-items-center rounded-2xl bg-linear-to-br from-secondary-500/15 to-primary-700/15 text-3xl"
        >
            📄
        </span>
        <h2 class="mt-4 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Upload Files
        </h2>
        <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            PDF, DOCX, JPG, or PNG files
        </p>
        <button
            type="button"
            class="mt-5 inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-secondary-600 to-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-secondary-500 hover:to-primary-600"
            onclick={(e) => {
                e.stopPropagation();
                document.getElementById("fileInput")?.click();
            }}
        >
            Browse Files
        </button>
        <button
            type="button"
            class="mt-3 text-sm font-medium text-secondary-600 underline underline-offset-2 transition hover:text-secondary-500 dark:text-secondary-400 dark:hover:text-secondary-300"
            onmouseenter={() => (prefetchRecent = true)}
            onclick={(e) => {
                e.stopPropagation();
                showRecentPopup = true;
            }}
        >
            or recently uploaded
        </button>
        <input
            id="fileInput"
            type="file"
            class="hidden"
            accept={ACCEPTED_TYPES}
            multiple
            onchange={onFileChange}
        />
    </div>

    <!-- Template -->
    <div
        class="flex flex-1 flex-col items-center rounded-xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900/60"
    >
        <span
            class="grid size-14 place-items-center rounded-2xl bg-neutral-100 text-3xl dark:bg-neutral-800"
        >
            📄
        </span>
        <h2 class="mt-4 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Use Template
        </h2>
        <p class="mt-1 mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            Standardized contracts
        </p>
        <button
            type="button"
            class="rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
            Select Template
        </button>
    </div>
</div>

<!-- Uploaded files list -->
<div
    class="mt-6 ml-5 w-3/4 rounded-xl border border-neutral-200 bg-white px-6 py-5 dark:border-neutral-800 dark:bg-neutral-900/40"
>
    <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Uploaded Files ({files.length})
        </h2>
        {#if files.length > 0}
            <span
                class="rounded-full bg-secondary-500/15 px-2.5 py-0.5 text-xs font-semibold text-secondary-600 dark:text-secondary-300"
            >
                {files.filter((f) => f.uploaded).length} ready
            </span>
        {/if}
    </div>
    {#if files.length > 0}
        <div class="flex flex-col gap-2">
            {#each files as f (f.id)}
                <div
                    class="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900"
                >
                    <div class="flex min-w-0 items-center gap-3">
                        <span
                            class="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary-500/15 text-xl"
                        >
                            {f.type?.startsWith("image") ? "🖼️" : "📄"}
                        </span>
                        <div class="min-w-0">
                            <p
                                class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-50"
                            >
                                {f.name}
                            </p>
                            <p class="text-xs text-neutral-500 dark:text-neutral-400">
                                {f.size} &middot; {f.pageCount != null
                                    ? `${f.pageCount} page${f.pageCount !== 1 ? "s" : ""}`
                                    : f.type}
                                {#if f.uploading}
                                    &middot; <span class="text-amber-600 dark:text-amber-400"
                                        >Uploading…</span
                                    >
                                {:else if f.error}
                                    &middot; <span class="text-red-600 dark:text-red-400"
                                        >{f.error}</span
                                    >
                                {:else if f.uploaded}
                                    &middot; <span class="text-emerald-600 dark:text-emerald-400"
                                        >Uploaded</span
                                    >
                                {/if}
                            </p>
                            {#if f.storagePath}
                                <p
                                    class="truncate font-mono text-xs text-neutral-500 dark:text-neutral-400"
                                >
                                    {f.storagePath}
                                </p>
                            {/if}
                        </div>
                    </div>
                    <button
                        type="button"
                        class="shrink-0 rounded-lg px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                        onclick={() => removeFile(f.id)}
                    >
                        Remove
                    </button>
                </div>
            {/each}
        </div>

        {#if files.some((f) => f.storagePath)}
            <form method="POST" action="?/createPackage" class="mt-4 flex justify-end">
                {#each files.filter((f) => f.storagePath) as f (f.id)}
                    <input type="hidden" name="docId" value={f.id} />
                {/each}
                <button
                    type="submit"
                    class="inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-secondary-600 to-primary-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-secondary-500 hover:to-primary-600"
                >
                    Next
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
                            d="M13 5l7 7-7 7M5 12h15"
                        ></path>
                    </svg>
                </button>
            </form>
        {/if}
    {:else}
        <div
            class="rounded-xl border border-dashed border-neutral-300 bg-neutral-100/50 px-6 py-10 text-center dark:border-neutral-800 dark:bg-neutral-900/30"
        >
            <p class="text-2xl">📄</p>
            <p class="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                No files uploaded yet
            </p>
            <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-500">
                Drop files above or browse to get started.
            </p>
        </div>
    {/if}
</div>

<!-- Recently Uploaded Popup -->
<div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    class:hidden={!showRecentPopup}
    onclick={() => (showRecentPopup = false)}
    onkeydown={(e) => {
        if (e.key === "Escape") showRecentPopup = false;
    }}
    role="dialog"
    aria-modal="true"
    aria-hidden={!showRecentPopup}
    tabindex="-1"
>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="relative w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
    >
        <button
            type="button"
            class="absolute top-4 right-4 grid size-8 place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            onclick={() => (showRecentPopup = false)}
            aria-label="Close"
        >
            ✕
        </button>
        <h2 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Recently Uploaded
        </h2>
        <RecentlyUploaded active={prefetchRecent || showRecentPopup} onselect={addRecentDoc} />
    </div>
</div>
