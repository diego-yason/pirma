<script lang="ts">
    import { resolve } from "$app/paths";

    let { children } = $props();
</script>

<nav class="flex justify-between px-8 py-3">
    <div class="flex gap-4 items-center">
        <h1 class="font-bold text-xl">Prima</h1>
        <a class="font-semibold tracking-wide" href={resolve("/features")}>Features</a>
        <a class="font-semibold tracking-wide" href={resolve("/blockchain")}>Blockchain</a>
        <a class="font-semibold tracking-wide" href={resolve("/security")}>Security</a>
        <a class="font-semibold tracking-wide" href={resolve("/pricing")}>Pricing</a>
    </div>
    <div class="flex gap-4 items-center">
        <a class="font-semibold tracking-wide" href={resolve("/login")}>Log In</a>
        <a class="font-semibold tracking-wide" href={resolve("/register")}>Get Started</a>
    </div>
</nav>

{@render children()}
