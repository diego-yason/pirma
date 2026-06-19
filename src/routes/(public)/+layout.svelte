<script lang="ts">
    import { resolve } from "$app/paths";

    let { children } = $props();
</script>

<nav class="flex justify-between px-8 py-3 border-b mb-4">
    <div class="flex gap-4 items-center">
        <a class="font-bold text-xl" href={resolve("/")}>Prima</a>
        <a class="font-medium text-sm tracking-wide" href={resolve("/features")}>Features</a>
        <a class="font-medium text-sm tracking-wide" href={resolve("/blockchain")}>Blockchain</a>
        <a class="font-medium text-sm tracking-wide" href={resolve("/security")}>Security</a>
        <a class="font-medium text-sm tracking-wide" href={resolve("/pricing")}>Pricing</a>
    </div>
    <div class="flex gap-4 items-center">
        <a class="font-medium text-sm tracking-wide" href={resolve("/login")}>Log In</a>
        <a class="font-medium text-sm tracking-wide" href={resolve("/register")}>Get Started</a>
    </div>
</nav>

{@render children()}
