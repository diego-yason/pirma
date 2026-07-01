<script lang="ts">
    // @ts-nocheck snippets mm
    import { page } from "$app/stores";
    import { resolve } from "$app/paths";
    import { hasDeviceKeys, setupDeviceKeys } from "$lib/client/setup-device-keys";
    import { authClient } from "$lib/auth-client";
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

    let showKeySetup = $state(false);
    let keyPassword = $state("");
    let keyError = $state<string | null>(null);
    let keyLoading = $state(false);
    let keyCheckDone = $state(false);

    // Check whether device-bound signing keys exist and are still valid on the server.
    // Runs at most once — a one-shot flag prevents the reactivity loop when showKeySetup toggles.
    $effect(() => {
        if (data.user.id && !keyCheckDone) {
            keyCheckDone = true;
            if (!data.hasKey) {
                // Server reports no active (non-revoked) keys — prompt setup
                console.warn("[layout] No active keys on server for user", {
                    userId: data.user.id,
                });
                showKeySetup = true;
            } else {
                // Server has keys — verify the device still has them locally
                hasDeviceKeys(data.user.id).then((exists) => {
                    if (!exists) {
                        console.warn("[layout] Keys exist on server but not on this device", {
                            userId: data.user.id,
                        });
                        showKeySetup = true;
                    }
                });
            }
        }
    });

    async function handleKeySetup() {
        if (!keyPassword.trim()) {
            keyError = "Password is required";
            return;
        }
        keyLoading = true;
        keyError = null;

        try {
            // Verify password by attempting sign-in (local API call, reuses existing session)
            const { error: signInError } = await authClient.signIn.opaque({
                email: data.user.email,
                password: keyPassword,
            });
            if (signInError) {
                keyError = "Incorrect password";
                keyPassword = "";
                keyLoading = false;
                return;
            }

            // Password correct — generate device-bound keys
            // Force regeneration if server reported no active keys (e.g. revoked)
            const accepted = await setupDeviceKeys(data.user.id, keyPassword, !data.hasKey);
            keyPassword = ""; // clear immediately after SW call
            if (accepted === 0) {
                keyError = "Key setup failed. Please try again.";
                keyLoading = false;
                return;
            }

            showKeySetup = false;
        } catch (err) {
            console.error("[layout] Key setup error:", err);
            keyPassword = "";
            keyError = "Something went wrong. Please try again.";
        } finally {
            keyLoading = false;
        }
    }
</script>

<div class="flex h-screen overflow-hidden">
    <div class="border-r grow flex flex-col border-neutral-800 pr-2 pl-5 overflow-y-auto min-h-0">
        <div class="mt-10">
            <p class="font-bold text-xl">
                {data.user.name}
                {#if data.isAnonymous}<span>(Guest)</span>{/if}
            </p>
            <p class="text-neutral-300">{data.user.email}</p>
            {#if data.isAnonymous}
                <p class="text-neutral-400 text-xs flex items-center gap-1.5 mt-0.5">
                    <span class="inline-block size-1.5 rounded-full bg-amber-500"></span>
                    Guest
                </p>
            {/if}
        </div>
        <nav class="flex flex-col grow justify-between py-3">
            <div class="flex-1/6 flex flex-col gap-3">
                {#if !data.isAnonymous}
                    {#each navConfig as item (item.label)}
                        {@render navGroup(item)}
                    {/each}
                {/if}
            </div>
            {#if data.isAnonymous}
                <div class="flex flex-col gap-2 border-t border-neutral-800 pt-3">
                    <a
                        class="flex items-center gap-2 rounded-md bg-amber-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700"
                        href={resolve("/register")}
                    >
                        <svg
                            class="size-4 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
                            />
                        </svg>
                        Convert to Full Account
                    </a>
                </div>
            {:else}
                <a class="font-medium text-sm tracking-wide" href={resolve("/logout")}>Logout</a>
            {/if}
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

{#if showKeySetup}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onkeydown={(e) => e.key === "Escape" && !keyLoading && (showKeySetup = false)}
        role="dialog"
        tabindex="-1"
    >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            class="bg-white dark:bg-neutral-900 rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
            onclick={(e) => e.stopPropagation()}
        >
            <h2 class="text-lg font-semibold mb-1">Set Up Device Keys</h2>
            <p class="text-sm text-neutral-500 mb-4">
                This device needs signing keys. Enter your password to generate them.
            </p>

            <label for="layout-key-pw" class="block text-sm font-medium mb-1">Password</label>
            <input
                id="layout-key-pw"
                type="password"
                bind:value={keyPassword}
                class="w-full rounded-md border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800 px-3 py-2.5 text-sm"
                placeholder="Enter your password"
                onkeydown={(e) => e.key === "Enter" && handleKeySetup()}
            />

            {#if keyError}
                <p class="mt-2 text-sm text-red-600">{keyError}</p>
            {/if}

            <div class="flex gap-3 mt-4">
                <div class="flex-1"></div>
                <button
                    type="button"
                    class="rounded-md border border-neutral-300 dark:border-neutral-600 px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    onclick={() => (showKeySetup = false)}
                >
                    Skip
                </button>
                <button
                    type="button"
                    class="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={keyLoading || !keyPassword.trim()}
                    onclick={handleKeySetup}
                >
                    {keyLoading ? "Setting up..." : "Set Up Keys"}
                </button>
            </div>
        </div>
    </div>
{/if}
