<script lang="ts">
    import { enhance } from "$app/forms";
    import { resolve } from "$app/paths";
    import { redirect } from "@sveltejs/kit";
    import type { ActionData, SubmitFunction } from "./$types";
    import { goto } from "$app/navigation";

    let { form } = $props<{ form: ActionData }>();

    let file = $state<File | null>(null);
    let title = $state("");
    let uploading = $state(false);
    let dragOver = $state(false);
    let error = $state<string | null>(null);

    let fileInput = $state<HTMLInputElement | undefined>(undefined);

    function formatSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        dragOver = true;
    }

    function handleDragLeave() {
        dragOver = false;
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        dragOver = false;
        const droppedFile = e.dataTransfer?.files?.[0];
        if (droppedFile && fileInput) {
            // Populate the file input so the form submission includes the file
            const dt = new DataTransfer();
            dt.items.add(droppedFile);
            fileInput.files = dt.files;
            validateAndSetFile(droppedFile);
        }
    }

    function handleFileSelect(e: Event) {
        const target = e.target as HTMLInputElement;
        const selectedFile = target.files?.[0];
        if (selectedFile) {
            validateAndSetFile(selectedFile);
        }
    }

    function validateAndSetFile(selectedFile: File) {
        error = null;

        if (selectedFile.type !== "application/pdf") {
            error = "Only PDF files are allowed";
            return;
        }

        if (selectedFile.size > 50 * 1024 * 1024) {
            error = "File size exceeds the 50 MB limit";
            return;
        }

        file = selectedFile;
        // Auto-fill title from filename (without extension)
        if (!title) {
            title = selectedFile.name.replace(/\.pdf$/i, "");
        }
    }

    function removeFile() {
        file = null;
        if (fileInput) {
            fileInput.value = "";
        }
    }

    function handleSubmit() {
        uploading = true;
        error = null;
    }

    const handleUpdate: SubmitFunction = () => {
        return ({ result }) => {
            if (result.type === "failure") {
                uploading = false;
            } else if (result.type === "success" && result.data?.documentId) {
                const { documentId } = result.data;
                goto(resolve(`/doc/${documentId}`));
            }
        };
    };
</script>

<svelte:head>
    <title>Upload Document — Pirma</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
    <div class="mb-8">
        <h1 class="text-3xl font-bold tracking-tight text-gray-900">Upload Document</h1>
        <p class="mt-2 text-sm text-gray-600">
            Upload a PDF document to start the signing process.
        </p>
    </div>

    <form
        method="POST"
        enctype="multipart/form-data"
        use:enhance={handleUpdate}
        onsubmit={handleSubmit}
        class="space-y-8"
    >
        <!-- Document Title -->
        <div>
            <label for="title" class="block text-sm font-medium text-gray-700">
                Document Title
            </label>
            <input
                id="title"
                name="title"
                type="text"
                bind:value={title}
                class="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                placeholder="e.g., Employment Contract, NDA Agreement"
                required
            />
        </div>

        <!-- Hidden file input (always in DOM so form submission includes the file) -->
        <input
            bind:this={fileInput}
            id="file"
            name="file"
            type="file"
            accept=".pdf,application/pdf"
            onchange={handleFileSelect}
            class="sr-only"
            aria-label="Upload PDF file"
        />

        <!-- File Upload Zone -->
        <div>
            <span class="block text-sm font-medium text-gray-700">Document File (PDF)</span>

            {#if file}
                <!-- Selected File Card -->
                <div class="mt-2 rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                    <div class="flex items-center gap-4">
                        <div
                            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100"
                        >
                            <svg
                                class="h-6 w-6 text-blue-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                stroke-width="1.5"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                                />
                            </svg>
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="truncate text-sm font-medium text-gray-900">{file.name}</p>
                            <p class="text-sm text-gray-500">{formatSize(file.size)}</p>
                        </div>
                        <button
                            type="button"
                            onclick={removeFile}
                            class="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-blue-100 hover:text-gray-600 focus:outline-none"
                            aria-label="Remove file"
                        >
                            <svg
                                class="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                stroke-width="1.5"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M6 18 18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            {:else}
                <!-- Drop Zone -->
                <div
                    role="button"
                    tabindex="-1"
                    class="relative mt-2"
                    ondragover={handleDragOver}
                    ondragleave={handleDragLeave}
                    ondrop={handleDrop}
                >
                    <label
                        for="file"
                        class="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 transition-colors {dragOver
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'}"
                    >
                        <div class="mb-4 rounded-full bg-gray-100 p-3">
                            <svg
                                class="h-8 w-8 text-gray-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                stroke-width="1.5"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                                />
                            </svg>
                        </div>
                        <p class="text-sm text-gray-600">
                            <span class="font-medium text-blue-600">Click to upload</span>
                            or drag and drop
                        </p>
                        <p class="mt-1 text-xs text-gray-500">PDF only, up to 50 MB</p>
                    </label>
                </div>
            {/if}
        </div>

        <!-- Error Messages -->
        {#if error}
            <div class="rounded-lg border border-red-200 bg-red-50 p-4">
                <div class="flex items-center gap-2">
                    <svg
                        class="h-5 w-5 shrink-0 text-red-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="1.5"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                        />
                    </svg>
                    <p class="text-sm font-medium text-red-800">{error}</p>
                </div>
            </div>
        {/if}

        {#if form?.error}
            <div class="rounded-lg border border-red-200 bg-red-50 p-4">
                <div class="flex items-center gap-2">
                    <svg
                        class="h-5 w-5 shrink-0 text-red-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="1.5"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                        />
                    </svg>
                    <p class="text-sm font-medium text-red-800">{form.error}</p>
                </div>
            </div>
        {/if}

        <!-- Submit Button -->
        <div class="flex items-center justify-end gap-4">
            <a
                href={resolve("/doc")}
                class="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
                Cancel
            </a>
            <button
                type="submit"
                disabled={!file || uploading}
                class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
                {#if uploading}
                    <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                        />
                        <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
                        />
                    </svg>
                    Uploading...
                {:else}
                    <svg
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                        />
                    </svg>
                    Upload Document
                {/if}
            </button>
        </div>
    </form>
</div>
