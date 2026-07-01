<script lang="ts">
    import { enhance } from "$app/forms";
    import type { PageProps } from "./$types";
    import SignatureDrawPad from "$lib/client/ui/SignatureDrawPad.svelte";

    let { data, form }: PageProps = $props();

    type Tab = "upload" | "draw" | "type";
    let activeTab: Tab = $state("upload");
    let drawPad = $state<SignatureDrawPad>();

    let fileInput = $state<HTMLInputElement>();
    let previewUrl = $state<string | null>(null);
    let originalUrl = $state<string | null>(null);
    let originalFile = $state<File | null>(null);
    let signatureName = $state("");
    let isUploading = $state(false);
    let isDragOver = $state(false);
    let hasAlpha = $state(false);
    let showBgTools = $state(false);
    let isRemovingBg = $state(false);
    let threshold = $state(30);

    function detectAlpha(url: string): Promise<boolean> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(img, 0, 0);
                const data = ctx.getImageData(0, 0, img.width, img.height).data;
                for (let i = 3; i < data.length; i += 4) {
                    if (data[i] < 255) {
                        resolve(true);
                        return;
                    }
                }
                resolve(false);
            };
            img.onerror = () => resolve(false);
            img.src = url;
        });
    }

    function loadImage(src: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    async function removeBackgroundFromImage(
        imgSrc: string,
        tolerance: number,
    ): Promise<Blob | null> {
        const img = await loadImage(imgSrc);
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const w = canvas.width;

        function getPixel(d: Uint8ClampedArray, x: number, y: number, width: number) {
            const i = (y * width + x) * 4;
            return { r: d[i], g: d[i + 1], b: d[i + 2] };
        }

        function colorDist(
            a: { r: number; g: number; b: number },
            b: { r: number; g: number; b: number },
        ) {
            return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
        }

        // Sample background from the four corners
        const corners = [
            getPixel(data, 0, 0, w),
            getPixel(data, w - 1, 0, w),
            getPixel(data, 0, canvas.height - 1, w),
            getPixel(data, w - 1, canvas.height - 1, w),
        ];

        const bgColor = {
            r: Math.round(corners.reduce((s, c) => s + c.r, 0) / 4),
            g: Math.round(corners.reduce((s, c) => s + c.g, 0) / 4),
            b: Math.round(corners.reduce((s, c) => s + c.b, 0) / 4),
        };

        for (let i = 0; i < data.length; i += 4) {
            const px = { r: data[i], g: data[i + 1], b: data[i + 2] };
            if (colorDist(px, bgColor) < tolerance) {
                data[i + 3] = 0;
            }
        }

        ctx.putImageData(imageData, 0, 0);

        return new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), "image/png");
        });
    }

    async function handleRemoveBackground() {
        if (!originalUrl) return;
        isRemovingBg = true;
        try {
            const blob = await removeBackgroundFromImage(originalUrl, threshold);
            if (!blob) return;

            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = URL.createObjectURL(blob);

            const processedFile = new File([blob], originalFile?.name ?? "signature.png", {
                type: "image/png",
            });
            if (fileInput) {
                const dt = new DataTransfer();
                dt.items.add(processedFile);
                fileInput.files = dt.files;
            }

            hasAlpha = true;
        } finally {
            isRemovingBg = false;
        }
    }

    async function handleFile(file: File) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        if (originalUrl) URL.revokeObjectURL(originalUrl);
        const url = URL.createObjectURL(file);
        originalUrl = url;
        previewUrl = url;
        originalFile = file;
        if (!signatureName) {
            signatureName = file.name.replace(/\.[^/.]+$/, "");
        }
        hasAlpha = await detectAlpha(url);
        showBgTools = false;
        threshold = 30;
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
        const file = e.dataTransfer?.files?.[0];
        if (file) {
            handleFile(file);
            // Sync the hidden file input so the form can submit it
            if (fileInput) {
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInput.files = dt.files;
            }
        }
    }

    async function saveDrawSignature() {
        if (!drawPad) return;
        const blob = await drawPad.getBlob();
        if (!blob) return;
        const file = new File([blob], "signature.png", { type: "image/png" });
        handleFile(file);
        if (fileInput) {
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
        }
        activeTab = "upload";
    }
</script>

<div class="max-w-2xl mx-auto py-8 px-6">
    <h2 class="text-2xl font-bold text-neutral-100 mb-1">Signatures</h2>
    <p class="text-neutral-400 text-sm mb-8">Create and manage your signature styles</p>

    <!-- Existing Signatures -->
    {#if data.signatures.length > 0}
        <div class="mb-10">
            <h3 class="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                Saved Signatures
            </h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {#each data.signatures as sig (sig.id)}
                    <div
                        class="group relative border border-neutral-700 rounded-xl p-4 bg-neutral-900/50 hover:bg-neutral-900 transition"
                    >
                        <img
                            class="w-full h-24 object-contain mb-2 rounded-lg p-1"
                            style="background: repeating-linear-gradient(45deg, transparent, transparent 8px, #1a1a2e 8px, #1a1a2e 10px); background-color: #2a2a3e;"
                            src={sig.url || "/api/signature/{sig.id}"}
                            alt={sig.name}
                        />
                        <p class="text-sm font-medium text-neutral-200 truncate">{sig.name}</p>
                        <p class="text-xs text-neutral-500">
                            {new Date(sig.createdAt).toLocaleDateString()}
                        </p>

                        <!-- Delete -->
                        <form
                            method="POST"
                            action="?/deleteSignature"
                            use:enhance
                            class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition"
                        >
                            <input type="hidden" name="signatureId" value={sig.id} />
                            <button
                                type="submit"
                                class="p-1.5 rounded-full bg-red-600/80 hover:bg-red-600 text-white text-xs transition"
                                aria-label="Delete signature"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    class="w-4 h-4"
                                >
                                    <path
                                        fill-rule="evenodd"
                                        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c-.84 0-1.673.025-2.5.075V3.75c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25v.325C11.673 4.025 10.84 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                                        clip-rule="evenodd"
                                    />
                                </svg>
                            </button>
                        </form>
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    <!-- Create New Signature -->
    <div>
        <h3 class="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">
            Create New Signature
        </h3>

        <!-- Tabs -->
        <div class="flex border-b border-neutral-700 mb-6" role="tablist">
            {#each [{ id: "upload" as Tab, label: "Upload", icon: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" }, { id: "draw" as Tab, label: "Draw", icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" }, { id: "type" as Tab, label: "Type", icon: "M4 6h16M4 12h16M4 18h7" }] as tab (tab.id)}
                <button
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onclick={() => (activeTab = tab.id)}
                    class="flex items-center gap-2 px-5 py-3 text-sm font-medium transition border-b-2 -mb-px
                        {activeTab === tab.id
                        ? 'border-secondary-500 text-secondary-300'
                        : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:border-neutral-600'}"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        class="w-4 h-4"
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" d={tab.icon} />
                    </svg>
                    {tab.label}
                </button>
            {/each}
        </div>

        <!-- Tab Content -->
        {#if activeTab === "upload"}
            <form
                method="POST"
                action="?/uploadSignature"
                enctype="multipart/form-data"
                use:enhance
                class="space-y-5"
            >
                <!-- Drop Zone -->
                <div
                    class="relative border-2 border-dashed rounded-xl p-8 text-center transition
                        {isDragOver
                        ? 'border-secondary-400 bg-secondary-500/10'
                        : 'border-neutral-600'}"
                    role="region"
                    aria-label="Signature image upload drop zone"
                    ondragover={onDragOver}
                    ondragleave={onDragLeave}
                    ondrop={onDrop}
                >
                    <input
                        type="file"
                        name="signature"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        class="hidden"
                        bind:this={fileInput}
                        onchange={(e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) handleFile(file);
                        }}
                    />

                    {#if previewUrl}
                        <div class="flex flex-col items-center gap-4">
                            <img
                                class="max-h-40 object-contain rounded-lg p-1"
                                style="background: repeating-linear-gradient(45deg, transparent, transparent 8px, #1a1a2e 8px, #1a1a2e 10px); background-color: #2a2a3e;"
                                src={previewUrl}
                                alt="Signature preview"
                            />

                            <!-- Alpha status -->
                            {#if hasAlpha}
                                <div
                                    class="flex items-center gap-2 rounded-full bg-emerald-950/60 border border-emerald-800/50 px-4 py-1.5"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                        class="w-4 h-4 text-emerald-400 shrink-0"
                                    >
                                        <path
                                            fill-rule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                                            clip-rule="evenodd"
                                        />
                                    </svg>
                                    <span class="text-xs text-emerald-300"
                                        >Alpha transparency detected</span
                                    >
                                </div>
                            {:else if previewUrl}
                                <div
                                    class="flex items-center gap-2 rounded-full bg-neutral-800/60 border border-neutral-700/50 px-4 py-1.5"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                        class="w-4 h-4 text-neutral-500 shrink-0"
                                    >
                                        <path
                                            fill-rule="evenodd"
                                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                                            clip-rule="evenodd"
                                        />
                                    </svg>
                                    <span class="text-xs text-neutral-500"
                                        >No alpha — background removal ready</span
                                    >
                                </div>
                            {/if}

                            <!-- Background Removal Tools -->
                            <button
                                type="button"
                                onclick={() => (showBgTools = !showBgTools)}
                                class="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    class="w-4 h-4"
                                >
                                    <path
                                        d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.765.75.75 0 001.06-1.06 2.5 2.5 0 01-.14-3.603l3-3z"
                                    />
                                    <path
                                        d="M11.603 7.963a.75.75 0 00-.977-.977l-5.25 5.25a4 4 0 005.656 5.656l3-3a4 4 0 00-.225-5.765.75.75 0 00-1.06 1.06 2.5 2.5 0 01.14 3.603l-3 3a2.5 2.5 0 01-3.536-3.536l5.25-5.25z"
                                    />
                                </svg>
                                {showBgTools ? "Hide" : "Show"} background removal tools
                            </button>

                            {#if showBgTools}
                                <div
                                    class="w-full border border-neutral-700 rounded-xl p-5 space-y-4 bg-neutral-900/50"
                                >
                                    <div class="flex items-center justify-between">
                                        <p class="text-sm font-medium text-neutral-300">
                                            Background Removal
                                        </p>
                                        {#if hasAlpha}
                                            <span class="text-xs text-emerald-500/70">Active</span>
                                        {/if}
                                    </div>

                                    <!-- Threshold slider -->
                                    <div>
                                        <label
                                            for="threshold"
                                            class="flex justify-between text-xs text-neutral-500 mb-1.5"
                                        >
                                            <span>Tolerance</span>
                                            <span>{threshold}</span>
                                        </label>
                                        <input
                                            id="threshold"
                                            type="range"
                                            min="1"
                                            max="100"
                                            bind:value={threshold}
                                            class="w-full accent-secondary-500"
                                        />
                                        <p class="text-xs text-neutral-600 mt-1">
                                            Lower = only very similar colors removed. Higher = more
                                            aggressive.
                                        </p>
                                    </div>

                                    <!-- Remove button -->
                                    <button
                                        type="button"
                                        onclick={handleRemoveBackground}
                                        disabled={isRemovingBg}
                                        class="w-full rounded-lg bg-secondary-700 hover:bg-secondary-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-medium text-white transition flex items-center justify-center gap-2"
                                    >
                                        {#if isRemovingBg}
                                            <svg
                                                class="animate-spin w-4 h-4"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                            >
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
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                                />
                                            </svg>
                                            Processing...
                                        {:else}
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                                class="w-4 h-4"
                                            >
                                                <path
                                                    fill-rule="evenodd"
                                                    d="M4.25 2A2.25 2.25 0 002 4.25v2.5A2.25 2.25 0 004.25 9h2.5A2.25 2.25 0 009 6.75v-2.5A2.25 2.25 0 006.75 2h-2.5zm0 9A2.25 2.25 0 002 13.25v2.5A2.25 2.25 0 004.25 18h2.5A2.25 2.25 0 009 15.75v-2.5A2.25 2.25 0 006.75 11h-2.5zm9-9A2.25 2.25 0 0011 4.25v2.5A2.25 2.25 0 0013.25 9h2.5A2.25 2.25 0 0018 6.75v-2.5A2.25 2.25 0 0015.75 2h-2.5zm0 9A2.25 2.25 0 0011 13.25v2.5A2.25 2.25 0 0013.25 18h2.5A2.25 2.25 0 0018 15.75v-2.5A2.25 2.25 0 0015.75 11h-2.5z"
                                                    clip-rule="evenodd"
                                                />
                                            </svg>
                                            Remove Background
                                        {/if}
                                    </button>

                                    {#if hasAlpha}
                                        <p class="text-xs text-neutral-500 text-center">
                                            Already processed. Adjust tolerance and click again to
                                            re-process.
                                        </p>
                                    {/if}
                                </div>
                            {/if}

                            <div class="flex items-center gap-3">
                                <button
                                    type="button"
                                    onclick={() => fileInput?.click()}
                                    class="rounded-lg bg-neutral-700 hover:bg-neutral-600 px-4 py-1.5 text-sm font-medium text-neutral-200 transition"
                                >
                                    Browse files
                                </button>
                                <button
                                    type="button"
                                    class="text-sm text-neutral-400 hover:text-red-400 transition"
                                    onclick={() => {
                                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                                        if (originalUrl) URL.revokeObjectURL(originalUrl);
                                        previewUrl = null;
                                        originalUrl = null;
                                        if (fileInput) fileInput.value = "";
                                    }}
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    {:else}
                        <div class="flex flex-col items-center gap-4">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.5"
                                class="w-10 h-10 text-neutral-500"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                                />
                            </svg>
                            <div>
                                <p class="text-neutral-300 font-medium">Drop your image here</p>
                                <p class="text-neutral-500 text-sm mt-1">
                                    PNG, JPEG, GIF, or WebP &middot; Up to 5 MB
                                </p>
                            </div>
                            <button
                                type="button"
                                onclick={() => fileInput?.click()}
                                class="rounded-lg bg-neutral-700 hover:bg-neutral-600 px-5 py-2 text-sm font-medium text-neutral-200 transition"
                            >
                                Browse files
                            </button>
                        </div>
                    {/if}
                </div>

                <!-- Name -->
                <div>
                    <label for="sig-name" class="block text-sm font-medium text-neutral-300 mb-1.5">
                        Signature Name
                    </label>
                    <input
                        id="sig-name"
                        name="name"
                        type="text"
                        placeholder="My Signature"
                        bind:value={signatureName}
                        class="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-100
                            placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-secondary-500/50 focus:border-secondary-500 transition"
                    />
                </div>

                <!-- Submit -->
                <button
                    type="submit"
                    disabled={!previewUrl || isUploading}
                    class="w-full rounded-lg bg-secondary-600 px-4 py-3 text-sm font-medium text-white
                        hover:bg-secondary-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                    {isUploading ? "Uploading..." : "Save Signature"}
                </button>

                {#if form?.error}
                    <p class="text-sm text-red-400 text-center">{form.error}</p>
                {:else if form?.success}
                    <p class="text-sm text-emerald-400 text-center">{form.message}</p>
                {/if}
            </form>
        {:else if activeTab === "draw"}
            <SignatureDrawPad bind:this={drawPad} />
            <div class="flex gap-3 mt-4">
                <button
                    type="button"
                    class="rounded-md border border-neutral-600 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-neutral-800"
                    onclick={() => drawPad?.clear()}
                >
                    Clear
                </button>
                <div class="flex-1"></div>
                <button
                    type="button"
                    class="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                    disabled={!drawPad}
                    onclick={saveDrawSignature}
                >
                    Use Signature
                </button>
            </div>
        {:else if activeTab === "type"}
            <div class="border border-neutral-700 rounded-xl p-12 text-center">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    class="w-12 h-12 text-neutral-600 mx-auto mb-3"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M4 6h16M4 12h16M4 18h7"
                    />
                </svg>
                <p class="text-neutral-400 font-medium">Type your signature</p>
                <p class="text-neutral-600 text-sm mt-1">
                    Coming soon &mdash; choose a font style and type your name
                </p>
            </div>
        {/if}
    </div>
</div>
