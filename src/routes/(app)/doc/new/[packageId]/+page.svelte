<script lang="ts">
    import { getContext } from "svelte";
    import type { PageProps } from "./$types";
    import { PUBLIC_MAX_RECIPIENTS } from "$env/static/public";

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

    function scheduleSync() {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
            syncToServer();
        }, 1000);
    }

    function addRecipient() {
        recipients.push({
            id: crypto.randomUUID(),
            name: "",
            email: "",
            personNum: nextPersonNum++,
            role: "signer",
        });
        scheduleSync();
    }

    function removeRecipient(id: string) {
        recipients = recipients.filter((r) => r.id !== id);
        scheduleSync();
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

<div class="ml-5 mt-8 flex gap-4">
    <div class="flex-2">viewer here</div>
    <div class="flex-1">
        <div class="">
            <h2 class="text-xl font-semibold uppercase tracking-widest">Field Tools</h2>
            <div class="flex gap-2">
                <button>Add Signature</button>
                <button>Add Text Field</button>
                <!-- dropdown -->
                <label for=""> Assigned to: </label>
                <select name="assignedTo" id="assignedTo">
                    <option value="me">Me</option>
                    <option value="recipient1">Recipient 1</option>
                    <option value="recipient2">Recipient 2</option>
                </select>
            </div>
        </div>
        <div class="mt-6">
            <h2 class="text-xl font-semibold uppercase tracking-widest mb-3">Recipients</h2>

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
                    onclick={addRecipient}
                >
                    + Add Recipient
                </button>
            {:else}
                <p class="text-xs text-neutral-500">Maximum {MAX_RECIPIENTS} recipients reached.</p>
            {/if}
        </div>
    </div>
</div>
