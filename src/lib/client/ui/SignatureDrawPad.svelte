<script lang="ts">
    let canvas = $state<HTMLCanvasElement>();
    let drawing = $state(false);
    let lastPos = $state<{ x: number; y: number } | null>(null);

    export function getBlob(): Promise<Blob | null> {
        return new Promise((resolve) => {
            if (canvas) {
                canvas.toBlob(resolve, "image/png");
            } else {
                resolve(null);
            }
        });
    }

    export function clear() {
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function coords(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
        const rect = canvas.getBoundingClientRect();
        const pos = "touches" in e ? e.touches[0] : e;
        return {
            x: (pos.clientX - rect.left) * (canvas.width / rect.width),
            y: (pos.clientY - rect.top) * (canvas.height / rect.height),
        };
    }

    function startDraw(e: MouseEvent | TouchEvent) {
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        const p = coords(e, canvas);
        lastPos = p;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        drawing = true;
    }

    function draw(e: MouseEvent | TouchEvent) {
        if (!drawing || !canvas) return;
        const ctx = canvas.getContext("2d")!;
        const p = coords(e, canvas);
        lastPos = null; // moved — not a click
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#000";
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    }

    function endDraw() {
        if (!drawing || !canvas) {
            drawing = false;
            return;
        }
        drawing = false;
        // If no movement happened, place a dot
        if (lastPos) {
            const ctx = canvas.getContext("2d")!;
            ctx.beginPath();
            ctx.arc(lastPos.x, lastPos.y, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = "#000";
            ctx.fill();
        }
        lastPos = null;
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
