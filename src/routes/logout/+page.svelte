<script lang="ts">
    import { resolve } from "$app/paths";
    import { goto } from "$app/navigation";
    import { authClient } from "$lib/client/auth/auth-client";
    import { clearKeys } from "$lib/client/crypto/sw-key";
    import { onMount } from "svelte";

    onMount(async () => {
        // Wipe in-memory private keys from the service worker
        try {
            await clearKeys();
            console.log("[logout] SW key store cleared");
        } catch (err) {
            console.warn("[logout] Failed to clear SW keys (non-fatal):", err);
        }

        await authClient.signOut();
        await goto(resolve("/login"));
    });
</script>

<svelte:head>
    <title>Logging out...</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-50">
    <p class="text-sm text-gray-600">Logging out...</p>
</div>
