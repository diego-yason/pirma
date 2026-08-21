<script lang="ts">
    // @ts-nocheck snippets mm
    import { page } from "$app/state";
    import { resolve } from "$app/paths";
    import { setupDeviceKeys } from "#lib/client/crypto/setup-device-keys.js";
    import { authClient } from "#lib/client/auth/auth-client.js";
    import type { LayoutProps } from "./$types";

    type NavItem = {
        label: string;
        href: string;
        icon?: string;
        children?: NavItem[];
    };

    const navConfig: NavItem[] = [
        {
            label: "Dashboard",
            href: "/dashboard",
            icon: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5",
        },
        {
            label: "Documents",
            href: "/doc/new",
            icon: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z",
            children: [
                { label: "New Document", href: "/doc/new" },
                { label: "All Documents", href: "/doc/list" },
            ],
        },
        {
            label: "Templates",
            href: "/",
            icon: "M14 3v5h5M9 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9l-5-5H9Z",
        },
        {
            label: "Contacts",
            href: "/",
            icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
        },
        {
            label: "Settings",
            href: "/settings",
            icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.4 7.4 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
        },
    ];

    const displayName = $derived(data.user.name || "Guest");
    const displayInitial = $derived((displayName[0] ?? "?").toUpperCase());

    function isActive(item: NavItem): boolean {
        const pathname = page.url.pathname;
        return pathname === item.href || pathname.startsWith(item.href + "/");
    }

    let { children, data }: LayoutProps = $props();

    let showKeySetup = $state(false);
    let keySetupForce = $state(false);
    let keySetupReason = $state("");
    let keyPassword = $state("");
    let keyError = $state<string | null>(null);
    let keyLoading = $state(false);
    let keyCheckDone = $state(false);

    // Check whether a persistent (level-2) signing key exists and is valid.
    // Runs at most once — a one-shot flag prevents the reactivity loop when showKeySetup toggles.
    // Level-1 session keys are generated silently on demand and never prompt for a password.
    // For anonymous users, the sign page handles keys on its own — skip here.
    $effect(() => {
        if (data.user.id && !keyCheckDone && !data.isAnonymous) {
            keyCheckDone = true;

            if (data.keyRotation) {
                // Persistent level-2 key exists but needs rotation
                // (age, idle, usage, or algorithm)
                console.warn("[layout] Level-2 key needs rotation", data.keyRotation);
                keySetupForce = true;
                keySetupReason = data.keyRotation.reason;
                showKeySetup = true;
            } else if (!data.hasLevel2) {
                // No persistent level-2 key — offer to create one with a password
                console.warn("[layout] No level-2 key for user", {
                    userId: data.user.id,
                });
                keySetupForce = true;
                keySetupReason = "";
                showKeySetup = true;
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
            const accepted = await setupDeviceKeys(data.user.id, keyPassword, keySetupForce);
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

<div class="flex h-screen overflow-hidden bg-neutral-950 text-neutral-100">
    <aside
        class="flex w-64 shrink-0 flex-col border-r border-neutral-800 bg-neutral-900/40"
    >
        <!-- Brand -->
        <div class="flex h-16 shrink-0 items-center border-b border-neutral-800 px-5">
            <a href={resolve("/")} class="inline-flex items-center gap-2.5">
                <span
                    class="grid h-9 w-9 place-items-center rounded-lg bg-linear-to-br from-secondary-500 to-primary-700 text-base font-black text-white shadow-md shadow-primary-900/20"
                    aria-hidden="true"
                >
                    P
                </span>
                <span class="text-lg font-bold tracking-tight text-neutral-50">Pirma</span>
            </a>
        </div>

        <!-- User card -->
        <div class="mx-4 mt-4 rounded-xl border border-neutral-800 bg-neutral-900 p-3.5">
            <div class="flex items-center gap-3">
                <span
                    class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary-500/15 text-sm font-bold text-secondary-300"
                    aria-hidden="true"
                >
                    {displayInitial}
                </span>
                <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold text-neutral-50">{displayName}</p>
                    <p class="truncate text-xs text-neutral-400">{data.user.email}</p>
                </div>
            </div>
            {#if data.isAnonymous}
                <p class="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
                    <span class="inline-block size-1.5 rounded-full bg-amber-500"></span>
                    Guest account
                </p>
            {/if}
        </div>

        <!-- Nav -->
        <nav class="flex flex-1 flex-col justify-between overflow-y-auto py-4">
            <div class="flex flex-col gap-1 px-3">
                {#if !data.isAnonymous}
                    {#each navConfig as item (item.label)}
                        {@render navGroup(item)}
                    {/each}
                {/if}
            </div>

            <div class="flex flex-col gap-2 border-t border-neutral-800 px-4 pt-3">
                {#if data.isAnonymous}
                    <a
                        class="flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700"
                        href={resolve("register")}
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
                            ></path>
                        </svg>
                        Convert to Full Account
                    </a>
                {:else}
                    <a
                        href={resolve("logout")}
                        class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4 shrink-0">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
                            ></path>
                        </svg>
                        Log out
                    </a>
                {/if}

                <div class="flex flex-col gap-1 pb-2">
                    <a
                        href={resolve("settings")}
                        class="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
                    >
                        Security
                    </a>
                    <a
                        href={resolve("settings")}
                        class="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
                    >
                        Support
                    </a>
                </div>
            </div>
        </nav>
    </aside>
    <div class="flex-1 overflow-y-auto min-h-0">
        {@render children()}
    </div>
</div>

{#snippet navGroup(item: NavItem)}
    {@const active = isActive(item)}
    <div class="flex flex-col">
        <a
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition
                {active
                ? 'bg-linear-to-r from-secondary-600 to-primary-700 text-white shadow-sm'
                : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'}"
            href={resolve(item.href)}
        >
            {#if item.icon}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4 shrink-0">
                    <path stroke-linecap="round" stroke-linejoin="round" d={item.icon}></path>
                </svg>
            {/if}
            {item.label}
        </a>
        {#if item.children && active}
            <div class="ml-4 mt-1 flex flex-col gap-1 border-l border-neutral-700 pl-3">
                {#each item.children as child (child.label)}
                    {@const childActive = isActive(child)}
                    <a
                        class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition
                            {childActive
                            ? 'bg-secondary-500/20 text-secondary-300'
                            : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}"
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
            <h2 class="text-lg font-semibold mb-1">
                {#if keySetupReason}Rotate Signing Keys{:else}Set Up Device Keys{/if}
            </h2>
            <p class="text-sm text-neutral-500 mb-4">
                {#if keySetupReason}
                    {keySetupReason}. Enter your password to generate a fresh key pair.
                {:else}
                    This device needs signing keys. Enter your password to generate them.
                {/if}
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
                    onclick={() => (showKeySetup = false)}>Skip</button
                >

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
