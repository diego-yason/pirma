<script lang="ts">
    import SignatureDrawPad from "./SignatureDrawPad.svelte";

    type Tab = "upload" | "draw" | "type";

    let activeTab = $state<Tab>("draw");
    let drawPad = $state<SignatureDrawPad>();
    let fileInput = $state<HTMLInputElement>();
    let previewUrl = $state<string | null>(null);
    let typeText = $state("");
    let typeFont = $state("'Alex Brush', cursive");

    const { onsave, onsaveerror, onskip } = $props<{
        onsave?: (blob: Blob) => void;
        onsaveerror?: (msg: string) => void;
        onskip?: () => void;
    }>();

    function handleFileSelected(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(file);
        activeTab = "upload";
    }

    async function saveUploaded() {
        if (!fileInput?.files?.[0]) return;
        const blob = fileInput.files[0];
        const body = new FormData();
        body.append("signature", blob);
        body.append("name", "My Signature");
        const res = await fetch("/settings?/uploadSignature", { method: "POST", body });
        if (!res.ok) {
            onsaveerror?.("Failed to save signature");
            return;
        }
        onsave?.(blob);
    }

    async function saveDrawn() {
        if (!drawPad) return;
        const blob = await drawPad.getBlob();
        if (!blob) {
            onsaveerror?.("Please draw a signature first");
            return;
        }
        const body = new FormData();
        body.append("signature", blob, "signature.png");
        body.append("name", "My Signature");
        const res = await fetch("/settings?/uploadSignature", { method: "POST", body });
        if (!res.ok) {
            onsaveerror?.("Failed to save signature");
            return;
        }
        onsave?.(blob);
    }

    async function saveTyped() {
        if (!typeText.trim()) {
            onsaveerror?.("Please type your name first");
            return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = 500;
        canvas.height = 200;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, 500, 200);
        const size = Math.min(80, (500 / typeText.length) * 1.5);
        ctx.font = `${size}px ${typeFont}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#000";
        ctx.fillText(typeText, 250, 100);
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
        if (!blob) {
            onsaveerror?.("Failed to render signature");
            return;
        }
        const body = new FormData();
        body.append("signature", blob, "signature.png");
        body.append("name", "My Signature");
        const res = await fetch("/settings?/uploadSignature", { method: "POST", body });
        if (!res.ok) {
            onsaveerror?.("Failed to save signature");
            return;
        }
        onsave?.(blob);
    }

    let saving = $state(false);

    async function handleSave() {
        saving = true;
        try {
            if (activeTab === "upload") await saveUploaded();
            else if (activeTab === "draw") await saveDrawn();
            else await saveTyped();
        } finally {
            saving = false;
        }
    }
</script>

<!-- Tabs -->
<div class="flex gap-1 mb-4 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
    {#each [{ id: "upload" as Tab, label: "Upload", icon: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" }, { id: "draw" as Tab, label: "Draw", icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" }, { id: "type" as Tab, label: "Type", icon: "M4 6h16M4 12h16M4 18h7" }] as tab (tab.id)}
        <button
            role="tab"
            aria-selected={activeTab === tab.id}
            onclick={() => (activeTab = tab.id)}
            class="flex items-center justify-center gap-1.5 flex-1 rounded-md px-3 py-2 text-sm font-medium transition
                {activeTab === tab.id
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}"
        >
            <svg
                class="size-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
            >
                <path stroke-linecap="round" stroke-linejoin="round" d={tab.icon} />
            </svg>
            {tab.label}
        </button>
    {/each}
</div>

<!-- Upload tab -->
{#if activeTab === "upload"}
    <div
        role="region"
        class="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-600 p-8 text-center"
        ondragover={(e) => e.preventDefault()}
        ondragenter={(e) => e.preventDefault()}
        ondragleave={(e) => e.preventDefault()}
        ondrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer?.files?.[0];
            if (file) {
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                previewUrl = URL.createObjectURL(file);
                const dt = new DataTransfer();
                dt.items.add(file);
                if (fileInput) fileInput.files = dt.files;
            }
        }}
    >
        {#if previewUrl}
            <img src={previewUrl} alt="Preview" class="max-h-32 object-contain mb-3 rounded" />
        {:else}
            <svg
                class="size-10 text-neutral-400 mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
            </svg>
            <p class="text-sm text-neutral-500 mb-2">Drop an image or click to browse</p>
        {/if}
        <input
            type="file"
            bind:this={fileInput}
            accept="image/png,image/jpeg,image/gif,image/webp"
            class="text-sm text-neutral-500 file:mr-3 file:rounded file:border-0 file:bg-neutral-200 dark:file:bg-neutral-700 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-neutral-300 dark:hover:file:bg-neutral-600"
            onchange={handleFileSelected}
        />
    </div>

    <!-- Draw tab -->
{:else if activeTab === "draw"}
    <SignatureDrawPad bind:this={drawPad} />
    <div class="flex justify-end mt-2">
        <button
            type="button"
            class="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 underline"
            onclick={() => drawPad?.clear()}>Clear</button
        >
    </div>

    <!-- Type tab -->
{:else if activeTab === "type"}
    <div class="space-y-3">
        <input
            type="text"
            bind:value={typeText}
            placeholder="Type your name"
            class="w-full rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800 px-3 py-2.5 text-center text-lg font-['Alex_Brush'] tracking-wide"
        />
        <div class="flex items-center gap-2">
            <label for="sig-font" class="text-xs text-neutral-500">Font:</label>
            <select
                id="sig-font"
                bind:value={typeFont}
                class="rounded border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800 px-2 py-1 text-sm"
            >
                <option value="'Alex Brush', cursive">Alex Brush</option>
                <option value="'Dancing Script', cursive">Dancing Script</option>
                <option value="'Pacifico', cursive">Pacifico</option>
                <option value="'Great Vibes', cursive">Great Vibes</option>
                <option value="'Tangerine', cursive">Tangerine</option>
                <option value="cursive">Cursive</option>
                <option value="serif">Serif</option>
                <option value="sans-serif">Sans-serif</option>
            </select>
        </div>
        {#if typeText.trim()}
            <div
                class="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 bg-white flex items-center justify-center"
                style="min-height: 80px;"
            >
                <span
                    class="text-4xl"
                    style="font-family: {typeFont}; color: #000; line-height: 1.2;"
                >
                    {typeText}
                </span>
            </div>
        {/if}
    </div>
{/if}

<!-- Actions -->
<div class="flex gap-3 mt-4">
    <button
        type="button"
        class="rounded-md border border-neutral-300 dark:border-neutral-600 px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
        onclick={onskip}
    >
        Skip
    </button>
    <div class="flex-1"></div>
    <button
        type="button"
        class="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={saving}
        onclick={handleSave}
    >
        {saving ? "Saving..." : "Save Signature"}
    </button>
</div>
