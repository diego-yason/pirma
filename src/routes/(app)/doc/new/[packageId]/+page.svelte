<script lang="ts">
    import { getContext } from "svelte";
    import type { PageProps } from "./$types";
    import type { PlacedRect, RecipientInfo } from "$lib/client/types/SignatureBoxTypes";
    import { PUBLIC_MAX_RECIPIENTS } from "$env/static/public";
    import PDFViewer from "$lib/client/PDFViewer.svelte";
    import DocumentSelector from "$lib/client/ui/DocumentSelector.svelte";
    import { resolve } from "$app/paths";

    const MAX_RECIPIENTS = Number(PUBLIC_MAX_RECIPIENTS) || 100;

    let { data }: PageProps = $props();
    let { documents, placementFields } = $derived(data);

    const { setStep } = getContext<{ setStep: (n: number) => void }>("step");
    $effect(() => {
        setStep(2);
    });

    // --- Tool & box state ---
    type Tool = "signature" | "text" | null;
    let activeTool = $state<Tool>(null);
    let selectedDocIndex = $state(0);
    let placedBoxes = $derived<PlacedRect[]>(placementFields[selectedDocIndex] ?? []);
    let selectedDoc: string = $derived(documents[selectedDocIndex]?.url ?? "");

    function activateTool(tool: Tool) {
        // Toggle: clicking the active tool deactivates it
        activeTool = activeTool === tool ? null : tool;
    }

    function handleBoxAdd(rect: PlacedRect) {
        // Stamp the currently selected recipient onto the box
        rect.assignedTo = assignedTo || undefined;
        placedBoxes.push(rect);
        triggerSync();
        // One box per activation — deactivate after placing
        activeTool = null;
    }

    function handleBoxMove() {
        triggerSync();
    }

    function handleBoxResize() {
        triggerSync();
    }

    function handleBoxReassign(id: string, newAssignedTo: string) {
        const box = placedBoxes.find((b) => b.id === id);
        if (box) box.assignedTo = newAssignedTo || undefined;
        triggerSync();
    }

    function handleBoxDelete(id: string) {
        placedBoxes = placedBoxes.filter((b) => b.id !== id);
        triggerSync();
    }

    // --- Recipients ---
    interface Recipient {
        id: string;
        name: string;
        email: string;
        personNum: number;
        role: "signer" | "viewer";
    }

    function seedRecipients(): { list: Recipient[]; nextNum: number } {
        if (data.recipients.length > 0) {
            const list = data.recipients;
            const nextNum = Math.max(0, ...list.map((r) => r.personNum)) + 1;
            return { list, nextNum };
        }
        return {
            list: [],
            nextNum: 1,
        };
    }

    const seed = seedRecipients();
    let recipients = $state<Recipient[]>(seed.list);
    let nextPersonNum = $state(seed.nextNum);

    let saving = $state(false);
    let pendingSync = $state(false);
    let assignedTo = $state("");
    let recipientsContainer = $state<HTMLDivElement>();

    function triggerSync() {
        if (saving) {
            // A sync is already in flight — flag a resync for when it completes
            pendingSync = true;
            return;
        }
        syncToServer();
    }

    function addRecipient() {
        const id = crypto.randomUUID();
        recipients.push({
            id,
            name: "",
            email: "",
            personNum: nextPersonNum++,
            role: "signer",
        });
        triggerSync();
        return id;
    }

    function addRecipientAndScroll() {
        addRecipient();
        // Scroll to bottom after the DOM updates
        requestAnimationFrame(() => {
            recipientsContainer?.scrollTo({
                top: recipientsContainer.scrollHeight,
                behavior: "smooth",
            });
        });
    }

    function removeRecipient(id: string) {
        recipients = recipients.filter((r) => r.id !== id);
        triggerSync();
    }

    function handleAssignChange() {
        if (assignedTo === "__new__") {
            assignedTo = addRecipient();
        }
    }

    function recipientLabel(r: Recipient): string {
        return r.name.trim() || `Person ${r.personNum}`;
    }

    function onRecipientChange() {
        triggerSync();
    }

    function toggleRole(r: Recipient, role: "signer" | "viewer") {
        r.role = role;
        triggerSync();
    }

    async function syncToServer() {
        saving = true;
        pendingSync = false;

        try {
            const body = new FormData();
            body.append("recipients", JSON.stringify(recipients));
            body.append("placementFields", JSON.stringify(placedBoxes));
            body.append("documentId", documents[selectedDocIndex]?.id);

            await fetch(`/doc/new/${data.packageId}?/syncRecipients`, {
                method: "POST",
                body,
                headers: { "x-sveltekit-action": "true" },
            });
            // update local store
            placementFields[selectedDocIndex] = placedBoxes;
        } catch {
            // silently retry on next change
        } finally {
            saving = false;
            // If another change arrived while we were saving, sync again
            if (pendingSync) {
                syncToServer();
            }
        }
    }
    let recipientInfos = $derived<RecipientInfo[]>(
        recipients.map((r) => ({ id: r.id, name: r.name.trim(), personNum: r.personNum })),
    );
</script>

<div class="ml-5 mt-8 flex gap-4 h-[calc(100vh-16rem)] min-h-0 pr-5">
    <DocumentSelector {documents} bind:selected={selectedDocIndex} />
    <div class="flex-2 overflow-y-auto">
        {#if !selectedDoc}
            <p class="text-neutral-500 text-sm px-2">No document selected.</p>
        {:else}
            <PDFViewer
                pdfUrl={selectedDoc}
                recipients={recipientInfos}
                mode="design"
                {activeTool}
                elements={placedBoxes}
                onadd={handleBoxAdd}
                onmove={handleBoxMove}
                onresize={handleBoxResize}
                onreassign={handleBoxReassign}
                ondelete={handleBoxDelete}
            />
        {/if}
    </div>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="shrink-0">
            <h2 class="text-xl font-semibold uppercase tracking-widest mb-4">Field Tools</h2>
            <div class="flex flex-col gap-2">
                <div class="flex gap-6 px-3">
                    <button
                        class="flex-1 border rounded-md py-4 transition"
                        class:border-blue-500={activeTool === "signature"}
                        class:bg-blue-50={activeTool === "signature"}
                        class:dark:bg-blue-950={activeTool === "signature"}
                        onclick={() => activateTool("signature")}
                    >
                        Add Signature
                    </button>
                    <button
                        class="flex-1 border rounded-md py-4 transition"
                        class:border-blue-500={activeTool === "text"}
                        class:bg-blue-50={activeTool === "text"}
                        class:dark:bg-blue-950={activeTool === "text"}
                        onclick={() => activateTool("text")}
                    >
                        Add Text Field
                    </button>
                </div>
                <!-- dropdown -->
                <label for="assignedTo" class="text-sm">Assigned to:</label>
                <select
                    id="assignedTo"
                    class="rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                    bind:value={assignedTo}
                    onchange={handleAssignChange}
                >
                    <option value="">--</option>
                    <option value="me">Me</option>
                    {#each recipients as r (r.id)}
                        <option value={r.id}>{recipientLabel(r)}</option>
                    {/each}
                    {#if recipients.length < MAX_RECIPIENTS}
                        <option value="__new__">+ New Recipient</option>
                    {/if}
                </select>
            </div>
        </div>
        <h2 class="text-xl font-semibold uppercase tracking-widest mt-6 mb-3 shrink-0">
            Recipients
        </h2>
        <div class="flex-1 min-h-0 overflow-y-auto pr-2" bind:this={recipientsContainer}>
            {#if recipients.length > 0}
                <div class="flex flex-col gap-2 mb-3">
                    {#each recipients as r (r.id)}
                        <div
                            class="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
                        >
                            <input
                                type="text"
                                placeholder="Person {r.personNum}"
                                class="flex-1 rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                                bind:value={r.name}
                                oninput={onRecipientChange}
                            />
                            <input
                                type="email"
                                placeholder="Email"
                                class="flex-1 rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                                bind:value={r.email}
                                oninput={onRecipientChange}
                            />
                            <div class="flex justify-between">
                                <div
                                    class="inline-flex rounded border border-neutral-300 text-xs dark:border-neutral-600"
                                >
                                    <button
                                        type="button"
                                        class="rounded-l px-3 py-1 transition"
                                        class:bg-blue-600={r.role === "signer"}
                                        class:text-white={r.role === "signer"}
                                        class:text-neutral-500={r.role !== "signer"}
                                        class:dark:text-neutral-400={r.role !== "signer"}
                                        onclick={() => toggleRole(r, "signer")}
                                    >
                                        Signer
                                    </button>
                                    <button
                                        type="button"
                                        class="rounded-r px-3 py-1 transition"
                                        class:bg-blue-600={r.role === "viewer"}
                                        class:text-white={r.role === "viewer"}
                                        class:text-neutral-500={r.role !== "viewer"}
                                        class:dark:text-neutral-400={r.role !== "viewer"}
                                        onclick={() => toggleRole(r, "viewer")}
                                    >
                                        Viewer
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    class="shrink-0 rounded px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                                    onclick={() => removeRecipient(r.id)}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}

            {#if recipients.length < MAX_RECIPIENTS}
                <button
                    type="button"
                    class="rounded border border-neutral-300 px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700"
                    onclick={addRecipientAndScroll}
                >
                    + Add Recipient
                </button>
            {:else}
                <p class="text-xs text-neutral-500">Maximum {MAX_RECIPIENTS} recipients reached.</p>
            {/if}

            <a
                href={resolve(`/doc/new/${data.packageId}/confirm`)}
                class="mt-4 block w-full rounded-md bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-blue-700"
            >
                Next
            </a>
        </div>
    </div>
</div>
