<script lang="ts">
    import type { PlacedRect } from "./types";
    import PDFViewer from "./PDFViewer.svelte";

    // Sample elements — coordinates in px at 2x scale (letter portrait ≈ 1224×1584)
    const signatureBlocks: PlacedRect[] = [
        {
            id: "top-1",
            page: 0,
            x: 612,
            y: 396,
            width: 200 * 2,
            height: 48 * 2,
        },
        {
            id: "bottom-1",
            page: 0,
            x: 612,
            y: 1188,
            width: 200 * 2,
            height: 48 * 2,
        },
    ];

    let signedStatus = $state<Record<string, boolean>>(
        signatureBlocks.reduce((acc, el) => ({ ...acc, [el.id]: false }), {}),
    );

    function handleSign(id: string) {
        signedStatus = { ...signedStatus, [id]: true };
    }

    function handleRemove(id: string) {
        const next = { ...signedStatus };
        delete next[id];
        signedStatus = next;
    }
</script>

<div class="flex gap-5 h-full overflow-hidden">
    <div class="basis-4/5 overflow-y-auto min-h-0">
        <PDFViewer
            elements={signatureBlocks}
            {signedStatus}
            onsign={handleSign}
            onremove={handleRemove}
        />
    </div>
    <div class="flex flex-col min-h-0">
        <div class="grow overflow-y-auto border">
            <h2 class="text-lg border-b p-4">Action Center</h2>
            <p class="p-4">
                Please complete all required fields below to finish the signing process.
            </p>
            <div class="flex flex-col gap-4 mt-4 px-4">
                {#each signatureBlocks as block (block.id)}
                    <div class="border rounded-md px-4 py-2">
                        <div class="flex justify-between">
                            <p>Signature</p>
                            {#if signedStatus[block.id]}
                                <p
                                    class="text-tertiary-200 uppercase text-sm bg-tertiary-900/50 px-2 py-1 rounded-md"
                                >
                                    Signed
                                </p>
                            {:else}
                                <p
                                    class="text-red-200 uppercase text-sm bg-red-900/50 px-2 py-1 rounded-md"
                                >
                                    Pending
                                </p>
                            {/if}
                        </div>
                        <p>Page 1</p>
                    </div>
                {/each}
            </div>
        </div>
        <div class="border border-t-0">
            <div class="flex w-full justify-center-safe gap-4 px-4">
                <button
                    class="uppercase basis-4/5 rounded-md font-semibold tracking-wider bg-secondary-600 px-20 text-lg py-3 my-3"
                >
                    Finish Document
                </button>
                <button
                    class="uppercase rounded-md font-semibold tracking-wider bg-neutral-600 px-4 py-3 my-3"
                >
                    Reject Document
                </button>
            </div>
            <p class="text-center text-xs px-12 mb-4">
                By finishing or rejecting this document, you agree to the <a href=""
                    >Terms of Service</a
                >
                and
                <a href="">Privacy Policy</a>.
            </p>
        </div>
    </div>
</div>
