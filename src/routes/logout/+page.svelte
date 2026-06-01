<script lang="ts">
    import { resolve } from "$app/paths";
    import { goto } from "$app/navigation";
    import { authClient } from "$lib/auth-client";
    import { onMount } from "svelte";

    onMount(async () => {
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
