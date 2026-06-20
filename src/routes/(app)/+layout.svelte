<script lang="ts">
    // @ts-nocheck snippets mm
    import { resolve } from "$app/paths";

    let { children } = $props();
</script>

{#snippet link(name, href)}
    <a class="font-medium text-sm rounded-md tracking-wide bg-secondary-500 px-3 py-2.5" {href}
        >{name}</a
    >
{/snippet}

<div class="flex h-screen overflow-hidden">
    <div class="border-r grow flex flex-col border-neutral-800 pr-2 pl-5 overflow-y-auto min-h-0">
        <div class="mt-10">
            <p class="font-bold text-xl">Juan Dela Rosa</p>
            <p class="text-neutral-300 te">juan@delarosa.com</p>
        </div>
        <nav class="flex flex-col grow justify-between py-3">
            <div class="flex-1/6 flex flex-col gap-3">
                {@render link("Dashboard", resolve("/dashboard"))}
                {@render link("Documents", resolve("/doc/new"))}
                {@render link("Templates", resolve("/"))}
                {@render link("Contacts", resolve("/"))}
                {@render link("Settings", resolve("/"))}
            </div>
            <a class="font-medium text-sm tracking-wide" href={resolve("/logout")}>Logout</a>
        </nav>
        <div class="flex flex-col gap-2 pb-5">
            <p>Security</p>
            <p>Support</p>
        </div>
    </div>
    <div class="flex-5/6 overflow-y-auto min-h-0 pl-2">
        {@render children()}
    </div>
</div>
