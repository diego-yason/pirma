<script lang="ts">
    import { resolve } from "$app/paths";
    import { goto } from "$app/navigation";
    import { authClient } from "#lib/client/auth/auth-client.js";
    import type { EventHandler } from "svelte/elements";
    import { setupDeviceKeys } from "#lib/client/crypto/setup-device-keys.js";
    import AuthShell from "#lib/components/AuthShell.svelte";

    let submitting = $state(false);
    let email = $state("");
    let password = $state("");
    let showPassword = $state(false);

    let emailError = $state<string | null>(null);
    let passwordError = $state<string | null>(null);
    let formError = $state<string | null>(null);

    const login: EventHandler = (e) => {
        submitting = true;
        e.preventDefault();

        email = email.trim();
        password = password.trim();

        console.log("[login] Login attempt", { email });

        if (!email) {
            console.warn("[login] Missing email");
            emailError = "Email is required";
            submitting = false;
            return;
        }

        if (!password) {
            console.warn("[login] Missing password");
            passwordError = "Password is required";
            submitting = false;
            return;
        }

        authClient.signIn
            .opaque({ email, password }) // @ts-expect-error not really important
            .then(async ({ data, error }) => {
                if (error) {
                    console.error("[login] Login failed", error);
                    emailError = null;
                    passwordError = null;
                    formError = error.message || "Failed to sign in";
                    submitting = false;
                    return;
                }

                const userId = data?.user?.id;
                console.log("[login] Login successful", { userId });

                // Proactively handle key setup while password is in memory
                if (userId) {
                    try {
                        // Check if existing keys need rotation
                        const rotRes = await fetch("/api/keys/rotation-check");
                        const rot = await rotRes.json();
                        const force = rot.needsRotation === true;
                        if (force) {
                            console.log("[login] Key rotation needed:", rot.reason);
                        }

                        const accepted = await setupDeviceKeys(userId, password, force);
                        if (accepted === 0) {
                            console.error(
                                "[login] Both keys rejected — cannot sign documents on this device",
                            );
                        }
                    } catch (keyErr) {
                        console.error("[login] Key setup failed (non-fatal):", keyErr);
                    }
                }

                await goto(resolve("/"));
            });
    };
</script>

<AuthShell>
    <div class="flex flex-col gap-6">
        <div>
            <h1 class="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                Welcome back
            </h1>
            <p class="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                Sign in to your account to continue.
            </p>
        </div>

        <form method="POST" onsubmit={login} class="flex flex-col gap-5">
            <div class="flex flex-col gap-1.5">
                <label
                    for="email"
                    class="text-sm font-medium text-neutral-700 dark:text-neutral-300"
                >
                    Email address
                </label>
                <input
                    type="email"
                    id="email"
                    name="email"
                    autocomplete="email"
                    bind:value={email}
                    placeholder="name@example.com"
                    class="rounded-lg border bg-white px-3.5 py-2.5 text-sm text-neutral-900 shadow-sm transition outline-none placeholder:text-neutral-400 focus:ring-2 dark:bg-neutral-800 dark:text-neutral-100 {emailError
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-neutral-300 focus:border-secondary-500 focus:ring-secondary-500/20 dark:border-neutral-700'}"
                    aria-invalid={emailError ? "true" : undefined}
                    aria-describedby={emailError ? "email-error" : undefined}
                />
                {#if emailError}
                    <span id="email-error" class="text-sm text-red-600 dark:text-red-400">
                        {emailError}
                    </span>
                {/if}
            </div>

            <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                    <label
                        for="password"
                        class="text-sm font-medium text-neutral-700 dark:text-neutral-300"
                    >
                        Password
                    </label>
                    <button
                        type="button"
                        onclick={() => goto(resolve("forgot-password"))}
                        class="text-sm font-medium text-secondary-600 hover:text-secondary-500 dark:text-secondary-400"
                    >
                        Forgot password?
                    </button>
                </div>
                <div class="relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        name="password"
                        autocomplete="current-password"
                        bind:value={password}
                        placeholder="••••••••"
                        class="w-full rounded-lg border bg-white px-3.5 py-2.5 pr-11 text-sm text-neutral-900 shadow-sm transition outline-none placeholder:text-neutral-400 focus:ring-2 dark:bg-neutral-800 dark:text-neutral-100 {passwordError
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                            : 'border-neutral-300 focus:border-secondary-500 focus:ring-secondary-500/20 dark:border-neutral-700'}"
                        aria-invalid={passwordError ? "true" : undefined}
                        aria-describedby={passwordError ? "password-error" : undefined}
                    />
                    <button
                        type="button"
                        onclick={() => (showPassword = !showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        class="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    >
                        {#if showPassword}
                            <!-- eye-off -->
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                                class="h-5 w-5"
                            >
                                <path
                                    d="M3 3l18 18M10.5 10.7a2.6 2.6 0 0 0 3.6 3.6M6.2 6.9C4.1 8.2 2.6 10.1 1.9 11.4c.7 1.3 2.2 3.2 4.3 4.5A10.9 10.9 0 0 0 12 18c2 0 3.8-.6 5.3-1.5M9.9 5.2A10.4 10.4 0 0 1 12 5c3.6 0 6.7 2 8.3 4.4-.6 1.1-1.6 2.4-3 3.5M14.7 8.1A4.6 4.6 0 0 1 18.5 11"
                                />
                            </svg>
                        {:else}
                            <!-- eye -->
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                                class="h-5 w-5"
                            >
                                <path
                                    d="M2.2 11.6C4.4 7.7 8 5.8 12 5.8s7.6 1.9 9.8 5.8c-2.2 3.9-5.8 5.8-9.8 5.8s-7.6-1.9-9.8-5.8Z"
                                />
                                <circle cx="12" cy="11.6" r="2.6" />
                            </svg>
                        {/if}
                    </button>
                </div>
                {#if passwordError}
                    <span id="password-error" class="text-sm text-red-600 dark:text-red-400">
                        {passwordError}
                    </span>
                {/if}
            </div>

            {#if formError}
                <div
                    class="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                >
                    {formError}
                </div>
            {/if}

            <button
                type="submit"
                disabled={submitting}
                class="mt-1 w-full rounded-lg bg-linear-to-r from-secondary-600 to-primary-700 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-secondary-500 hover:to-primary-600 focus:ring-2 focus:ring-secondary-500/40 focus:ring-offset-2 focus:outline-none disabled:opacity-50 dark:focus:ring-offset-neutral-900"
            >
                {submitting ? "Signing in…" : "Sign in"}
            </button>
        </form>

        <div class="flex items-center gap-3 text-xs text-neutral-400">
            <span class="h-px flex-1 bg-neutral-200 dark:bg-neutral-700"></span>
            or continue with
            <span class="h-px flex-1 bg-neutral-200 dark:bg-neutral-700"></span>
        </div>

        <div class="flex flex-col gap-3">
            <button
                type="button"
                disabled={submitting}
                class="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
                <!-- passkey icon -->
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    class="h-5 w-5"
                >
                    <circle cx="8" cy="14" r="4" />
                    <path
                        d="M16.5 14a2.5 2.5 0 1 0-1.4-2.3L11 15.5M15.5 12.5l2-2M17.5 10.5l1.5-1.5"
                    />
                </svg>
                Sign in with Passkey
            </button>

            <div class="grid grid-cols-4 gap-2">
                {#each ["G", "Y", "A", "F"] as provider (provider)}
                    <button
                        type="button"
                        disabled={submitting}
                        title={`Sign in with ${provider}`}
                        aria-label={`Sign in with ${provider}`}
                        class="grid h-10 place-items-center rounded-lg border border-neutral-300 bg-white text-sm font-bold text-neutral-600 shadow-sm transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                    >
                        {provider}
                    </button>
                {/each}
            </div>
            <p class="text-center text-[11px] text-neutral-400 dark:text-neutral-500">
                Social sign-in is coming soon.
            </p>
        </div>
    </div>
</AuthShell>
