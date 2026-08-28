<script lang="ts">
    import { deserialize } from "$app/forms";
    import type { PageProps } from "./$types";
    import type { PlacedRect, FieldKind, RecipientInfo } from "#lib/client/types/SignatureBoxTypes.d.ts";
    import { FIELD_TOOLS } from "#lib/client/types/field-tools.js";
    import PDFViewer from "#lib/client/ui/PDFViewer.svelte";

    let { data }: PageProps = $props();

    type Tool = FieldKind | null;
    let activeTool = $state<Tool>(null);

    const signatureTool = FIELD_TOOLS.find((t) => t.kind === "signature")!;
    const textTool = FIELD_TOOLS.find((t) => t.kind === "text")!;
    const alternativeTools = FIELD_TOOLS.filter((t) => t.group === "alternative");

    // Seed once from the loaded data — the editor owns the array afterwards.
    // svelte-ignore state_referenced_locally
    let placedBoxes = $state<PlacedRect[]>(JSON.parse(JSON.stringify(data.placementFields ?? [])));

    interface TemplateSignatory {
        id: string;
        name: string;
    }
    // svelte-ignore state_referenced_locally
    let signatories = $state<TemplateSignatory[]>(
        JSON.parse(JSON.stringify(data.signatories ?? [])),
    );
    const signatoryInfos = $derived<RecipientInfo[]>(
        signatories.map((s, i) => ({ id: s.id, name: s.name, personNum: i + 1 })),
    );

    let saving = $state(false);
    let saveState = $state<"idle" | "saved" | "error">("idle");
    let saveError = $state("");

    function activateTool(tool: Tool) {
        activeTool = activeTool === tool ? null : tool;
    }

    function replaceBox(rect: PlacedRect) {
        const idx = placedBoxes.findIndex((b) => b.id === rect.id);
        if (idx !== -1) placedBoxes[idx] = rect;
        else placedBoxes.push(rect);
    }

    function handleBoxAdd(rect: PlacedRect) {
        placedBoxes.push(rect);
        activeTool = null; // one box per activation
        saveFields();
    }

    function handleBoxMove(rect: PlacedRect) {
        replaceBox(rect);
        saveFields();
    }

    function handleBoxResize(rect: PlacedRect) {
        replaceBox(rect);
        saveFields();
    }

    function handleBoxDelete(id: string) {
        placedBoxes = placedBoxes.filter((b) => b.id !== id);
        saveFields();
    }

    function handleBoxReassign(id: string, newAssignedTo: string) {
        const box = placedBoxes.find((b) => b.id === id);
        if (box) box.assignedTo = newAssignedTo || undefined;
        saveFields();
    }

    function addSignatory() {
        signatories.push({ id: crypto.randomUUID(), name: `Person ${signatories.length + 1}` });
        saveFields();
    }

    function updateSignatory(id: string, name: string) {
        const s = signatories.find((x) => x.id === id);
        if (s) {
            s.name = name;
            saveFields();
        }
    }

    function removeSignatory(id: string) {
        signatories = signatories.filter((s) => s.id !== id);
        // Fields assigned to the removed signatory become unassigned.
        placedBoxes = placedBoxes.map((b) =>
            b.assignedTo === id ? { ...b, assignedTo: undefined } : b,
        );
        saveFields();
    }

    async function saveFields() {
        if (saving) return;
        saving = true;
        saveState = "idle";
        try {
            const body = new FormData();
            body.append("placementFields", JSON.stringify(placedBoxes));
            body.append("signatories", JSON.stringify(signatories));
            const res = await fetch(`/templates/${data.templateId}?/saveFields`, {
                method: "POST",
                body,
                headers: { "x-sveltekit-action": "true" },
            });
            const result = deserialize(await res.text());
            if (result.type === "success") {
                saveState = "saved";
            } else {
                saveState = "error";
                saveError =
                    result.type === "failure"
                        ? ((result.data as { error?: string } | undefined)?.error ??
                          "Could not save changes.")
                        : "Could not save changes.";
            }
        } catch (err) {
            saveState = "error";
            saveError = err instanceof Error ? err.message : "Could not save changes.";
        } finally {
            saving = false;
        }
    }
</script>

<div class="mt-8 ml-5 flex h-[calc(100vh-16rem)] min-h-0 gap-4 pr-5">
    <div
        class="flex-1 overflow-y-auto rounded-xl border border-neutral-200 bg-white/50 dark:border-neutral-800 dark:bg-neutral-900/20"
    >
        {#if !data.pdfUrl}
            <p class="px-2 text-sm text-neutral-500 dark:text-neutral-400">Preview unavailable.</p>
        {:else}
            <PDFViewer
                pdfUrl={data.pdfUrl}
                mode="design"
                {activeTool}
                elements={placedBoxes}
                recipients={signatoryInfos}
                allowMe={false}
                onadd={handleBoxAdd}
                onmove={handleBoxMove}
                onresize={handleBoxResize}
                onreassign={handleBoxReassign}
                ondelete={handleBoxDelete}
            />
        {/if}
    </div>

    <div
        class="flex min-h-0 w-72 flex-col overflow-y-auto border-l border-neutral-200 bg-white/70 dark:border-neutral-800 dark:bg-neutral-900/40"
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
                <!-- Signature (primary) -->
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

                <!-- Text (primary) + Others dropdown -->
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

            <p class="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                Fields on a template are generic — assign them to a signatory below (or assign
                them to recipients when you start a new document).
            </p>
        </div>

        <!-- Signatories -->
        <div class="shrink-0 border-b border-neutral-200 px-4 py-4 dark:border-neutral-800">
            <div class="mb-2 flex items-center justify-between">
                <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                    Signatories
                </h2>
                <button
                    type="button"
                    onclick={addSignatory}
                    class="rounded-lg border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:text-neutral-100"
                >
                    + Add
                </button>
            </div>
            <p class="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
                Placeholders that become default signers when you start a document from this
                template. Right-click a field to assign it to a signatory.
            </p>
            <div class="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
                {#each signatories as s (s.id)}
                    <div class="flex items-center gap-1.5">
                        <input
                            type="text"
                            value={s.name}
                            oninput={(e) => updateSignatory(s.id, e.currentTarget.value)}
                            placeholder="Name"
                            class="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                        />
                        <button
                            type="button"
                            onclick={() => removeSignatory(s.id)}
                            aria-label={`Remove ${s.name}`}
                            class="grid size-7 shrink-0 place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-red-600 dark:hover:bg-neutral-800 dark:hover:text-red-400"
                        >
                            ✕
                        </button>
                    </div>
                {:else}
                    <p class="text-xs text-neutral-400 dark:text-neutral-500">
                        No signatories yet.
                    </p>
                {/each}
            </div>
        </div>

        <!-- Footer -->
        <div class="mt-auto shrink-0 border-t border-neutral-200 px-4 py-4 dark:border-neutral-800">
            <div class="flex items-center justify-between gap-3">
                <span class="min-w-0 text-xs text-neutral-500 dark:text-neutral-400">
                    {#if saveState === "saved"}
                        <span class="text-emerald-600 dark:text-emerald-400">Saved</span>
                    {:else if saveState === "error"}
                        <span class="text-red-600 dark:text-red-400">{saveError}</span>
                    {:else if saving}
                        Saving…
                    {:else}
                        Unsaved changes
                    {/if}
                </span>
                <a
                    href="/templates"
                    class="rounded-lg bg-linear-to-r from-secondary-600 to-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-secondary-500 hover:to-primary-600"
                >
                    Done
                </a>
            </div>
        </div>
    </div>
</div>
