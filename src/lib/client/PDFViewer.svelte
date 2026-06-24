<script lang="ts">
    import { onMount } from "svelte";
    import type { PlacedRect, RecipientInfo } from "./SignatureBoxTypes";

    type Mode = "design" | "sign";
    type Tool = "signature" | "text" | null;

    let {
        pdfUrl = "/sample.pdf",
        elements = [],
        signedStatus = {},
        recipients = [] as RecipientInfo[],
        mode = "sign" as Mode,
        activeTool = null as Tool,
        onsign,
        onremove,
        onadd,
        onmove,
        onresize,
        onreassign,
        ondelete,
    }: {
        pdfUrl?: string;
        elements?: PlacedRect[];
        signedStatus?: Record<string, boolean>;
        recipients?: RecipientInfo[];
        mode?: Mode;
        activeTool?: Tool;
        onsign?: (id: string) => void;
        onremove?: (id: string) => void;
        onadd?: (rect: PlacedRect) => void;
        onmove?: (rect: PlacedRect) => void;
        onresize?: (rect: PlacedRect) => void;
        onreassign?: (id: string, newAssignedTo: string) => void;
        ondelete?: (id: string) => void;
    } = $props();

    let pages: { canvasWidth: number; canvasHeight: number }[] = $state([]);
    let loading = $state(true);
    let doc: unknown = null;
    let placedElements = $state<PlacedRect[]>([]);

    // Drag state
    let dragging = $state<{
        id: string;
        startMouseX: number;
        startMouseY: number;
        startX: number;
        startY: number;
    } | null>(null);

    // Resize state
    let resizing = $state<{
        id: string;
        handle: string;
        startMouseX: number;
        startMouseY: number;
        startX: number;
        startY: number;
        startWidth: number;
        startHeight: number;
    } | null>(null);

    // Page container refs for coordinate conversion
    let pageContainers: HTMLDivElement[] = $state([]);

    // Context menu state
    let contextMenu = $state<{ el: PlacedRect; x: number; y: number } | null>(null);

    // Drag-to-draw state
    let drawing = $state<{
        pageIndex: number;
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
    } | null>(null);

    // Zoom state
    let zoom = $state(1);
    const ZOOM_MIN = 0.25;
    const ZOOM_MAX = 4;
    const ZOOM_STEP = 0.1;

    let pagesWrapper = $state<HTMLDivElement>();
    let wrapperHeight = $state("");

    $effect(() => {
        // Re-measure when zoom or pages change
        if (pagesWrapper && pages.length > 0) {
            const natural = pagesWrapper.scrollHeight;
            wrapperHeight = `height: ${natural * zoom}px;`;
        }
    });

    function changeZoom(delta: number) {
        zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom + delta));
    }

    function resetZoom() {
        zoom = 1;
    }

    function handleWheel(e: WheelEvent) {
        if (e.ctrlKey) {
            e.preventDefault();
            changeZoom(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
        }
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === "=" || e.key === "+") {
                e.preventDefault();
                changeZoom(ZOOM_STEP);
            } else if (e.key === "-") {
                e.preventDefault();
                changeZoom(-ZOOM_STEP);
            } else if (e.key === "0") {
                e.preventDefault();
                resetZoom();
            }
        }
    }

    let totalPages = $derived(pages.length);
    let zoomPercent = $derived(Math.round(zoom * 100));

    const DESIGN_BOX_DEFAULTS = {
        signature: { width: 200, height: 60 },
        text: { width: 200, height: 40 },
    };

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

        const pdfDoc = await pdfjs.getDocument({ url: pdfUrl }).promise;
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

    function handlePageMouseDown(e: MouseEvent, pageIndex: number) {
        if (mode !== "design" || !activeTool) return;

        const container = pageContainers[pageIndex];
        if (!container) return;

        const page = pages[pageIndex];
        if (!page) return;

        const rect = container.getBoundingClientRect();
        const scaleX = page.canvasWidth / rect.width;
        const scaleY = page.canvasHeight / rect.height;

        drawing = {
            pageIndex,
            startX: (e.clientX - rect.left) * scaleX,
            startY: (e.clientY - rect.top) * scaleY,
            currentX: (e.clientX - rect.left) * scaleX,
            currentY: (e.clientY - rect.top) * scaleY,
        };

        window.addEventListener("mousemove", handleDrawMove);
        window.addEventListener("mouseup", handleDrawEnd);
    }

    function handleDrawMove(e: MouseEvent) {
        if (!drawing) return;

        const page = pages[drawing.pageIndex];
        if (!page) return;

        const container = pageContainers[drawing.pageIndex];
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const scaleX = page.canvasWidth / rect.width;
        const scaleY = page.canvasHeight / rect.height;

        drawing.currentX = (e.clientX - rect.left) * scaleX;
        drawing.currentY = (e.clientY - rect.top) * scaleY;
    }

    function handleDrawEnd() {
        if (!drawing) return;

        window.removeEventListener("mousemove", handleDrawMove);
        window.removeEventListener("mouseup", handleDrawEnd);

        const page = pages[drawing.pageIndex];
        if (!page) {
            drawing = null;
            return;
        }

        const MIN_DRAW = 60;
        const dx = Math.abs(drawing.currentX - drawing.startX);
        const dy = Math.abs(drawing.currentY - drawing.startY);

        const defaults =
            activeTool === "text" ? DESIGN_BOX_DEFAULTS.text : DESIGN_BOX_DEFAULTS.signature;

        const newRect: PlacedRect = {
            id: crypto.randomUUID(),
            page: drawing.pageIndex,
            x: (drawing.startX + drawing.currentX) / 2,
            y: (drawing.startY + drawing.currentY) / 2,
            width: dx >= MIN_DRAW ? dx : defaults.width,
            height: dy >= MIN_DRAW ? dy : defaults.height,
            label: activeTool === "text" ? "Text Field" : undefined,
        };

        placedElements.push(newRect);
        onadd?.(newRect);
        drawing = null;
    }

    function handlePageKeyDown(e: KeyboardEvent, pageIndex: number) {
        if (mode !== "design" || !activeTool) return;
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();

        const page = pages[pageIndex];
        if (!page) return;

        const defaults =
            activeTool === "text" ? DESIGN_BOX_DEFAULTS.text : DESIGN_BOX_DEFAULTS.signature;

        const newRect: PlacedRect = {
            id: crypto.randomUUID(),
            page: pageIndex,
            x: page.canvasWidth / 2,
            y: page.canvasHeight / 2,
            width: defaults.width,
            height: defaults.height,
            label: activeTool === "text" ? "Text Field" : undefined,
        };

        placedElements.push(newRect);
        onadd?.(newRect);
    }

    // --- Drag handlers ---
    function handleDragStart(e: MouseEvent, el: PlacedRect) {
        if (mode !== "design") return;
        e.stopPropagation();
        e.preventDefault();

        dragging = {
            id: el.id,
            startMouseX: e.clientX,
            startMouseY: e.clientY,
            startX: el.x,
            startY: el.y,
        };

        window.addEventListener("mousemove", handleDragMove);
        window.addEventListener("mouseup", handleDragEnd);
    }

    function handleDragMove(e: MouseEvent) {
        if (!dragging) return;

        const el = placedElements.find((r) => r.id === dragging!.id);
        if (!el) return;

        const page = pages[el.page];
        if (!page) return;

        const container = pageContainers[el.page];
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const scaleX = page.canvasWidth / containerRect.width;
        const scaleY = page.canvasHeight / containerRect.height;

        const dx = (e.clientX - dragging.startMouseX) * scaleX;
        const dy = (e.clientY - dragging.startMouseY) * scaleY;

        el.x = dragging.startX + dx;
        el.y = dragging.startY + dy;
    }

    function handleDragEnd() {
        if (!dragging) return;
        const el = placedElements.find((r) => r.id === dragging!.id);
        if (el) {
            onmove?.(el);
        }
        dragging = null;
        window.removeEventListener("mousemove", handleDragMove);
        window.removeEventListener("mouseup", handleDragEnd);
    }

    // --- Resize handlers ---
    function handleResizeStart(e: MouseEvent, el: PlacedRect, handle: string) {
        if (mode !== "design") return;
        e.stopPropagation();
        e.preventDefault();

        resizing = {
            id: el.id,
            handle,
            startMouseX: e.clientX,
            startMouseY: e.clientY,
            startX: el.x,
            startY: el.y,
            startWidth: el.width,
            startHeight: el.height,
        };

        window.addEventListener("mousemove", handleResizeMove);
        window.addEventListener("mouseup", handleResizeEnd);
    }

    function handleResizeMove(e: MouseEvent) {
        if (!resizing) return;

        const el = placedElements.find((r) => r.id === resizing!.id);
        if (!el) return;

        const page = pages[el.page];
        if (!page) return;

        const container = pageContainers[el.page];
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const scaleX = page.canvasWidth / containerRect.width;
        const scaleY = page.canvasHeight / containerRect.height;

        const dx = (e.clientX - resizing.startMouseX) * scaleX;
        const dy = (e.clientY - resizing.startMouseY) * scaleY;

        const MIN_SIZE = 40;

        let newX = resizing.startX;
        let newY = resizing.startY;
        let newW = resizing.startWidth;
        let newH = resizing.startHeight;

        // Horizontal handles
        if (resizing.handle.includes("e")) {
            newW = Math.max(MIN_SIZE, resizing.startWidth + dx);
        }
        if (resizing.handle.includes("w")) {
            const proposedW = Math.max(MIN_SIZE, resizing.startWidth - dx);
            newX = resizing.startX + (resizing.startWidth - proposedW) / 2;
            newW = proposedW;
        }

        // Vertical handles
        if (resizing.handle.includes("s")) {
            newH = Math.max(MIN_SIZE, resizing.startHeight + dy);
        }
        if (resizing.handle.includes("n")) {
            const proposedH = Math.max(MIN_SIZE, resizing.startHeight - dy);
            newY = resizing.startY + (resizing.startHeight - proposedH) / 2;
            newH = proposedH;
        }

        el.x = newX;
        el.y = newY;
        el.width = newW;
        el.height = newH;
    }

    function handleResizeEnd() {
        if (!resizing) return;
        const el = placedElements.find((r) => r.id === resizing!.id);
        if (el) {
            onresize?.(el);
        }
        resizing = null;
        window.removeEventListener("mousemove", handleResizeMove);
        window.removeEventListener("mouseup", handleResizeEnd);
    }

    function boxStyle(el: PlacedRect, page: { canvasWidth: number; canvasHeight: number }) {
        return `
            left: ${((el.x - el.width / 2) / page.canvasWidth) * 100}%;
            top: ${((el.y - el.height / 2) / page.canvasHeight) * 100}%;
            width: ${(el.width / page.canvasWidth) * 100}%;
            height: ${(el.height / page.canvasHeight) * 100}%;
        `;
    }

    function labelFor(el: PlacedRect): string {
        let label = el.label ?? "Signature";
        if (el.assignedTo) {
            const name = recipientName(el.assignedTo);
            if (name) label += ` · ${name}`;
        }
        return label;
    }

    function recipientName(id: string): string {
        if (id === "me") return "Me";
        const r = recipients.find((r) => r.id === id);
        if (r?.name) return r.name;
        return r ? `Person ${r.personNum}` : "";
    }

    function handleContextMenu(e: MouseEvent, el: PlacedRect) {
        if (mode !== "design") return;
        e.preventDefault();
        e.stopPropagation();
        contextMenu = { el, x: e.clientX, y: e.clientY };
    }

    function closeContextMenu() {
        contextMenu = null;
    }

    let menuClampedStyle = $derived(
        contextMenu
            ? `left: ${Math.min(Math.max(contextMenu.x, 8), window.innerWidth - 228)}px; top: ${Math.min(Math.max(contextMenu.y, 8), window.innerHeight - 420)}px;`
            : "",
    );

    function handleReassign(id: string, newAssignedTo: string) {
        const el = placedElements.find((r) => r.id === id);
        if (el) el.assignedTo = newAssignedTo;
        onreassign?.(id, newAssignedTo);
        contextMenu = null;
    }

    function handleDeleteBox(id: string) {
        placedElements = placedElements.filter((r) => r.id !== id);
        ondelete?.(id);
        contextMenu = null;
    }

    let pageIsInteractive = $derived(mode === "design" && activeTool !== null);
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="mx-auto max-w-3xl" onwheel={handleWheel}>
    {#if loading}
        <p class="text-neutral-500">Loading document&hellip;</p>
    {:else}
        <div style={wrapperHeight}>
            <div
                class="flex flex-col gap-4"
                style="transform: scale({zoom}); transform-origin: top center;"
                bind:this={pagesWrapper}
            >
                {#each pages as page, i (i)}
                    {@const pageElements = placedElements.filter((el) => el.page === i)}
                    {#snippet pageBody()}
                        <canvas
                            width={page.canvasWidth}
                            height={page.canvasHeight}
                            class="w-full h-auto"
                            class:pointer-events-none={pageIsInteractive}
                            use:renderPageAction={i + 1}
                        ></canvas>

                        {#each pageElements as el (el.id)}
                            {#if mode === "design"}
                                <!-- Design mode: always draggable, resizable -->
                                <div
                                    class="absolute cursor-move border-2 border-blue-500 bg-blue-500/10 select-none"
                                    class:border-dashed={activeTool === null &&
                                        dragging?.id !== el.id}
                                    style={boxStyle(el, page)}
                                    onmousedown={(e) => handleDragStart(e, el)}
                                    oncontextmenu={(e) => handleContextMenu(e, el)}
                                    role="button"
                                    tabindex="0"
                                    title="Drag to move · Drag handles to resize · Right-click for options"
                                >
                                    <span
                                        class="absolute inset-0 flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300 pointer-events-none"
                                    >
                                        {labelFor(el)}
                                    </span>
                                    <!-- nw -->
                                    <div
                                        class="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm z-10"
                                        style="top: -4px; left: -4px; cursor: nw-resize;"
                                        role="button"
                                        tabindex="-1"
                                        aria-label="Resize top-left"
                                        onmousedown={(e) => handleResizeStart(e, el, "nw")}
                                    ></div>
                                    <!-- n -->
                                    <div
                                        class="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm z-10"
                                        style="top: -4px; left: 50%; margin-left: -4px; cursor: n-resize;"
                                        role="button"
                                        tabindex="-1"
                                        aria-label="Resize top"
                                        onmousedown={(e) => handleResizeStart(e, el, "n")}
                                    ></div>
                                    <!-- ne -->
                                    <div
                                        class="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm z-10"
                                        style="top: -4px; right: -4px; cursor: ne-resize;"
                                        role="button"
                                        tabindex="-1"
                                        aria-label="Resize top-right"
                                        onmousedown={(e) => handleResizeStart(e, el, "ne")}
                                    ></div>
                                    <!-- e -->
                                    <div
                                        class="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm z-10"
                                        style="top: 50%; margin-top: -4px; right: -4px; cursor: e-resize;"
                                        role="button"
                                        tabindex="-1"
                                        aria-label="Resize right"
                                        onmousedown={(e) => handleResizeStart(e, el, "e")}
                                    ></div>
                                    <!-- se -->
                                    <div
                                        class="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm z-10"
                                        style="bottom: -4px; right: -4px; cursor: se-resize;"
                                        role="button"
                                        tabindex="-1"
                                        aria-label="Resize bottom-right"
                                        onmousedown={(e) => handleResizeStart(e, el, "se")}
                                    ></div>
                                    <!-- s -->
                                    <div
                                        class="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm z-10"
                                        style="bottom: -4px; left: 50%; margin-left: -4px; cursor: s-resize;"
                                        role="button"
                                        tabindex="-1"
                                        aria-label="Resize bottom"
                                        onmousedown={(e) => handleResizeStart(e, el, "s")}
                                    ></div>
                                    <!-- sw -->
                                    <div
                                        class="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm z-10"
                                        style="bottom: -4px; left: -4px; cursor: sw-resize;"
                                        role="button"
                                        tabindex="-1"
                                        aria-label="Resize bottom-left"
                                        onmousedown={(e) => handleResizeStart(e, el, "sw")}
                                    ></div>
                                    <!-- w -->
                                    <div
                                        class="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm z-10"
                                        style="top: 50%; margin-top: -4px; left: -4px; cursor: w-resize;"
                                        role="button"
                                        tabindex="-1"
                                        aria-label="Resize left"
                                        onmousedown={(e) => handleResizeStart(e, el, "w")}
                                    ></div>
                                </div>
                            {:else if isSigned(el.id)}
                                <!-- Sign mode: signed -->
                                <div
                                    role="img"
                                    class="absolute"
                                    style={boxStyle(el, page)}
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
                                <!-- Sign mode: unsigned -->
                                <button
                                    type="button"
                                    class="absolute cursor-pointer border-2 border-green-500 bg-green-500/10 transition-colors hover:bg-red-500/20 hover:border-red-500"
                                    style={boxStyle(el, page)}
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

                        <!-- Live preview while drawing -->
                        {#if drawing?.pageIndex === i}
                            {@const dw = Math.abs(drawing.currentX - drawing.startX)}
                            {@const dh = Math.abs(drawing.currentY - drawing.startY)}
                            {@const dx = (drawing.startX + drawing.currentX) / 2}
                            {@const dy = (drawing.startY + drawing.currentY) / 2}
                            <div
                                class="absolute border-2 border-blue-400 bg-blue-400/20 pointer-events-none"
                                style="
                                left: {((dx - dw / 2) / page.canvasWidth) * 100}%;
                                top: {((dy - dh / 2) / page.canvasHeight) * 100}%;
                                width: {(dw / page.canvasWidth) * 100}%;
                                height: {(dh / page.canvasHeight) * 100}%;
                            "
                            ></div>
                        {/if}
                    {/snippet}

                    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                    <div
                        class="relative rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
                        class:cursor-crosshair={pageIsInteractive}
                        bind:this={pageContainers[i]}
                        onmousedown={pageIsInteractive
                            ? (e: MouseEvent) => handlePageMouseDown(e, i)
                            : undefined}
                        onkeydown={pageIsInteractive
                            ? (e: KeyboardEvent) => handlePageKeyDown(e, i)
                            : undefined}
                        role={pageIsInteractive ? "button" : undefined}
                        tabindex={pageIsInteractive ? 0 : -1}
                    >
                        {@render pageBody()}
                    </div>
                {/each}
            </div>
        </div>

        <!-- Zoom controls -->
        <div
            class="sticky bottom-0 flex items-center justify-center gap-2 py-2 bg-white/90 dark:bg-neutral-950/90 backdrop-blur border-t border-neutral-200 dark:border-neutral-700 rounded-b-lg"
        >
            <button
                type="button"
                class="px-2 py-1 text-sm rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition disabled:opacity-30"
                onclick={() => changeZoom(-ZOOM_STEP)}
                disabled={zoom <= ZOOM_MIN}
                aria-label="Zoom out">−</button
            >
            <span class="text-xs text-neutral-500 tabular-nums min-w-12 text-center"
                >{zoomPercent}%</span
            >
            <button
                type="button"
                class="px-2 py-1 text-sm rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition disabled:opacity-30"
                onclick={() => changeZoom(ZOOM_STEP)}
                disabled={zoom >= ZOOM_MAX}
                aria-label="Zoom in">+</button
            >
            <span class="text-neutral-300 dark:text-neutral-600 mx-2">|</span>
            <span class="text-xs text-neutral-500 tabular-nums"
                >{totalPages} page{totalPages !== 1 ? "s" : ""}</span
            >
        </div>
    {/if}
</div>

<!-- Context menu overlay -->
{#if contextMenu}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-40"
        onmousedown={closeContextMenu}
        oncontextmenu={(e) => {
            e.preventDefault();
            closeContextMenu();
        }}
    ></div>
    <div
        class="fixed z-50 min-w-50 max-h-[65vh] flex flex-col rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        style={menuClampedStyle}
        role="menu"
        tabindex="-1"
    >
        <!-- Current assignee -->
        <div class="shrink-0 px-3 py-2 border-b border-neutral-100 dark:border-neutral-800">
            <span class="text-xs text-neutral-400 uppercase tracking-wider">Assigned to</span>
            <p class="text-sm font-medium mt-0.5">
                {#if contextMenu.el.assignedTo}
                    {recipientName(contextMenu.el.assignedTo)}
                {:else}
                    <span class="text-neutral-400 italic">Unassigned</span>
                {/if}
            </p>
        </div>

        <!-- Reassign — scrollable -->
        <div
            class="flex-1 min-h-0 flex flex-col overflow-y-auto px-2 py-1 border-b border-neutral-100 dark:border-neutral-800"
        >
            <span
                class="block shrink-0 px-1 py-0.5 text-xs text-neutral-400 uppercase tracking-wider"
                >Reassign to</span
            >
            <!-- Unassign option -->
            <button
                type="button"
                class="shrink-0 w-full text-left px-2 py-1 text-sm rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                onclick={() => handleReassign(contextMenu!.el.id, "")}
            >
                <span class="text-neutral-400 italic">Unassigned</span>
            </button>
            <button
                type="button"
                class="shrink-0 w-full text-left px-2 py-1 text-sm rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                onclick={() => handleReassign(contextMenu!.el.id, "me")}
            >
                Me
            </button>
            {#each recipients as r (r.id)}
                <button
                    type="button"
                    class="w-full text-left px-2 py-1 text-sm rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                    class:font-semibold={contextMenu!.el.assignedTo === r.id}
                    onclick={() => handleReassign(contextMenu!.el.id, r.id)}
                >
                    {r.name || `Person ${r.personNum}`}
                </button>
            {/each}
        </div>

        <!-- Delete -->
        <div class="shrink-0 px-2 py-1">
            <button
                type="button"
                class="w-full text-left px-2 py-1 text-sm text-red-600 rounded hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950 transition"
                onclick={() => handleDeleteBox(contextMenu!.el.id)}
            >
                Delete
            </button>
        </div>
    </div>
{/if}
