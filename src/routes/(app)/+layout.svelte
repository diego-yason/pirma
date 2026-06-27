<script lang="ts">
    // @ts-nocheck snippets mm
    import { page } from "$app/stores";
    import { resolve } from "$app/paths";
    import type { LayoutProps } from "./$types";

    type NavItem = {
        label: string;
        href: string;
        children?: NavItem[];
    };

    const navConfig: NavItem[] = [
        { label: "Dashboard", href: "/dashboard" },
        {
            label: "Documents",
            href: "/doc/new",
            children: [
                { label: "New Document", href: "/doc/new" },
                { label: "All Documents", href: "/doc/list" },
            ],
        },
        { label: "Templates", href: "/" },
        { label: "Contacts", href: "/" },
        { label: "Settings", href: "/settings" },
    ];

    function isActive(item: NavItem): boolean {
        const pathname = $page.url.pathname;
        return pathname === item.href || pathname.startsWith(item.href + "/");
    }

    let { children, data }: LayoutProps = $props();
</script>

<div class="flex h-screen overflow-hidden">
    <div class="border-r grow flex flex-col border-neutral-800 pr-2 pl-5 overflow-y-auto min-h-0">
        <div class="mt-10">
            <p class="font-bold text-xl">{data.user.name}</p>
            <p class="text-neutral-300">{data.user.email}</p>
        </div>
        <nav class="flex flex-col grow justify-between py-3">
            <div class="flex-1/6 flex flex-col gap-3">
                {#each navConfig as item (item.label)}
                    {@render navGroup(item)}
                {/each}
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

{#snippet navGroup(item: NavItem)}
    {@const active = isActive(item)}
    <div class="flex flex-col">
        <a
            class="font-medium text-sm rounded-md tracking-wide px-3 py-2.5
                {active
                ? 'bg-secondary-500 text-white'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800'}"
            href={resolve(item.href)}
        >
            {item.label}
        </a>
        {#if item.children && active}
            <div class="ml-3 mt-1 flex flex-col gap-1 border-l border-neutral-700 pl-3">
                {#each item.children as child (child.label)}
                    {@const childActive = isActive(child)}
                    <a
                        class="text-sm rounded-md tracking-wide px-3 py-2
                            {childActive
                            ? 'bg-secondary-500/20 text-secondary-300'
                            : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}"
                        href={resolve(child.href)}
                    >
                        {child.label}
                    </a>
                {/each}
            </div>
        {/if}
    </div>
{/snippet}
