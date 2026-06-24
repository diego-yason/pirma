<script lang="ts">
    import { getContext } from "svelte";
    import type { PageProps } from "./$types";
    import { PUBLIC_MAX_RECIPIENTS } from "$env/static/public";
    import PDFViewer from "$lib/client/PDFViewer.svelte";

    const MAX_RECIPIENTS = Number(PUBLIC_MAX_RECIPIENTS) || 100;

    let { data }: PageProps = $props();

    const { setStep } = getContext<{ setStep: (n: number) => void }>("step");
    $effect(() => {
        setStep(2);
    });

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
            list: [{ id: crypto.randomUUID(), name: "", email: "", personNum: 1, role: "signer" }],
            nextNum: 2,
        };
    }

    const seed = seedRecipients();
    let recipients = $state<Recipient[]>(seed.list);
    let nextPersonNum = $state(seed.nextNum);

    let syncTimer = $state<ReturnType<typeof setTimeout>>();
    let saving = $state(false);
    let assignedTo = $state("");
    let recipientsContainer = $state<HTMLDivElement>();

    function scheduleSync() {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
            syncToServer();
        }, 1000);
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
        scheduleSync();
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
        scheduleSync();
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
        scheduleSync();
    }

    function toggleRole(r: Recipient, role: "signer" | "viewer") {
        r.role = role;
        scheduleSync();
    }

    async function syncToServer() {
        if (saving) return;
        saving = true;

        try {
            const body = new FormData();
            body.append("recipients", JSON.stringify(recipients));

            await fetch(`/doc/new/${data.packageId}?/syncRecipients`, {
                method: "POST",
                body,
                headers: { "x-sveltekit-action": "true" },
            });
        } catch {
            // silently retry on next change
        } finally {
            saving = false;
        }
    }
</script>

<div class="ml-5 mt-8 flex gap-4 h-[calc(100vh-16rem)] min-h-0 pr-5">
    <div class="flex-2 overflow-y-auto">
        {#if data.pdfUrl}
            <PDFViewer pdfUrl={data.pdfUrl} />
        {:else}
            <p class="text-sm text-neutral-500 p-4">No document in this package yet.</p>
        {/if}
    </div>
    <div class="flex-1 flex flex-col min-h-0">
        <div class="shrink-0">
            <h2 class="text-xl font-semibold uppercase tracking-widest mb-4">Field Tools</h2>
            <div class="flex flex-col gap-2">
                <div class="flex gap-6 px-3">
                    <button class="flex-1 border rounded-md py-4">Add Signature</button>
                    <button class="flex-1 border rounded-md py-4">Add Text Field</button>
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
        </div>
    </div>
</div>
