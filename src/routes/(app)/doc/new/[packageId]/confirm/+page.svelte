<script lang="ts">
    import { getContext } from "svelte";
    import type { PageProps } from "./$types";
    import { slide } from "svelte/transition";

    let { data }: PageProps = $props();

    const { setStep } = getContext<{ setStep: (n: number) => void }>("step");
    $effect(() => {
        setStep(3);
    });

    // svelte-ignore state_referenced_locally
    let mfaRequired = $state(data.mfaRequired);
    // svelte-ignore state_referenced_locally
    let signingOrder = $state(data.signingOrderEnabled);
    // svelte-ignore state_referenced_locally
    let expirationEnabled = $state(!!data.expirationDate);

    // svelte-ignore state_referenced_locally
    let expirationDate = $state(
        data.expirationDate
            ? new Date(data.expirationDate as string).toISOString().split("T")[0]
            : "",
    );
    const tomorrow = new Date(Date.now()).toISOString().split("T")[0];

    let daysUntilExpiry = $derived(
        expirationDate
            ? Math.max(0, Math.ceil((new Date(expirationDate).getTime() - Date.now()) / 86_400_000))
            : 0,
    );

    let expiryLabel = $derived(
        expirationDate
            ? daysUntilExpiry === 0
                ? "Envelope expires today"
                : daysUntilExpiry === 1
                  ? "Envelope expires in 1 day"
                  : `Envelope expires in ${daysUntilExpiry} days`
            : "",
    );

    function formatFileSize(bytes: number): string {
        if (bytes === 0) return "—";
        const kb = bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        return `${(kb / 1024).toFixed(1)} MB`;
    }

    let signers = $derived(data.recipients.filter((r) => r.role === "signer"));
    let viewers = $derived(data.recipients.filter((r) => r.role === "viewer"));

    interface SignerGroup {
        id: string;
        name: string;
        signerIds: string[];
    }

    // svelte-ignore state_referenced_locally
    let groups = $state<SignerGroup[]>(data.savedGroups);

    $effect(() => {
        if (signingOrder && groups.length === 0 && signers.length > 0) {
            groups = [
                {
                    id: crypto.randomUUID(),
                    name: "Group 1",
                    signerIds: signers.map((s) => s.id),
                },
            ];
        }
        renumberGroups();
    });

    let unassignedSigners = $derived(
        signingOrder ? signers.filter((s) => !groups.some((g) => g.signerIds.includes(s.id))) : [],
    );

    function renumberGroups() {
        groups.forEach((g, i) => (g.name = `Group ${i + 1}`));
    }

    function addGroup() {
        groups.push({
            id: crypto.randomUUID(),
            name: "",
            signerIds: [],
        });
        renumberGroups();
    }

    function removeGroup(id: string) {
        const idx = groups.findIndex((g) => g.id === id);
        if (idx <= 0) return;
        const removed = groups[idx];
        const above = groups[idx - 1];
        if (removed.signerIds.length > 0) {
            above.signerIds.push(...removed.signerIds);
        }
        groups = groups.filter((g) => g.id !== id);
        renumberGroups();
    }

    function moveSigner(signerId: string, groupId: string) {
        for (const g of groups) {
            g.signerIds = g.signerIds.filter((sid) => sid !== signerId);
        }
        const target = groups.find((g) => g.id === groupId);
        if (target) target.signerIds.push(signerId);
    }

    function unassignSigner(signerId: string) {
        for (const g of groups) {
            g.signerIds = g.signerIds.filter((sid) => sid !== signerId);
        }
    }

    // Drag-and-drop state
    let dragSignerId = $state<string | null>(null);
    let dragOverGroup = $state<string | null>(null);

    function onDragStart(signerId: string, e: DragEvent) {
        dragSignerId = signerId;
        e.dataTransfer!.effectAllowed = "move";
    }

    function onDragEnd() {
        dragSignerId = null;
        dragOverGroup = null;
    }

    function onDragOverGroup(groupId: string, e: DragEvent) {
        e.preventDefault();
        dragOverGroup = groupId;
    }

    function onDragLeaveGroup() {
        dragOverGroup = null;
    }

    function onDropInGroup(groupId: string) {
        if (dragSignerId) moveSigner(dragSignerId, groupId);
        dragSignerId = null;
        dragOverGroup = null;
    }

    function onDragOverUnassigned(e: DragEvent) {
        e.preventDefault();
        dragOverGroup = "__unassigned__";
    }

    function onDropUnassigned() {
        if (dragSignerId) unassignSigner(dragSignerId);
        dragSignerId = null;
        dragOverGroup = null;
    }

    // Auto-sync to server
    let saving = $state(false);
    let pendingSync = $state(false);
    let syncTimer: ReturnType<typeof setTimeout>;

    function triggerSync() {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
            if (saving) {
                pendingSync = true;
                return;
            }
            syncToServer();
        }, 600);
    }

    async function syncToServer() {
        saving = true;
        pendingSync = false;
        try {
            const body = new FormData();
            body.append("signingOrderEnabled", String(signingOrder));
            body.append("mfaRequired", String(mfaRequired));
            body.append("expirationDate", expirationDate);
            body.append(
                "groups",
                JSON.stringify(groups.map((g) => ({ id: g.id, signerIds: g.signerIds }))),
            );
            await fetch(`/doc/new/${data.packageId}/confirm?/finalize`, {
                method: "POST",
                body,
            });
        } catch {
            // silently retry on next change
        } finally {
            saving = false;
            if (pendingSync) syncToServer();
        }
    }

    $effect(() => {
        // Auto-sync whenever any workflow state changes
        void signingOrder;
        void mfaRequired;
        void expirationDate;
        void groups;
        triggerSync();
    });
</script>

<div class="flex gap-10 px-4">
    <!-- Left: Documents + Recipients -->
    <div class="flex flex-col flex-2 gap-6">
        <div>
            <h2 class="text-lg font-semibold mb-3">Documents</h2>
            {#if data.documents.length > 0}
                <div class="flex flex-col gap-2">
                    {#each data.documents as doc (doc.id)}
                        <div
                            class="rounded-lg border border-neutral-200 dark:border-neutral-700 px-4 py-3"
                        >
                            <p class="font-medium">{doc.title}</p>
                            <div class="flex gap-4 mt-1 text-xs text-neutral-500">
                                <span>{doc.pageCount} page{doc.pageCount !== 1 ? "s" : ""}</span>
                                <span>{formatFileSize(doc.fileSize)}</span>
                                <span>{doc.fieldCount} field{doc.fieldCount !== 1 ? "s" : ""}</span>
                            </div>
                        </div>
                    {/each}
                </div>
            {:else}
                <p class="text-sm text-neutral-500 italic">No documents in this package.</p>
            {/if}
        </div>

        <div>
            <h2 class="text-lg font-semibold mb-3">Recipients</h2>
            {#if data.recipients.length > 0}
                <div class="flex flex-col gap-4">
                    {#if signers.length > 0}
                        <div>
                            <h3
                                class="text-xs text-neutral-400 uppercase tracking-wider font-medium mb-2"
                            >
                                Signers ({signers.length})
                            </h3>
                            {#if signingOrder}
                                <div class="flex flex-col gap-3">
                                    {#each groups as group, idx (group.id)}
                                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                                        <div
                                            class="rounded-lg border px-3 py-2 transition-colors"
                                            class:border-blue-300={dragOverGroup === group.id}
                                            class:bg-blue-50={dragOverGroup === group.id}
                                            class:border-blue-200={dragOverGroup !== group.id}
                                            class:dark:border-blue-800={dragOverGroup !== group.id}
                                            ondragover={(e: DragEvent) =>
                                                onDragOverGroup(group.id, e)}
                                            ondragleave={onDragLeaveGroup}
                                            ondrop={() => onDropInGroup(group.id)}
                                        >
                                            <div class="flex items-center justify-between mb-2">
                                                <span
                                                    class="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider"
                                                >
                                                    {group.name}
                                                </span>
                                                {#if idx > 0}
                                                    <button
                                                        type="button"
                                                        class="text-xs text-red-500 hover:text-red-700"
                                                        onclick={() => removeGroup(group.id)}
                                                    >
                                                        Remove
                                                    </button>
                                                {/if}
                                            </div>
                                            {#if group.signerIds.length > 0}
                                                <div class="flex flex-col gap-2">
                                                    {#each group.signerIds as sid (sid)}
                                                        {@const s = signers.find(
                                                            (s) => s.id === sid,
                                                        )}
                                                        {#if s}
                                                            <div
                                                                class="flex items-center justify-between rounded-lg border px-4 py-3 bg-white dark:bg-neutral-900 cursor-grab active:cursor-grabbing transition-shadow"
                                                                class:border-emerald-200={s.isMe}
                                                                class:dark:border-emerald-800={s.isMe}
                                                                class:border-neutral-200={!s.isMe}
                                                                class:dark:border-neutral-700={!s.isMe}
                                                                class:shadow-md={dragSignerId ===
                                                                    s.id}
                                                                class:opacity-50={dragSignerId ===
                                                                    s.id}
                                                                draggable="true"
                                                                ondragstart={(e: DragEvent) =>
                                                                    onDragStart(s.id, e)}
                                                                ondragend={onDragEnd}
                                                            >
                                                                <div>
                                                                    <p class="font-medium">
                                                                        {s.name}
                                                                        {#if s.isMe}
                                                                            <span
                                                                                class="ml-2 rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200"
                                                                            >
                                                                                You
                                                                            </span>
                                                                        {/if}
                                                                    </p>
                                                                    <p
                                                                        class="text-xs text-neutral-500"
                                                                    >
                                                                        {s.email}
                                                                    </p>
                                                                </div>
                                                                <div
                                                                    class="flex items-center gap-2"
                                                                >
                                                                    <!-- <span
                                                                        class="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                                                    >
                                                                        Signer
                                                                    </span> -->
                                                                    <select
                                                                        class="text-xs rounded border border-neutral-300 px-1 py-0.5 dark:border-neutral-600 dark:bg-neutral-800"
                                                                        value={group.id}
                                                                        onchange={(e) =>
                                                                            moveSigner(
                                                                                sid,
                                                                                e.currentTarget
                                                                                    .value,
                                                                            )}
                                                                    >
                                                                        {#each groups as g (g.id)}
                                                                            <option value={g.id}
                                                                                >{g.name}</option
                                                                            >
                                                                        {/each}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        {/if}
                                                    {/each}
                                                </div>
                                            {:else}
                                                <p class="text-xs text-neutral-400 italic py-2">
                                                    Drop signers here
                                                </p>
                                            {/if}
                                        </div>
                                    {/each}

                                    {#if unassignedSigners.length > 0}
                                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                                        <div
                                            class="rounded-lg border border-dashed px-3 py-2 transition-colors"
                                            class:border-blue-400={dragOverGroup ===
                                                "__unassigned__"}
                                            class:bg-blue-50={dragOverGroup === "__unassigned__"}
                                            class:border-neutral-300={dragOverGroup !==
                                                "__unassigned__"}
                                            class:dark:border-neutral-600={dragOverGroup !==
                                                "__unassigned__"}
                                            ondragover={onDragOverUnassigned}
                                            ondrop={onDropUnassigned}
                                        >
                                            <span
                                                class="text-xs font-medium text-neutral-500 mb-2 block"
                                                >Unassigned</span
                                            >
                                            <div class="flex flex-col gap-2">
                                                {#each unassignedSigners as s (s.id)}
                                                    <div
                                                        class="flex items-center justify-between rounded-lg border px-4 py-3 bg-white dark:bg-neutral-900 cursor-grab active:cursor-grabbing"
                                                        class:border-emerald-200={s.isMe}
                                                        class:dark:border-emerald-800={s.isMe}
                                                        class:border-neutral-200={!s.isMe}
                                                        class:dark:border-neutral-700={!s.isMe}
                                                        class:shadow-md={dragSignerId === s.id}
                                                        class:opacity-50={dragSignerId === s.id}
                                                        draggable="true"
                                                        ondragstart={(e) => onDragStart(s.id, e)}
                                                        ondragend={onDragEnd}
                                                    >
                                                        <div>
                                                            <p class="font-medium">
                                                                {s.name}
                                                                {#if s.isMe}
                                                                    <span
                                                                        class="ml-2 rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200"
                                                                    >
                                                                        You
                                                                    </span>
                                                                {/if}
                                                            </p>
                                                            <p class="text-xs text-neutral-500">
                                                                {s.email}
                                                            </p>
                                                        </div>
                                                        <select
                                                            class="text-xs rounded border border-neutral-300 px-1 py-0.5 dark:border-neutral-600 dark:bg-neutral-800"
                                                            onchange={(e) =>
                                                                moveSigner(
                                                                    s.id,
                                                                    e.currentTarget.value,
                                                                )}
                                                        >
                                                            <option value="">Move to&hellip;</option
                                                            >
                                                            {#each groups as g (g.id)}
                                                                <option value={g.id}
                                                                    >{g.name}</option
                                                                >
                                                            {/each}
                                                        </select>
                                                    </div>
                                                {/each}
                                            </div>
                                        </div>
                                    {/if}

                                    <button
                                        type="button"
                                        class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 self-start"
                                        onclick={addGroup}
                                    >
                                        + Add Group
                                    </button>
                                </div>
                            {:else}
                                <div class="flex flex-col gap-2">
                                    {#each signers as r (r.id)}
                                        <div
                                            class="flex items-center justify-between rounded-lg border px-4 py-3"
                                            class:border-emerald-200={r.isMe}
                                            class:dark:border-emerald-800={r.isMe}
                                            class:bg-emerald-50={r.isMe}
                                            class:dark:bg-emerald-950={r.isMe}
                                            class:border-neutral-200={!r.isMe}
                                            class:dark:border-neutral-700={!r.isMe}
                                        >
                                            <div>
                                                <p class="font-medium">
                                                    {r.name}
                                                    {#if r.isMe}
                                                        <span
                                                            class="ml-2 rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200"
                                                        >
                                                            You
                                                        </span>
                                                    {/if}
                                                </p>
                                                <p class="text-xs text-neutral-500">{r.email}</p>
                                            </div>
                                            <!-- <span
                                                class="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                            >
                                                Signer
                                            </span> -->
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/if}
                    {#if viewers.length > 0}
                        <div>
                            <h3
                                class="text-xs text-neutral-400 uppercase tracking-wider font-medium mb-2"
                            >
                                Viewers ({viewers.length})
                            </h3>
                            <div class="flex flex-col gap-2">
                                {#each viewers as r (r.id)}
                                    <div
                                        class="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-700 px-4 py-3"
                                    >
                                        <div>
                                            <p class="font-medium">{r.name}</p>
                                            <p class="text-xs text-neutral-500">{r.email}</p>
                                        </div>
                                        <!-- <span
                                            class="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                                        >
                                            Viewer
                                        </span> -->
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
            {:else}
                <p class="text-sm text-neutral-500 italic">No recipients added.</p>
            {/if}
        </div>
    </div>

    <!-- Right: Workflow Settings -->
    <form method="POST" action="?/finalize" class="flex-1 flex flex-col gap-4">
        <h2 class="text-lg font-semibold">Workflow Settings</h2>
        <div class="flex justify-between items-center">
            <label for="signingOrder" class="flex flex-col gap-1">
                <span>Set Signing Order</span>
                <p class="text-sm text-neutral-500">Route documents sequentially</p>
            </label>
            <input
                type="checkbox"
                id="signingOrder"
                name="signingOrder"
                bind:checked={signingOrder}
            />
        </div>
        <div class="flex justify-between items-center">
            <label for="mfaRequired" class="flex flex-col gap-1">
                <span>Require MFA</span>
                <p class="text-sm text-neutral-500">Require signatories to verify their identity</p>
            </label>
            <input type="checkbox" id="mfaRequired" name="mfaRequired" bind:checked={mfaRequired} />
        </div>

        <div class="flex flex-col gap-1">
            <div class="flex justify-between items-center">
                <label for="expiration" class="flex flex-col gap-1">
                    <span>Set Expiration Date</span>
                    <p class="text-sm text-neutral-500">
                        Designate a deadline for the envelope to be completed
                    </p>
                </label>
                <input
                    type="checkbox"
                    id="expiration"
                    name="expiration"
                    bind:checked={expirationEnabled}
                />
            </div>
            {#if expirationEnabled}
                <input
                    transition:slide
                    type="date"
                    id="expiration"
                    min={tomorrow}
                    bind:value={expirationDate}
                    class="rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                />
                {#if expiryLabel}
                    <p class="text-xs text-neutral-500">{expiryLabel}</p>
                {/if}
            {/if}
        </div>

        <input type="hidden" name="signingOrderEnabled" value={signingOrder} />
        <input type="hidden" name="mfaRequired" value={mfaRequired} />
        <input type="hidden" name="expirationDate" value={expirationDate} />
        <input type="hidden" name="groups" value={JSON.stringify(groups.map((g) => ({ id: g.id, signerIds: g.signerIds })))} />

        <button
            type="submit"
            class="mt-4 w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
        >
            Send
        </button>
    </form>
</div>