<script lang="ts">
    import { onMount } from "svelte";
    import type { PlacedRect } from "./types";

    let {
        elements = [],
        signedStatus = {},
        onsign,
        onremove,
    }: {
        elements?: PlacedRect[];
        signedStatus?: Record<string, boolean>;
        onsign?: (id: string) => void;
        onremove?: (id: string) => void;
    } = $props();

    let pages: { canvasWidth: number; canvasHeight: number }[] = $state([]);
    let loading = $state(true);
    let doc: unknown = null;
    let placedElements = $state<PlacedRect[]>([]);

    function isSigned(id: string): boolean {
        return signedStatus[id] ?? false;
    }

    onMount(async () => {
        // Seed from prop
        placedElements = [...elements];

        const pdfjs = await import("pdfjs-dist");

        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.mjs",
            import.meta.url,
        ).toString();

        const pdfDoc = await pdfjs.getDocument({ url: "/sample.pdf" }).promise;
        doc = pdfDoc;

        const pageList: { canvasWidth: number; canvasHeight: number }[] = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 2 });
            pageList.push({
                canvasWidth: viewport.width,
                canvasHeight: viewport.height,
            });
        }
        pages = pageList;
        loading = false;
    });

    function renderPageAction(node: HTMLCanvasElement, pageNum: number) {
        if (!doc) return;

        const d = doc as {
            getPage: (n: number) => Promise<{
                getViewport: (opts: { scale: number }) => { width: number; height: number };
                render: (opts: {
                    canvas: HTMLCanvasElement;
                    viewport: { width: number; height: number };
                }) => void;
            }>;
        };
        d.getPage(pageNum).then((page) => {
            const viewport = page.getViewport({ scale: 2 });
            node.width = viewport.width;
            node.height = viewport.height;

            page.render({
                canvas: node,
                viewport,
            });
        });
    }
</script>

<div class="mx-auto max-w-3xl">
    <h1 class="mb-6 text-2xl font-bold">Document Preview</h1>

    {#if loading}
        <p class="text-neutral-500">Loading document&hellip;</p>
    {:else}
        <div class="flex flex-col gap-4">
            {#each pages as page, i (i)}
                <div
                    class="relative rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
                >
                    <canvas
                        width={page.canvasWidth}
                        height={page.canvasHeight}
                        class="w-full h-auto"
                        use:renderPageAction={i + 1}
                    ></canvas>

                    <!-- Placed rectangles -->
                    {#each placedElements.filter((el) => el.page === i) as el (el.id)}
                        {#if isSigned(el.id)}
                            <div
                                role="img"
                                class="absolute"
                                style="
                                    left: {((el.x - el.width / 2) / page.canvasWidth) * 100}%;
                                    top: {((el.y - el.height / 2) / page.canvasHeight) * 100}%;
                                    width: {(el.width / page.canvasWidth) * 100}%;
                                    height: {(el.height / page.canvasHeight) * 100}%;
                                "
                                oncontextmenu={(e) => {
                                    e.preventDefault();
                                    onremove?.(el.id);
                                }}
                                title="Right-click to remove"
                            >
                                <img
                                    src="/signature.png"
                                    alt="Signature"
                                    class="h-full w-full object-contain"
                                />
                            </div>
                        {:else}
                            <button
                                type="button"
                                class="absolute cursor-pointer border-2 border-green-500 bg-green-500/10 transition-colors hover:bg-red-500/20 hover:border-red-500"
                                style="
                                    left: {((el.x - el.width / 2) / page.canvasWidth) * 100}%;
                                    top: {((el.y - el.height / 2) / page.canvasHeight) * 100}%;
                                    width: {(el.width / page.canvasWidth) * 100}%;
                                    height: {(el.height / page.canvasHeight) * 100}%;
                                "
                                onclick={() => onsign?.(el.id)}
                                oncontextmenu={(e) => {
                                    e.preventDefault();
                                    onremove?.(el.id);
                                }}
                                title="Click to sign · Right-click to remove"
                            >
                                {#if el.label}
                                    <span
                                        class="absolute inset-0 flex items-center justify-center text-xs font-medium text-green-700 dark:text-green-300"
                                        >{el.label}</span
                                    >
                                {/if}
                            </button>
                        {/if}
                    {/each}
                </div>
            {/each}
        </div>
    {/if}
</div>
