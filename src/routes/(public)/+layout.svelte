<script lang="ts">
    import { resolve } from "$app/paths";
    import { page } from "$app/state";

    let { data, children } = $props();

    let menuOpen = $state(false);

    const navLinks = [
        { title: "Features", href: "features" },
        { title: "Blockchain", href: "blockchain" },
        { title: "Security", href: "security" },
        { title: "Pricing", href: "pricing" },
    ];

    function isActive(href: string): boolean {
        return page.url.pathname.startsWith(resolve(href));
    }
</script>

{#snippet brand()}
    <a href={resolve("/")} class="inline-flex items-center gap-2.5">
        <span
            class="grid h-9 w-9 place-items-center rounded-lg bg-linear-to-br from-secondary-500 to-primary-700 text-base font-black text-white shadow-md shadow-primary-900/20"
            aria-hidden="true"
        >
            P
        </span>
        <span class="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            Pirma
        </span>
    </a>
{/snippet}

{#snippet navLink(title, href)}
    {@const active = isActive(href)}
    <a
        href={resolve(href)}
        class="rounded-md px-3 py-2 text-sm font-medium transition
            {active
            ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50'
            : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-50'}"
        aria-current={active ? "page" : undefined}
    >
        {title}
    </a>
{/snippet}

<header
    class="sticky top-0 z-40 border-b border-neutral-200 bg-neutral-50/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/80"
>
    <nav class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-2">
            {@render brand()}

            <div class="ml-6 hidden items-center gap-1 md:flex">
                {#each navLinks as link (link.href)}
                    {@render navLink(link.title, link.href)}
                {/each}
            </div>
        </div>

        <div class="hidden items-center gap-3 md:flex">
            {#if data.user}
                <a
                    href={resolve("dashboard")}
                    class="rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-50"
                >
                    Dashboard
                </a>
                <a
                    href={resolve("logout")}
                    class="rounded-md border border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                    Log out
                </a>
            {:else}
                <a
                    href={resolve("login")}
                    class="rounded-md px-3.5 py-2 text-sm font-medium text-neutral-700 transition hover:text-neutral-900 dark:text-neutral-200 dark:hover:text-neutral-50"
                >
                    Log in
                </a>
                <a
                    href={resolve("register")}
                    class="rounded-lg bg-linear-to-r from-secondary-600 to-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-secondary-500 hover:to-primary-600"
                >
                    Get Started
                </a>
            {/if}
        </div>

        <!-- Mobile menu toggle -->
        <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onclick={() => (menuOpen = !menuOpen)}
            class="grid h-10 w-10 place-items-center rounded-lg text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800 md:hidden"
        >
            {#if menuOpen}
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    class="h-6 w-6"
                >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"
                    ></path>
                </svg>
            {:else}
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    class="h-6 w-6"
                >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"
                    ></path>
                </svg>
            {/if}
        </button>
    </nav>

    <!-- Mobile menu -->
    {#if menuOpen}
        <div
            class="border-t border-neutral-200 bg-neutral-50 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-950 md:hidden"
        >
            <div class="flex flex-col gap-1">
                {#each navLinks as link (link.href)}
                    {@const active = isActive(link.href)}
                    <a
                        href={resolve(link.href)}
                        onclick={() => (menuOpen = false)}
                        class="rounded-md px-3 py-2.5 text-sm font-medium transition
                            {active
                            ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50'
                            : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-50'}"
                    >
                        {link.title}
                    </a>
                {/each}
            </div>

            <div
                class="mt-3 flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800"
            >
                {#if data.user}
                    <a
                        href={resolve("dashboard")}
                        onclick={() => (menuOpen = false)}
                        class="rounded-md px-3 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    >
                        Dashboard
                    </a>
                    <a
                        href={resolve("logout")}
                        onclick={() => (menuOpen = false)}
                        class="rounded-md border border-neutral-300 bg-white px-3.5 py-2.5 text-center text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    >
                        Log out
                    </a>
                {:else}
                    <a
                        href={resolve("login")}
                        onclick={() => (menuOpen = false)}
                        class="rounded-md px-3 py-2.5 text-center text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    >
                        Log in
                    </a>
                    <a
                        href={resolve("register")}
                        onclick={() => (menuOpen = false)}
                        class="rounded-lg bg-linear-to-r from-secondary-600 to-primary-700 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:from-secondary-500 hover:to-primary-600"
                    >
                        Get Started
                    </a>
                {/if}
            </div>
        </div>
    {/if}
</header>

{@render children()}
