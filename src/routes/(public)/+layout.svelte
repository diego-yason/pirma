<script lang="ts">
    // @ts-nocheck i don't wanna bother with the snippet bs

    import { resolve } from "$app/paths";

    let { data, children } = $props();
</script>

{#snippet link(title, href)}
    <a class="font-medium text-sm tracking-wide" {href}>{title}</a>
{/snippet}

<nav class="flex justify-between px-8 py-3 border-b mb-4">
    <div class="flex gap-4 items-center">
        <a class="font-bold text-xl" href={resolve("/")}>Prima</a>
        {@render link("Features", resolve("features"))}
        {@render link("Blockchain", resolve("blockchain"))}
        {@render link("Security", resolve("security"))}
        {@render link("Pricing", resolve("pricing"))}
    </div>
    <div class="flex gap-4 items-center">
        {#if data.user}
            {@render link("Dashboard", resolve("dashboard"))}
            {@render link("Log Out", resolve("logout"))}
        {:else}
            {@render link("Log In", resolve("login"))}
            {@render link("Get Started", resolve("register"))}
        {/if}
    </div>
</nav>

{@render children()}
