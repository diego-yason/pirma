<script lang="ts">
    import { getContext } from "svelte";
    import type { PageProps } from "./$types";
    import type { PlacedRect, RecipientInfo, FieldKind } from "#lib/client/types/SignatureBoxTypes";
    import { FIELD_TOOLS } from "#lib/client/types/field-tools.js";
    import { PUBLIC_MAX_RECIPIENTS } from "$app/env/public";
    import PDFViewer from "#lib/client/ui/PDFViewer.svelte";
    import DocumentSelector from "#lib/client/ui/DocumentSelector.svelte";
    import { resolve } from "$app/paths";

    const MAX_RECIPIENTS = Number(PUBLIC_MAX_RECIPIENTS) || 100;

    let { data }: PageProps = $props();
    let { documents, placementFields } = $derived(data);

    const { setStep } = getContext<{ setStep: (n: number) => void }>("step");
    $effect(() => {
        setStep(2);
    });

    // --- Tool & box state ---
    type Tool = FieldKind | null;
    let activeTool = $state<Tool>(null);

    // Standardized field-tool definitions (see #lib/client/types/field-tools.js)
    const signatureTool = FIELD_TOOLS.find((t) => t.kind === "signature")!;
    const textTool = FIELD_TOOLS.find((t) => t.kind === "text")!;
    const alternativeTools = FIELD_TOOLS.filter((t) => t.group === "alternative");
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
        refreshFieldSnapshot();
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
        refreshFieldSnapshot();
        triggerSync();
    }

    function handleBoxDelete(id: string) {
        placedBoxes = placedBoxes.filter((b) => b.id !== id);
        refreshFieldSnapshot();
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
            refreshFieldSnapshot();
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

    // Block step 3 while any field across all documents is unassigned.
    // Tracked from a state snapshot refreshed on every mutation — Svelte may
    // not observe deep prop mutations on `placementFields`, so a plain
    // `$derived` over it would go stale (the checker wouldn't clear).
    // svelte-ignore state_referenced_locally
    // — seed once, refresh explicitly via refreshFieldSnapshot()
    let fieldSnapshot = $state<PlacedRect[]>(placementFields.flat().filter((f) => !!f));
    function refreshFieldSnapshot() {
        fieldSnapshot = placementFields.flat().filter((f) => !!f);
    }
    const hasUnassignedFields = $derived(fieldSnapshot.some((b) => !b.assignedTo));
    const unassignedFieldCount = $derived(fieldSnapshot.filter((b) => !b.assignedTo).length);
    let showUnassignedWarning = $state(false);
</script>

<div class="mt-8 ml-5 flex h-[calc(100vh-16rem)] min-h-0 gap-4 pr-5">
    <DocumentSelector {documents} bind:selected={selectedDocIndex} />

    <div
        class="flex-1 overflow-y-auto rounded-xl border border-neutral-200 bg-white/50 dark:border-neutral-800 dark:bg-neutral-900/20"
    >
        {#if !selectedDoc}
            <p class="px-2 text-sm text-neutral-500 dark:text-neutral-400">No document selected.</p>
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
    <div
        class="flex min-h-0 flex-1 flex-col border-l border-neutral-200 bg-white/70 dark:border-neutral-800 dark:bg-neutral-900/40"
    >
        <!-- Field Tools -->
        <div class="shrink-0 border-b border-neutral-200 px-4 py-4 dark:border-neutral-800">
            <div class="mb-3 flex items-center gap-1.5">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    class="size-4 text-secondary-600 dark:text-secondary-400"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M11 4a2 2 0 1 1 4 0 2 2 0 0 1-4 0ZM18.4 6.6a2 2 0 0 1 2.8 2.8l-9 9-3.5.7.7-3.5 9-9Z"
                    ></path>
                </svg>
                <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                    Field Tools
                </h2>
            </div>

            <div class="flex gap-2">
                <!-- Signature (primary) — full height -->
                <button
                    type="button"
                    class="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg border px-3 py-3 text-sm font-medium transition
                        {activeTool === signatureTool.kind
                        ? 'border-secondary-500 bg-secondary-500/10 text-secondary-700 dark:bg-secondary-500/15 dark:text-secondary-300'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-secondary-500/50 hover:bg-neutral-50 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-secondary-500/50 dark:hover:bg-neutral-800 dark:hover:text-white'}"
                    onclick={() => activateTool(signatureTool.kind)}
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        class="size-5"
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" d={signatureTool.icon}
                        ></path>
                    </svg>
                    {signatureTool.label}
                </button>

                <!-- Right column: text field (top half) + others dropdown (bottom half) -->
                <div class="flex flex-1 flex-col gap-2">
                    <button
                        type="button"
                        class="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg border px-3 py-3 text-sm font-medium transition
                            {activeTool === textTool.kind
                            ? 'border-secondary-500 bg-secondary-500/10 text-secondary-700 dark:bg-secondary-500/15 dark:text-secondary-300'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:border-secondary-500/50 hover:bg-neutral-50 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-secondary-500/50 dark:hover:bg-neutral-800 dark:hover:text-white'}"
                        onclick={() => activateTool(textTool.kind)}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            class="size-5"
                        >
                            <path stroke-linecap="round" stroke-linejoin="round" d={textTool.icon}
                            ></path>
                        </svg>
                        {textTool.label}
                    </button>

                    <!-- Others dropdown: alternative field kinds (checkbox, date, initials, …) -->
                    <div class="relative flex-1">
                        <select
                            class="h-full w-full appearance-none rounded-lg border border-neutral-300 bg-white px-3 py-2 pr-9 text-sm text-neutral-600 transition focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:focus:border-secondary-500"
                            value={activeTool && alternativeTools.some((t) => t.kind === activeTool)
                                ? activeTool
                                : ""}
                            onchange={(e) =>
                                activateTool((e.currentTarget.value || null) as FieldKind | null)}
                            aria-label="Add alternative field"
                        >
                            <option selected class="hidden" value="">Others</option>
                            <option value="">---</option>
                            {#each alternativeTools as t (t.kind)}
                                <option value={t.kind}>{t.label}</option>
                            {/each}
                        </select>
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-neutral-400"
                        >
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"
                            ></path>
                        </svg>
                    </div>
                </div>
            </div>

            <!-- dropdown -->
            <div class="mt-3">
                <label
                    for="assignedTo"
                    class="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400"
                >
                    Assign fields to
                </label>
                <select
                    id="assignedTo"
                    class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 transition focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
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

        <!-- Recipients -->
        <div class="flex min-h-0 flex-1 flex-col px-4 py-4">
            <div class="mb-3 flex items-center justify-between">
                <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                    Recipients
                </h2>
                {#if recipients.length > 0}
                    <span
                        class="rounded-full bg-secondary-500/15 px-2 py-0.5 text-[10px] font-semibold text-secondary-600 dark:text-secondary-300"
                    >
                        {recipients.length}
                    </span>
                {/if}
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto pr-2" bind:this={recipientsContainer}>
                {#if recipients.length > 0}
                    <div class="mb-3 flex flex-col gap-2">
                        {#each recipients as r (r.id)}
                            <div
                                class="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/60"
                            >
                                <div class="flex items-center gap-2">
                                    <span
                                        class="grid size-7 shrink-0 place-items-center rounded-full bg-secondary-500/15 text-xs font-bold text-secondary-600 dark:text-secondary-300"
                                    >
                                        {r.personNum}
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="Person {r.personNum}"
                                        class="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                                        bind:value={r.name}
                                        oninput={onRecipientChange}
                                    />
                                </div>
                                <input
                                    type="email"
                                    placeholder="Email"
                                    class="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                                    bind:value={r.email}
                                    oninput={onRecipientChange}
                                />
                                <div class="flex items-center justify-between">
                                    <div
                                        class="inline-flex overflow-hidden rounded-lg border border-neutral-300 text-xs dark:border-neutral-700"
                                    >
                                        <button
                                            type="button"
                                            class="px-3 py-1.5 font-medium transition
                                                {r.role === 'signer'
                                                ? 'bg-linear-to-r from-secondary-600 to-primary-700 text-white'
                                                : 'bg-white text-neutral-500 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800'}"
                                            onclick={() => toggleRole(r, "signer")}
                                        >
                                            Signer
                                        </button>
                                        <button
                                            type="button"
                                            class="px-3 py-1.5 font-medium transition
                                                {r.role === 'viewer'
                                                ? 'bg-linear-to-r from-secondary-600 to-primary-700 text-white'
                                                : 'bg-white text-neutral-500 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800'}"
                                            onclick={() => toggleRole(r, "viewer")}
                                        >
                                            Viewer
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        class="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                                        onclick={() => removeRecipient(r.id)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}

                {#if recipients.length < MAX_RECIPIENTS}
                    <button
                        type="button"
                        class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-600 transition hover:border-secondary-500/60 hover:bg-secondary-500/5 hover:text-secondary-700 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-secondary-500/60 dark:hover:bg-secondary-500/10 dark:hover:text-secondary-300"
                        onclick={addRecipientAndScroll}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            class="size-4"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M12 5v14M5 12h14"
                            ></path>
                        </svg>
                        Add Recipient
                    </button>
                {:else}
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">
                        Maximum {MAX_RECIPIENTS} recipients reached.
                    </p>
                {/if}

                <a
                    href={resolve(`doc/new/${data.packageId}/confirm`)}
                    onclick={(e) => {
                        if (hasUnassignedFields) {
                            e.preventDefault();
                            showUnassignedWarning = true;
                        }
                    }}
                    class="mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition
                        {hasUnassignedFields
                        ? 'cursor-not-allowed bg-neutral-300 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400'
                        : 'bg-linear-to-r from-secondary-600 to-primary-700 text-white shadow-sm hover:from-secondary-500 hover:to-primary-600'}"
                    aria-disabled={hasUnassignedFields}
                >
                    Next
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        class="size-4"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M13 5l7 7-7 7M5 12h15"
                        ></path>
                    </svg>
                </a>
                {#if showUnassignedWarning && hasUnassignedFields}
                    <p class="mt-2 text-center text-xs text-amber-600 dark:text-amber-400">
                        Assign every field to a recipient (or "Me") before continuing —
                        {unassignedFieldCount} unassigned.
                    </p>
                {/if}
            </div>
        </div>
    </div>
</div>
