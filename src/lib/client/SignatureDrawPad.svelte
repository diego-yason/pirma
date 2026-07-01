<script lang="ts">
    let canvas = $state<HTMLCanvasElement>();
    let drawing = $state(false);

    export function getBlob(): Promise<Blob | null> {
        return new Promise((resolve) => canvas?.toBlob(resolve, "image/png") ?? resolve(null));
    }

    export function clear() {
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function startDraw(e: MouseEvent | TouchEvent) {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext("2d")!;
        const pos = "touches" in e ? e.touches[0] : e;
        ctx.beginPath();
        ctx.moveTo(pos.clientX - rect.left, pos.clientY - rect.top);
        drawing = true;
    }

    function draw(e: MouseEvent | TouchEvent) {
        if (!drawing || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext("2d")!;
        const pos = "touches" in e ? e.touches[0] : e;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#000";
        ctx.lineTo(pos.clientX - rect.left, pos.clientY - rect.top);
        ctx.stroke();
    }

    function endDraw() {
        drawing = false;
    }
</script>

<div class="rounded-lg border border-neutral-300 dark:border-neutral-600 overflow-hidden bg-white">
    <canvas
        bind:this={canvas}
        width="500"
        height="200"
        class="touch-none w-full"
        style="height: 160px; cursor: crosshair;"
        onmousedown={startDraw}
        onmousemove={draw}
        onmouseup={endDraw}
        onmouseleave={endDraw}
        ontouchstart={startDraw}
        ontouchmove={draw}
        ontouchend={endDraw}
    ></canvas>
</div>
