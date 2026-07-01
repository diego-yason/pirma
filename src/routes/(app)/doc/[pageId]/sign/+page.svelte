<script lang="ts">
    import type { PageProps } from "./$types";
    import type { PlacedRect } from "$lib/client/types/SignatureBoxTypes";
    import PDFViewer from "$lib/client/PDFViewer.svelte";
    import SignatureCreator from "$lib/client/SignatureCreator.svelte";
    import { registerPublicKey } from "$lib/client/archive/crypto";
    import { authClient } from "$lib/client/auth/auth-client";
    import { page } from "$app/state";

    let { data }: PageProps = $props();

    // Extract guest token from URL (if present)
    let guestToken = $derived(data.isGuest ? (page.url.searchParams.get("token") ?? "") : "");

    // Ensure a signing key is available in memory and registered on the server
    $effect(() => {
        if (data.isGuest && data.needsAnonymousSignIn) {
            setupGuestSession();
        } else if (!data.isGuest) {
            registerPublicKey();
        }
    });

    async function setupGuestSession() {
        try {
            // 1. Create an anonymous Better Auth session
            const anonResult = await authClient.signIn.anonymous();
            const anonUser = anonResult?.data?.user;
            if (!anonUser?.id) {
                console.error("Anonymous sign-in did not return a user", anonResult);
                return;
            }

            // 2. Link the anonymous user to this package recipient
            const token = page.url.searchParams.get("token");
            if (!token) {
                console.error("No guest token found in URL");
                return;
            }

            const linkRes = await fetch("/api/guest/link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });

            if (!linkRes.ok) {
                const errBody = await linkRes.json().catch(() => ({}));
                console.error(
                    "Failed to link anonymous user to recipient",
                    linkRes.status,
                    errBody,
                );
                return; // Don't reload — let the user retry
            }

            // 3. Reload — the server will now see the anonymous session
            //    and match it to the linked recipient, entering the
            //    authenticated flow (including key registration).
            window.location.reload();
        } catch (err) {
            console.error("Failed to set up guest session", err);
        }
    }

    // Currently selected document
    // svelte-ignore state_referenced_locally
    let selectedDocId = $state(data.documents[0]?.id ?? "");
    let selectedDoc = $derived(data.documents.find((d) => d.id === selectedDocId));

    // Build placement fields for the selected document (only user's fields)
    let placementFields = $derived<PlacedRect[]>(
        data.userFields.filter((f) => f.documentId === selectedDocId).map((f) => f.rect),
    );

    // Local signed state (starts from DB status, then mutates locally)
    // svelte-ignore state_referenced_locally
    let localSignStatus = $state<Record<string, string>>(
        Object.fromEntries(data.userFields.map((f) => [f.fieldId, f.status])),
    );

    // Signed status for the PDF viewer (boolean map)
    let signedStatus = $derived<Record<string, boolean>>(
        Object.fromEntries(
            data.userFields
                .filter((f) => f.documentId === selectedDocId)
                .map((f) => [
                    f.fieldId,
                    localSignStatus[f.fieldId] === "signed" ||
                        localSignStatus[f.fieldId] === "anchored",
                ]),
        ),
    );

    function handleSign(fieldId: string) {
        // If the user hasn't created a signature yet, prompt them
        if (!localSignatureUrl && !data.defaultSignature) {
            showSignatureSetup = true;
            return;
        }
        localSignStatus = { ...localSignStatus, [fieldId]: "signed" };
    }

    function handleRemove(fieldId: string) {
        localSignStatus = { ...localSignStatus, [fieldId]: "pending" };
    }

    let finalizing = $state(false);
    let rejecting = $state(false);

    // Rejection modal state
    let showRejectModal = $state(false);
    let rejectReason = $state("");
    let rejectConfirmed = $state(false);

    function openRejectModal() {
        rejectReason = "";
        rejectConfirmed = false;
        showRejectModal = true;
    }

    function closeRejectModal() {
        showRejectModal = false;
    }

    async function handleFinalize() {
        finalizing = true;
        try {
            const body = new FormData();
            body.append(
                "signedFields",
                JSON.stringify(
                    Object.entries(localSignStatus)
                        .filter(([, status]) => status === "signed" || status === "anchored")
                        .map(([fieldId]) => fieldId),
                ),
            );
            // Include guest token so the server can authenticate the request
            if (guestToken) {
                body.append("guestToken", guestToken);
            }
            await fetch(`/doc/${data.pkg.id}/sign?/finalize`, { method: "POST", body });
            // TODO: navigate to view page or show success message
        } finally {
            finalizing = false;
        }
    }

    async function handleReject() {
        if (!rejectConfirmed) return;
        rejecting = true;
        try {
            const body = new FormData();
            body.append("reason", rejectReason.trim());
            // Include guest token so the server can authenticate the request
            if (guestToken) {
                body.append("guestToken", guestToken);
            }
            await fetch(`/doc/${data.pkg.id}/sign?/reject`, { method: "POST", body });
            closeRejectModal();
            // TODO: navigate to view page or show rejection confirmation
        } finally {
            rejecting = false;
        }
    }

    // All fields across all documents for the action center
    let pendingCount = $derived(
        Object.values(localSignStatus).filter((s) => s === "pending").length,
    );
    let signedCount = $derived(
        Object.values(localSignStatus).filter((s) => s === "signed" || s === "anchored").length,
    );

    // Per-field status lookup for the action center
    function fieldStatus(fieldId: string): string {
        return localSignStatus[fieldId] ?? "pending";
    }

    function statusBadge(status: string): { label: string; class: string } {
        switch (status) {
            case "signed":
            case "anchored":
                return {
                    label: "Signed",
                    class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                };
            case "rejected":
                return {
                    label: "Rejected",
                    class: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
                };
            default:
                return {
                    label: "Pending",
                    class: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                };
        }
    }

    // ── Signature setup modal state ─────────────────────────────
    let showSignatureSetup = $state(false);
    let sigError = $state<string | null>(null);
    let localSignatureUrl = $state<string | null>(null);

    // Open the modal when the user has no saved signature
    $effect(() => {
        if (!data.isGuest && !data.needsAnonymousSignIn && !data.defaultSignature && !localSignatureUrl) {
            const timer = setTimeout(() => {
                showSignatureSetup = true;
            }, 500);
            return () => clearTimeout(timer);
        }
    });

    function onSigSave(blob: Blob) {
        if (localSignatureUrl) URL.revokeObjectURL(localSignatureUrl);
        localSignatureUrl = URL.createObjectURL(blob);
        showSignatureSetup = false;
    }

    function onSigError(msg: string) {
        sigError = msg;
    }

    function onSigSkip() {
        showSignatureSetup = false;
    }
</script>

{#if showSignatureSetup}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onclick={() => (showSignatureSetup = false)}
        onkeydown={(e) => e.key === "Escape" && (showSignatureSetup = false)}
        role="dialog"
        tabindex="-1"
    >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            class="bg-white dark:bg-neutral-900 rounded-lg shadow-xl w-full max-w-lg mx-4 p-6"
            onclick={(e) => e.stopPropagation()}
        >
            <h2 class="text-lg font-semibold mb-1">Set Up Your Signature</h2>
            <p class="text-sm text-neutral-500 mb-4">
                Create a signature to use when signing documents.
            </p>

            <SignatureCreator
                onsave={onSigSave}
                onsaveerror={onSigError}
                onskip={onSigSkip}
            />

            {#if sigError}
                <p class="mt-2 text-sm text-red-600">{sigError}</p>
            {/if}
        </div>
    </div>
{/if}

<div class="flex h-full overflow-hidden">
    <!-- Left: Document List -->
    <div class="w-56 shrink-0 border-r border-neutral-200 dark:border-neutral-800 flex flex-col">
        <div class="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
            <h2 class="text-sm font-semibold text-neutral-500 uppercase tracking-wider">
                Documents
            </h2>
        </div>
        <div class="flex-1 overflow-y-auto">
            {#each data.documents as doc (doc.id)}
                <button
                    class="w-full text-left px-4 py-3 text-sm transition hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    class:bg-neutral-100={doc.id === selectedDocId}
                    class:dark:bg-neutral-900={doc.id === selectedDocId}
                    class:font-semibold={doc.id === selectedDocId}
                    onclick={() => (selectedDocId = doc.id)}
                >
                    <p class="truncate">{doc.title}</p>
                    <p class="text-xs text-neutral-500">
                        {doc.pageCount} page{doc.pageCount !== 1 ? "s" : ""}
                    </p>
                </button>
            {/each}
        </div>
    </div>

    <!-- Center: PDF Viewer -->
    <div class="flex-1 min-w-0 min-h-0 overflow-y-auto">
        {#if selectedDoc?.url}
            <PDFViewer
                pdfUrl={selectedDoc.url}
                elements={placementFields}
                {signedStatus}
                mode="sign"
                onsign={handleSign}
                onremove={handleRemove}
                signatureUrl={localSignatureUrl ?? data.defaultSignature ?? undefined}
            />
        {:else}
            <div class="flex items-center justify-center h-full text-neutral-500">
                <p>No document available for preview.</p>
            </div>
        {/if}
    </div>

    <!-- Right: Action / Todo Center -->
    <div class="w-72 shrink-0 border-l border-neutral-200 dark:border-neutral-800 flex flex-col">
        <div class="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
            <h2 class="text-sm font-semibold text-neutral-500 uppercase tracking-wider">
                Signature Fields
            </h2>
        </div>

        <!-- Summary -->
        <div class="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
            <div class="flex justify-between text-sm">
                <span class="text-neutral-500">Pending</span>
                <span class="font-medium text-amber-600">{pendingCount}</span>
            </div>
            <div class="flex justify-between text-sm mt-1">
                <span class="text-neutral-500">Completed</span>
                <span class="font-medium text-emerald-600">{signedCount}</span>
            </div>
        </div>

        <!-- Field list -->
        <div class="flex-1 overflow-y-auto">
            {#if data.userFields.length > 0}
                <div class="flex flex-col">
                    {#each data.userFields as field (field.fieldId + field.documentId)}
                        {@const st = fieldStatus(field.fieldId)}
                        {@const badge = statusBadge(st)}
                        <button
                            class="flex items-center justify-between px-4 py-3 text-left text-sm border-b border-neutral-100 dark:border-neutral-900 transition hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                            class:opacity-60={st === "signed" || st === "anchored"}
                            onclick={() => (selectedDocId = field.documentId)}
                        >
                            <div class="min-w-0 flex-1 mr-2">
                                <p class="truncate font-medium">
                                    {field.label || "Signature"}
                                </p>
                                <p class="text-xs text-neutral-500 truncate">
                                    {field.documentTitle} · Page {field.page}
                                </p>
                            </div>
                            <span
                                class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {badge.class}"
                            >
                                {badge.label}
                            </span>
                        </button>
                    {/each}
                </div>
            {:else}
                <p class="px-4 py-6 text-sm text-neutral-500 text-center">
                    No signature fields assigned to you.
                </p>
            {/if}
        </div>

        <!-- Actions -->
        <div class="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
            {#if !data.canSign}
                <p class="text-xs text-neutral-500 text-center">
                    Waiting for previous signers to complete.
                </p>
            {/if}
            <button
                class="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!data.canSign || pendingCount > 0 || finalizing}
                onclick={handleFinalize}
            >
                {finalizing ? "Finalizing..." : "Finalize Document"}
            </button>
            <button
                class="w-full rounded-md border border-red-300 dark:border-red-800 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!data.canSign || rejecting}
                onclick={openRejectModal}
            >
                Reject Document
            </button>
        </div>
    </div>
</div>

{#if showRejectModal}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onclick={closeRejectModal}
        onkeydown={(e) => e.key === "Escape" && closeRejectModal()}
        role="dialog"
        tabindex="-1"
    >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            class="bg-white dark:bg-neutral-900 rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
            onclick={(e) => e.stopPropagation()}
        >
            <h2 class="text-lg font-semibold mb-1">Reject Document</h2>
            <p class="text-sm text-neutral-500 mb-4">
                Are you sure you want to reject this document? This cannot be undone.
            </p>

            <label for="rejectReason" class="block text-sm font-medium mb-1">
                Reason <span class="text-neutral-400 font-normal">(optional)</span>
            </label>
            <textarea
                id="rejectReason"
                class="w-full rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800 px-3 py-2 text-sm resize-none"
                rows={3}
                placeholder="Please provide a reason for rejection..."
                bind:value={rejectReason}></textarea>

            <label class="flex items-center gap-2 mt-4 cursor-pointer">
                <input
                    type="checkbox"
                    class="rounded border-neutral-300 dark:border-neutral-600"
                    bind:checked={rejectConfirmed}
                />
                <span class="text-sm text-neutral-700 dark:text-neutral-300">
                    I confirm that I want to reject this document
                </span>
            </label>

            <div class="flex gap-3 mt-6">
                <button
                    type="button"
                    class="flex-1 rounded-md border border-neutral-300 dark:border-neutral-600 px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onclick={closeRejectModal}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="flex-1 rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!rejectConfirmed || rejecting}
                    onclick={handleReject}
                >
                    {rejecting ? "Rejecting..." : "Reject"}
                </button>
            </div>
        </div>
    </div>
{/if}
