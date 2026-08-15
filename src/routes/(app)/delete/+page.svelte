<script lang="ts">
    import { resolve } from "$app/paths";
    import { goto } from "$app/navigation";
    import { authClient } from "#lib/client/auth/auth-client.js";

    let deleting = $state(false);
    let error = $state<string | null>(null);

    async function handleDeleteAccount() {
        deleting = true;
        error = null;

        try {
            await authClient.deleteUser();
            await goto(resolve("register"));
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to delete account";
            deleting = false;
        }
    }
</script>

<svelte:head>
    <title>Delete Account — Pirma</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
    <div class="w-full max-w-md space-y-6">
        <div class="text-center">
            <h1 class="text-3xl font-bold tracking-tight text-gray-900">Delete Account</h1>
            <p class="mt-2 text-sm text-gray-600">
                This will permanently remove your account and all associated data.
            </p>
        </div>

        <div class="rounded-lg border border-red-200 bg-red-50 p-4">
            <div class="flex items-center gap-2">
                <svg
                    class="h-5 w-5 shrink-0 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.5"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                    ></path>
                </svg>
                <p class="text-sm font-medium text-red-800">
                    This action is irreversible. All your documents, signatures, and keys will be
                    lost.
                </p>
            </div>
        </div>

        {#if error}
            <div class="rounded-lg border border-red-200 bg-red-50 p-4">
                <p class="text-sm font-medium text-red-800">{error}</p>
            </div>
        {/if}

        <div class="flex justify-center gap-4">
            <a
                href={resolve("/")}
                class="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
                Cancel
            </a>
            <button
                onclick={handleDeleteAccount}
                disabled={deleting}
                class="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
                {#if deleting}
                    <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                        ></circle>

                        <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
                        ></path>
                    </svg>
                    Deleting...
                {:else}
                    Delete My Account
                {/if}
            </button>
        </div>
    </div>
</div>
