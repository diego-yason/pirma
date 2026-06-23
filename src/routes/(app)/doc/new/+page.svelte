<script lang="ts">
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

            try {
                const res = await fetch("/doc/new?/uploadFile", {
                    method: "POST",
                    body: formData,
                    headers: { "x-sveltekit-action": "true" },
                });
                const result = await res.json();

                files = files.map((f) =>
                    f.id === id
                        ? {
                              ...f,
                              uploading: false,
                              uploaded: result.documentId != null,
                              error: result.error ?? undefined,
                              storagePath: result.documentId ?? undefined,
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

    function removeFile(id: string) {
        files = files.filter((f) => f.id !== id);
    }

    function addRecentDoc(doc: { id: string; title: string }) {
        // Prevent duplicates
        if (files.some((f) => f.storagePath === doc.id)) return;

        files.push({
            id: crypto.randomUUID(),
            name: doc.title,
            type: "",
            size: "",
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
<div class="flex gap-6 w-3/4 ml-5">
    <!-- Upload area -->
    <div
        class="flex-1 rounded-xl border-2 border-dashed p-8 text-center transition-colors"
        class:border-blue-400={isDragOver}
        class:bg-blue-50={isDragOver}
        class:dark:bg-blue-950={isDragOver}
        class:border-neutral-300={!isDragOver}
        class:dark:border-neutral-700={!isDragOver}
        role="region"
        aria-label="File drop zone"
        ondragover={onDragOver}
        ondragleave={onDragLeave}
        ondrop={onDrop}
    >
        <p class="text-3xl mb-2">📄</p>
        <h2 class="text-lg font-semibold mb-1">Upload Files</h2>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
            PDF, DOCX, JPG, or PNG files
        </p>
        <button
            type="button"
            class="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            onclick={(e) => {
                e.stopPropagation();
                document.getElementById("fileInput")?.click();
            }}
        >
            Browse Files
        </button>
        <button
            type="button"
            class="mt-2 text-sm text-blue-600 underline transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
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
        class="flex-1 rounded-xl flex items-center flex-col border border-neutral-300 p-8 dark:border-neutral-700"
    >
        <p class="text-3xl mb-2">📄</p>
        <h2 class="text-lg font-semibold mb-1">Use Template</h2>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mb-4">Standardized contracts</p>
        <button
            type="button"
            class="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        >
            Select Template
        </button>
    </div>
</div>

<!-- Uploaded files list -->
<div class="mt-6 border rounded-md px-8 py-5 ml-5 w-3/4">
    <h2 class="text-lg font-semibold mb-3">Uploaded Files ({files.length})</h2>
    {#if files.length > 0}
        <div class="flex flex-col gap-2">
            {#each files as f (f.id)}
                <div
                    class="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900"
                >
                    <div class="flex items-center gap-3">
                        <span class="text-xl">
                            {f.type?.startsWith("image") ? "🖼️" : "📄"}
                        </span>
                        <div>
                            <p class="text-sm font-medium">{f.name}</p>
                            <p class="text-xs text-neutral-500 dark:text-neutral-400">
                                {f.size} &middot; {f.pageCount != null
                                    ? `${f.pageCount} pages`
                                    : f.type}
                                {#if f.uploading}
                                    &middot; Uploading…
                                {:else if f.error}
                                    &middot; <span class="text-red-500">{f.error}</span>
                                {:else if f.uploaded}
                                    &middot; <span class="text-green-500">Uploaded</span>
                                {/if}
                            </p>
                            {#if f.storagePath}
                                <p class="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                                    {f.storagePath}
                                </p>
                            {/if}
                        </div>
                    </div>
                    <button
                        type="button"
                        class="rounded-lg px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                        onclick={() => removeFile(f.id)}
                    >
                        Remove
                    </button>
                </div>
            {/each}
        </div>

        {#if files.some((f) => f.storagePath)}
            <form method="POST" action="?/createPackage" class="mt-4">
                {#each files.filter((f) => f.storagePath) as f (f.id)}
                    <input type="hidden" name="docId" value={f.storagePath!} />
                {/each}
                <button
                    type="submit"
                    class="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                    Next →
                </button>
            </form>
        {/if}
    {:else}
        <p class="text-sm text-neutral-400 dark:text-neutral-500">No files uploaded yet.</p>
    {/if}
</div>

<!-- Recently Uploaded Popup -->
<div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
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
        class="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-neutral-900"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
    >
        <button
            type="button"
            class="absolute right-4 top-4 text-neutral-400 transition hover:text-neutral-600 dark:hover:text-neutral-300"
            onclick={() => (showRecentPopup = false)}
            aria-label="Close"
        >
            ✕
        </button>
        <h2 class="mb-4 text-lg font-semibold">Recently Uploaded</h2>
        <RecentlyUploaded active={prefetchRecent || showRecentPopup} onselect={addRecentDoc} />
    </div>
</div>
