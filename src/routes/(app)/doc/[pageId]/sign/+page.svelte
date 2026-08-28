<script lang="ts">
    import type { PageProps } from "./$types";
    import type { PlacedRect } from "#lib/client/types/SignatureBoxTypes.d.ts";
    import PDFViewer from "#lib/client/ui/PDFViewer.svelte";
    import SignatureCreator from "#lib/client/ui/SignatureCreator.svelte";
    // import { registerPublicKey } from "#lib/client/archive/crypto.js"; // archived — superseded by SW key system
    import { authClient } from "#lib/client/auth/auth-client.js";
    import { setupDeviceKeys } from "#lib/client/crypto/setup-device-keys.js";
    import { sign, loadKeys, getKeyForLevel } from "#lib/client/crypto/sw-key.js";
    import {
        buildSigningPayload,
        canonicalFieldValues,
        sha256Hex,
    } from "#lib/shared/signing-payload.js";
    import { page } from "$app/state";
    import { SvelteMap } from "svelte/reactivity";

    let { data }: PageProps = $props();

    // Extract guest token from URL (if present)
    let guestToken = $derived(data.isGuest ? (page.url.searchParams.get("token") ?? "") : "");

    // ── Guest email OTP sign-in ──────────────────────────────────
    // First-time guests must prove ownership of the recipient's inbox
    // (email OTP) before their anonymous session is linked and they can sign.
    let otpStep = $state<"preparing" | "idle" | "sent" | "done">("preparing");
    let otpEmail = $state(data.guestEmail ?? "");
    let otpCode = $state("");
    let otpSending = $state(false);
    let otpVerifying = $state(false);
    let otpError = $state<string | null>(null);
    let otpMessage = $state<string | null>(null);
    let anonUserId = $state<string | null>(null);

    // Once OTP completes (or this isn't a first-time guest), show the sign UI.
    let otpGatePassed = $derived(!data.needsAnonymousSignIn || otpStep === "done");

    $effect(() => {
        if (data.isGuest && data.needsAnonymousSignIn && otpStep === "preparing") {
            ensureGuestSession();
        }
    });

    // 1. Create the anonymous Better Auth session the OTP verify step links to.
    async function ensureGuestSession() {
        try {
            console.log("[sign] Starting guest session for OTP flow");
            const anonResult = await authClient.signIn.anonymous();
            const anonUser = anonResult?.data?.user;
            if (!anonUser?.id) {
                console.error("Anonymous sign-in did not return a user", anonResult);
                otpError = "Could not start a guest session. Please try again.";
                otpStep = "idle";
                return;
            }
            anonUserId = anonUser.id;
            otpStep = "idle";
        } catch (err) {
            console.error("Failed to start guest session", err);
            otpError = "Could not start a guest session. Please try again.";
            otpStep = "idle";
        }
    }

    // 2. Send a one-time code to the recipient's email.
    async function sendOtpCode() {
        if (!guestToken) return;
        otpSending = true;
        otpError = null;
        otpMessage = null;
        try {
            const res = await fetch("/api/guest/otp/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: guestToken, email: otpEmail.trim() }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                otpError = (body as { error?: string })?.error ?? "Failed to send code.";
                return;
            }
            otpStep = "sent";
            otpMessage = "We sent a 6-digit code to your inbox. It expires in 10 minutes.";
        } catch (err) {
            console.error("Failed to send OTP", err);
            otpError = "Failed to send code. Please try again.";
        } finally {
            otpSending = false;
        }
    }

    // 3. Verify the code, link the anonymous user, and enter the signing flow.
    async function verifyOtpCode() {
        if (!guestToken) return;
        otpVerifying = true;
        otpError = null;
        try {
            const res = await fetch("/api/guest/otp/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: guestToken, code: otpCode.trim() }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                otpError = (body as { error?: string })?.error ?? "Invalid code. Try again.";
                return;
            }

            // Set up a level-1 session key (no password needed for guests).
            if (anonUserId) {
                const accepted = await setupDeviceKeys(anonUserId, undefined, true);
                if (accepted === 0) {
                    console.error("[sign] Guest key setup failed — cannot sign documents");
                }
            }

            otpStep = "done";
            window.location.reload();
        } catch (err) {
            console.error("Failed to verify OTP", err);
            otpError = "Something went wrong. Please try again.";
        } finally {
            otpVerifying = false;
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

    // All fields (user's + others') for greyed-out display in the PDF viewer
    let ownFieldIds = $derived(new Set(placementFields.map((f) => f.id)));
    let allFieldsForViewer = $derived.by<PlacedRect[]>(() => {
        const docAllFields = (selectedDoc?.allFields ?? []) as PlacedRect[];
        const merged = [...placementFields];
        for (const f of docAllFields) {
            if (!ownFieldIds.has(f.id)) merged.push(f);
        }
        return merged;
    });

    // All signed status (user's + others') for the PDF viewer
    let allSignedStatus = $derived<Record<string, boolean>>({
        ...(selectedDoc?.allSignedStatus ?? {}),
        ...Object.fromEntries(
            data.userFields
                .filter((f) => f.documentId === selectedDocId)
                .map((f) => [
                    f.fieldId,
                    localSignStatus[f.fieldId] === "signed" ||
                        localSignStatus[f.fieldId] === "anchored",
                ]),
        ),
    });

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

    // ── Field values (text / phone / choices / checkbox / radio) ──
    let fieldValues = $state<Record<string, string | boolean>>({});

    function isValueKind(kind?: string): boolean {
        return (
            kind === "text" ||
            kind === "phone" ||
            kind === "choices" ||
            kind === "checkbox" ||
            kind === "radio"
        );
    }

    interface UserFieldLike {
        fieldId: string;
        documentId: string;
        rect: PlacedRect;
    }

    /** Whether a value field is complete (blocks finalize when not). */
    function valueFieldComplete(field: UserFieldLike): boolean {
        const kind = field.rect.kind;
        if (!isValueKind(kind)) return true;
        const value = fieldValues[field.fieldId];
        if (!field.rect.required) return true; // non-required value fields don't block
        if (kind === "checkbox") return value === true; // required checkbox must be checked
        return typeof value === "string" && value.trim() !== "";
    }

    function handleValueChange(fieldId: string, value: string | boolean) {
        fieldValues[fieldId] = value;
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

    // ── Level-2 (2FA) password prompt ─────────────────────────────
    let showMfaPrompt = $state(false);
    let mfaPassword = $state("");
    let mfaError = $state<string | null>(null);
    let mfaResolver = $state<((password: string | null) => void) | null>(null);

    function promptForMfaPassword(initialError: string | null = null): Promise<string | null> {
        mfaPassword = "";
        mfaError = initialError;
        showMfaPrompt = true;
        return new Promise((resolve) => {
            mfaResolver = resolve;
        });
    }

    function submitMfaPassword() {
        if (!mfaPassword) {
            mfaError = "Password is required";
            return;
        }
        showMfaPrompt = false;
        mfaResolver?.(mfaPassword);
        mfaResolver = null;
    }

    function cancelMfaPrompt() {
        showMfaPrompt = false;
        mfaResolver?.(null);
        mfaResolver = null;
    }

    async function handleFinalize(retried = false) {
        finalizing = true;
        try {
            // 1. Load a signing key of the required tier.
            //    mfaRequired packages require a level-2 (password-bound) key.
            const requiredLevel = data.pkg.mfaRequired ? 2 : 1;
            console.log("[sign] Loading keys for signing", {
                userId: data.user.id,
                requiredLevel,
            });

            let kid: string | null = null;

            if (requiredLevel === 1) {
                let keys = await loadKeys(data.user.id);
                if (keys.loaded === 0) {
                    console.warn("[sign] No session key — generating level-1 key on the fly", {
                        userId: data.user.id,
                    });
                    await setupDeviceKeys(data.user.id);
                    keys = await loadKeys(data.user.id);
                }
                if (keys.loaded === 0) {
                    console.error("[sign] No keys available for signing — cannot finalize", {
                        userId: data.user.id,
                    });
                    finalizing = false;
                    return;
                }
                console.log("[sign] Keys loaded", { loaded: keys.loaded, skipped: keys.skipped });
                kid = keys.kids[0] ?? null;
            } else {
                // Level-2: unlock the password-bound persistent key.
                let attempt = 0;
                while (!kid) {
                    const password = await promptForMfaPassword(
                        attempt > 0
                            ? "Incorrect password, or no 2FA key on this device yet. Try again."
                            : null,
                    );
                    if (!password) {
                        console.warn("[sign] Level-2 unlock cancelled");
                        finalizing = false;
                        return;
                    }
                    await loadKeys(data.user.id, password);
                    kid = await getKeyForLevel(data.user.id, 2);
                    if (!kid) {
                        // No level-2 key exists yet — generate + upload one with this password.
                        await setupDeviceKeys(data.user.id, password);
                        kid = await getKeyForLevel(data.user.id, 2);
                    }
                    attempt++;
                }
                console.log("[sign] Level-2 key ready", { kid });
            }

            if (!kid) {
                console.error("[sign] No kid available for signing", { requiredLevel });
                finalizing = false;
                return;
            }

            // 2. Get the signed field IDs (signature fields only — value fields
            //    are submitted separately and bound into the payload via a hash).
            const fieldIds = Object.entries(localSignStatus)
                .filter(([, status]) => status === "signed" || status === "anchored")
                .map(([fieldId]) => fieldId)
                .filter((fieldId) => {
                    const f = data.userFields.find((uf) => uf.fieldId === fieldId);
                    return f ? !isValueKind(f.rect.kind) : true;
                });

            if (fieldIds.length === 0) {
                console.warn("[sign] No signature fields are signed — nothing to finalize", {
                    userId: data.user.id,
                });
                finalizing = false;
                return;
            }
            console.log("[sign] Signing fields", {
                count: fieldIds.length,
                kid,
                fieldIds,
            });

            // 2b. Submitted field values (value fields only)
            const fieldValuesPayload: Record<string, { kind: string; value: string | boolean }> =
                {};
            for (const field of data.userFields) {
                const kind = field.rect.kind;
                if (!isValueKind(kind)) continue;
                const value = fieldValues[field.fieldId];
                if (value === undefined || (typeof value === "string" && value.trim() === "")) {
                    continue;
                }
                fieldValuesPayload[field.fieldId] = { kind, value };
            }

            // 3. Sign ONCE per document (not per field)
            //    Group fields by document, then sign one payload per doc
            const signatures: Record<string, string> = {};
            const docGroups = new SvelteMap<string, { docHash: string; fieldIds: string[] }>();

            for (const fieldId of fieldIds) {
                const userField = data.userFields.find((f) => f.fieldId === fieldId);
                const doc = data.documents.find((d) => d.id === userField?.documentId);
                if (!doc || !doc.hash) {
                    console.error("[sign] Cannot sign field — document or hash missing", {
                        fieldId,
                        documentId: userField?.documentId,
                    });
                    continue;
                }
                let group = docGroups.get(doc.id);
                if (!group) {
                    group = { docHash: doc.hash, fieldIds: [] };
                    docGroups.set(doc.id, group);
                }
                group.fieldIds.push(fieldId);
            }

            for (const [docId, group] of docGroups) {
                // Values hash for this document (empty map when no value fields) —
                // must match what the server derives from the submitted values.
                const valuesForHash: Record<string, string | boolean> = {};
                for (const field of data.userFields) {
                    if (field.documentId !== docId) continue;
                    if (!isValueKind(field.rect.kind)) continue;
                    const v = fieldValues[field.fieldId];
                    if (v === undefined || v === "") continue;
                    valuesForHash[field.fieldId] = v;
                }
                const fieldValuesHash = await sha256Hex(canonicalFieldValues(valuesForHash));

                const payload = buildSigningPayload({
                    packageId: data.pkg.id,
                    documentId: docId,
                    documentHash: group.docHash,
                    fieldIds: group.fieldIds,
                    signerUserId: data.user.id,
                    fieldValuesHash,
                });
                const sig = await sign(kid, payload, requiredLevel);
                // All fields in this document share the same signature
                for (const fieldId of group.fieldIds) {
                    signatures[fieldId] = sig;
                }
                console.log("[sign] Signed document", {
                    docHash: group.docHash.slice(0, 12) + "…",
                    fieldCount: group.fieldIds.length,
                    sigPreview: sig.slice(0, 16) + "…",
                });
            }

            // 4. POST to the server
            const body = new FormData();
            body.append("signedFields", JSON.stringify(fieldIds));
            body.append("fieldValues", JSON.stringify(fieldValuesPayload));
            body.append("signatures", JSON.stringify(signatures));
            body.append("kid", kid);
            body.append("keyLevel", String(requiredLevel));

            if (guestToken) {
                body.append("guestToken", guestToken);
            }

            const res = await fetch(`/doc/${data.pkg.id}/sign?/finalize`, {
                method: "POST",
                body,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                const errMsg = (err as { error?: string })?.error ?? "unknown";
                console.error("[sign] Finalize rejected by server", {
                    status: res.status,
                    error: errMsg,
                    signedCount: fieldIds.length,
                });
                // Session key was revoked/rotated server-side. Regenerate the
                // appropriate tier and retry once.
                if (
                    !retried &&
                    (errMsg.includes("revoked") ||
                        errMsg.includes("not found") ||
                        errMsg.includes("no matching active key") ||
                        errMsg.includes("rotation"))
                ) {
                    console.warn("[sign] Regenerating signing key and retrying once");
                    if (requiredLevel === 2) {
                        const password = await promptForMfaPassword(
                            "Your signing key needs to be rotated. Enter your password to create a new key.",
                        );
                        if (!password) {
                            finalizing = false;
                            return;
                        }
                        await setupDeviceKeys(data.user.id, password, true);
                    } else {
                        await setupDeviceKeys(data.user.id, undefined, true);
                    }
                    finalizing = false;
                    return handleFinalize(true);
                }
            } else {
                console.log("[sign] Finalize succeeded — redirecting to view page", {
                    packageId: data.pkg.id,
                    signedCount: fieldIds.length,
                });
                const { goto } = await import("$app/navigation");
                goto(`/doc/${data.pkg.id}/view`);
            }
        } catch (err) {
            console.error("[sign] Finalize threw unexpectedly", err);
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
        data.userFields.filter((f) => {
            if (isValueKind(f.rect.kind)) return !valueFieldComplete(f);
            const st = localSignStatus[f.fieldId] ?? "pending";
            return st !== "signed" && st !== "anchored";
        }).length,
    );
    let signedCount = $derived(data.userFields.length - pendingCount);

    // Per-field status lookup for the action center (value fields complete once
    // filled; signature fields once signed)
    function fieldStatus(field: UserFieldLike): string {
        if (isValueKind(field.rect.kind)) {
            return valueFieldComplete(field) ? "signed" : "pending";
        }
        return localSignStatus[field.fieldId] ?? "pending";
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
        if (
            !data.isGuest &&
            !data.needsAnonymousSignIn &&
            !data.defaultSignature &&
            !localSignatureUrl
        ) {
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

{#if !otpGatePassed}
    <!-- Guest email OTP gate — covers the page until the guest verifies -->
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-neutral-950">
        <div
            class="mx-4 w-full max-w-sm rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
        >
            <h2 class="mb-1 text-lg font-semibold">Verify your email</h2>
            <p class="mb-4 text-sm text-neutral-500">
                To sign this document, confirm you're the right person by entering the code we send
                to your email.
            </p>

            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-1">
                    <label for="otpEmail" class="text-sm font-bold tracking-wider"> Email </label>
                    <input
                        type="email"
                        id="otpEmail"
                        bind:value={otpEmail}
                        class="rounded-md text-primary-900"
                        disabled={otpStep === "sent"}
                    />
                </div>

                {#if otpStep === "idle"}
                    <button
                        class="rounded-md bg-secondary-200 py-3 font-bold tracking-wider text-primary-900 disabled:opacity-50"
                        disabled={otpSending || !otpEmail.trim()}
                        onclick={sendOtpCode}
                    >
                        {otpSending ? "Sending..." : "Send code"}
                    </button>
                {:else if otpStep === "sent"}
                    <div class="flex flex-col gap-1">
                        <label for="otpCode" class="text-sm font-bold tracking-wider"> Code </label>
                        <input
                            type="text"
                            id="otpCode"
                            bind:value={otpCode}
                            inputmode="numeric"
                            autocomplete="one-time-code"
                            maxlength="6"
                            placeholder="6-digit code"
                            class="rounded-md tracking-[0.4em] text-primary-900"
                        />
                    </div>
                    <button
                        class="rounded-md bg-secondary-200 py-3 font-bold tracking-wider text-primary-900 disabled:opacity-50"
                        disabled={otpVerifying || otpCode.trim().length !== 6}
                        onclick={verifyOtpCode}
                    >
                        {otpVerifying ? "Verifying..." : "Verify"}
                    </button>
                    <button
                        type="button"
                        class="text-sm text-neutral-500 underline disabled:opacity-50"
                        disabled={otpSending}
                        onclick={sendOtpCode}
                    >
                        Resend code
                    </button>
                {/if}

                {#if otpMessage}
                    <p class="text-sm text-emerald-600">{otpMessage}</p>
                {/if}
                {#if otpError}
                    <p class="text-sm text-red-600">{otpError}</p>
                {/if}
            </div>
        </div>
    </div>
{/if}

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
            class="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900"
            onclick={(e) => e.stopPropagation()}
        >
            <h2 class="mb-1 text-lg font-semibold">Set Up Your Signature</h2>
            <p class="mb-4 text-sm text-neutral-500">
                Create a signature to use when signing documents.
            </p>

            <SignatureCreator onsave={onSigSave} onsaveerror={onSigError} onskip={onSigSkip} />

            {#if sigError}
                <p class="mt-2 text-sm text-red-600">{sigError}</p>
            {/if}
        </div>
    </div>
{/if}

<div class="flex h-full overflow-hidden">
    <!-- Left: Document List -->
    <div class="flex w-56 shrink-0 flex-col border-r border-neutral-200 dark:border-neutral-800">
        <div class="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <h2 class="text-sm font-semibold tracking-wider text-neutral-500 uppercase">
                Documents
            </h2>
        </div>
        <div class="flex-1 overflow-y-auto">
            {#each data.documents as doc (doc.id)}
                <button
                    class="w-full px-4 py-3 text-left text-sm transition hover:bg-neutral-100 dark:hover:bg-neutral-900"
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
    <div class="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {#if selectedDoc?.url}
            <PDFViewer
                pdfUrl={selectedDoc.url}
                elements={allFieldsForViewer}
                signedStatus={allSignedStatus}
                {ownFieldIds}
                mode="sign"
                onsign={handleSign}
                onremove={handleRemove}
                onvalue={handleValueChange}
                {fieldValues}
                signatureUrl={localSignatureUrl ?? data.defaultSignature ?? undefined}
            />
        {:else}
            <div class="flex h-full items-center justify-center text-neutral-500">
                <p>No document available for preview.</p>
            </div>
        {/if}
    </div>

    <!-- Right: Action / Todo Center -->
    <div class="flex w-72 shrink-0 flex-col border-l border-neutral-200 dark:border-neutral-800">
        <div class="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <h2 class="text-sm font-semibold tracking-wider text-neutral-500 uppercase">
                Signature Fields
            </h2>
        </div>

        <!-- Summary -->
        <div class="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <div class="flex justify-between text-sm">
                <span class="text-neutral-500">Pending</span>
                <span class="font-medium text-amber-600">{pendingCount}</span>
            </div>
            <div class="mt-1 flex justify-between text-sm">
                <span class="text-neutral-500">Completed</span>
                <span class="font-medium text-emerald-600">{signedCount}</span>
            </div>
        </div>

        <!-- Field list -->
        <div class="flex-1 overflow-y-auto">
            {#if data.userFields.length > 0}
                <div class="flex flex-col">
                    {#each data.userFields as field (field.fieldId + field.documentId)}
                        {@const st = fieldStatus(field)}
                        {@const badge = statusBadge(st)}
                        <button
                            class="flex items-center justify-between border-b border-neutral-100 px-4 py-3 text-left text-sm transition hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900/50"
                            class:opacity-60={st === "signed" || st === "anchored"}
                            onclick={() => (selectedDocId = field.documentId)}
                        >
                            <div class="mr-2 min-w-0 flex-1">
                                <p class="truncate font-medium">
                                    {field.label || "Signature"}
                                </p>
                                <p class="truncate text-xs text-neutral-500">
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
                <p class="px-4 py-6 text-center text-sm text-neutral-500">
                    No signature fields assigned to you.
                </p>
            {/if}
        </div>

        <!-- Actions -->
        <div class="space-y-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
            {#if !data.canSign}
                <p class="text-center text-xs text-neutral-500">
                    Waiting for previous signers to complete.
                </p>
            {/if}
            <button
                class="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!data.canSign || pendingCount > 0 || finalizing}
                onclick={() => handleFinalize()}
            >
                {finalizing ? "Finalizing..." : "Finalize Document"}
            </button>
            <button
                class="w-full rounded-md border border-red-300 px-4 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                disabled={!data.canSign || rejecting}
                onclick={openRejectModal}
            >
                Reject Document
            </button>
        </div>
    </div>
</div>

{#if showMfaPrompt}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onclick={cancelMfaPrompt}
        onkeydown={(e) => e.key === "Escape" && cancelMfaPrompt()}
        role="dialog"
        tabindex="-1"
    >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            class="mx-4 w-full max-w-sm rounded-lg bg-white p-6 dark:bg-neutral-900"
            onclick={(e) => e.stopPropagation()}
        >
            <h2 class="mb-1 text-lg font-semibold">Confirm your password</h2>
            <p class="mb-4 text-sm text-neutral-500">
                This document requires two-factor authentication. Enter your password to unlock your
                signing key.
            </p>
            <form
                onsubmit={(e) => {
                    e.preventDefault();
                    submitMfaPassword();
                }}
                class="flex flex-col gap-4"
            >
                <div class="flex flex-col gap-1">
                    <label for="mfaPassword" class="text-sm font-bold tracking-wider">
                        Password
                    </label>
                    <input
                        type="password"
                        id="mfaPassword"
                        bind:value={mfaPassword}
                        class="rounded-md text-primary-900"
                        required
                    />
                </div>
                {#if mfaError}
                    <p class="text-sm text-red-600">{mfaError}</p>
                {/if}
                <div class="flex justify-end gap-2">
                    <button
                        type="button"
                        class="rounded-md border border-neutral-300 px-4 py-2 text-sm"
                        onclick={cancelMfaPrompt}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                    >
                        Unlock
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

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
            class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900"
            onclick={(e) => e.stopPropagation()}
        >
            <h2 class="mb-1 text-lg font-semibold">Reject Document</h2>
            <p class="mb-4 text-sm text-neutral-500">
                Are you sure you want to reject this document? This cannot be undone.
            </p>

            <label for="rejectReason" class="mb-1 block text-sm font-medium">
                Reason <span class="font-normal text-neutral-400">(optional)</span>
            </label>
            <textarea
                id="rejectReason"
                class="w-full resize-none rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
                rows={3}
                placeholder="Please provide a reason for rejection..."
                bind:value={rejectReason}></textarea>

            <label class="mt-4 flex cursor-pointer items-center gap-2">
                <input
                    type="checkbox"
                    class="rounded border-neutral-300 dark:border-neutral-600"
                    bind:checked={rejectConfirmed}
                />
                <span class="text-sm text-neutral-700 dark:text-neutral-300">
                    I confirm that I want to reject this document
                </span>
            </label>

            <div class="mt-6 flex gap-3">
                <button
                    type="button"
                    class="flex-1 rounded-md border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    onclick={closeRejectModal}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="flex-1 rounded-md bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!rejectConfirmed || rejecting}
                    onclick={handleReject}
                >
                    {rejecting ? "Rejecting..." : "Reject"}
                </button>
            </div>
        </div>
    </div>
{/if}
