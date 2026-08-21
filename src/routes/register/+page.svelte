<script lang="ts">
    import { authClient } from "#lib/client/auth/auth-client.js";
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";
    import { setupDeviceKeys } from "#lib/client/crypto/setup-device-keys.js";
    import AuthShell from "#lib/components/AuthShell.svelte";

    let email = $state("");
    let password = $state("");
    let confirmPassword = $state("");
    let showPassword = $state(false);
    let loading = $state(false);
    let error = $state<string | null>(null);

    async function handleRegister(e: SubmitEvent) {
        e.preventDefault();
        loading = true;
        error = null;

        console.log("[register] Starting registration flow", { email: email.trim() });

        if (!email.trim()) {
            console.warn("[register] Missing email");
            error = "Email is required";
            loading = false;
            return;
        }

        if (!password.trim()) {
            console.warn("[register] Missing password");
            error = "Password is required";
            loading = false;
            return;
        }

        if (password !== confirmPassword) {
            console.warn("[register] Passwords do not match");
            error = "Passwords do not match";
            loading = false;
            return;
        }

        if (password.length < 8) {
            console.warn("[register] Password too short");
            error = "Password must be at least 8 characters";
            loading = false;
            return;
        }

        try {
            console.log("[register] Signing up user", { email: email.trim() });
            const { error: signUpError } = await authClient.signUp.opaque({
                email: email.trim(),
                password,
                name: email.split("@")[0],
            });

            if (signUpError) {
                console.error("[register] Sign up failed", signUpError);
                error = signUpError.message || "Failed to register";
                loading = false;
                return;
            }
            console.log("[register] Sign up successful");

            console.log("[register] Signing in", { email: email.trim() });
            const { data, error: signInError } = await authClient.signIn.opaque({
                email: email.trim(),
                password,
            });

            if (signInError) {
                console.error("[register] Sign in after registration failed", signInError);
                error = signInError.message || "Failed to sign in";
                loading = false;
                return;
            }

            console.log("[register] Sign in successful", { userId: data?.user?.id });
            if (data?.user?.id) {
                try {
                    const accepted = await setupDeviceKeys(data.user.id, password);
                    if (accepted === 0) {
                        throw new Error("Both keys rejected by server — cannot proceed");
                    }
                } catch (keyErr) {
                    console.error("[register] Key setup failed:", keyErr);
                    error = "Failed to set up signing keys. Please try again.";
                    loading = false;
                    return;
                }

                console.log("[register] Registration complete, redirecting to login");
                await goto(resolve("login"));
            }
        } catch (err) {
            console.error("[register] Unexpected error:", err);
            error = err instanceof Error ? err.message : "An unexpected error occurred";
            loading = false;
        }
    }
</script>

<AuthShell>
    <div class="flex flex-col gap-6">
        <div>
            <h1 class="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                Create your account
            </h1>
            <p class="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                Sign up with your email and password to get started.
            </p>
        </div>

        <form class="flex flex-col gap-5" onsubmit={handleRegister}>
            <div class="flex flex-col gap-1.5">
                <label
                    for="email"
                    class="text-sm font-medium text-neutral-700 dark:text-neutral-300"
                >
                    Email address
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    autocomplete="email"
                    bind:value={email}
                    class="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 shadow-sm transition outline-none placeholder:text-neutral-400 focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                    placeholder="you@example.com"
                    required
                />
            </div>

            <div class="flex flex-col gap-1.5">
                <label
                    for="password"
                    class="text-sm font-medium text-neutral-700 dark:text-neutral-300"
                >
                    Password
                </label>
                <div class="relative">
                    <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autocomplete="new-password"
                        bind:value={password}
                        class="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 pr-11 text-sm text-neutral-900 shadow-sm transition outline-none placeholder:text-neutral-400 focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                        placeholder="At least 8 characters"
                        required
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
                <p class="text-xs text-neutral-400 dark:text-neutral-500">
                    Use at least 8 characters.
                </p>
            </div>

            <div class="flex flex-col gap-1.5">
                <label
                    for="confirmPassword"
                    class="text-sm font-medium text-neutral-700 dark:text-neutral-300"
                >
                    Confirm password
                </label>
                <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autocomplete="new-password"
                    bind:value={confirmPassword}
                    class="rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 shadow-sm transition outline-none placeholder:text-neutral-400 focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                    placeholder="Confirm your password"
                    required
                />
            </div>

            {#if error}
                <div
                    class="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                >
                    {error}
                </div>
            {/if}

            <button
                type="submit"
                disabled={loading}
                class="mt-1 w-full rounded-lg bg-linear-to-r from-secondary-600 to-primary-700 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-secondary-500 hover:to-primary-600 focus:ring-2 focus:ring-secondary-500/40 focus:ring-offset-2 focus:outline-none disabled:opacity-50 dark:focus:ring-offset-neutral-900"
            >
                {#if loading}
                    <span class="flex items-center justify-center gap-2">
                        <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle
                                class="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                stroke-width="4"
                            ></circle>
                            <path
                                class="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                        </svg>
                        Creating account…
                    </span>
                {:else}
                    Create account
                {/if}
            </button>
        </form>

        <div class="flex items-center gap-3 text-xs text-neutral-400">
            <span class="h-px flex-1 bg-neutral-200 dark:bg-neutral-700"></span>
            or continue with
            <span class="h-px flex-1 bg-neutral-200 dark:bg-neutral-700"></span>
        </div>

        <div class="grid grid-cols-4 gap-2">
            {#each ["G", "Y", "A", "F"] as provider (provider)}
                <button
                    type="button"
                    disabled={loading}
                    title={`Sign up with ${provider}`}
                    aria-label={`Sign up with ${provider}`}
                    class="grid h-10 place-items-center rounded-lg border border-neutral-300 bg-white text-sm font-bold text-neutral-600 shadow-sm transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                >
                    {provider}
                </button>
            {/each}
        </div>
        <p class="text-center text-[11px] text-neutral-400 dark:text-neutral-500">
            Social sign-up is coming soon.
        </p>
    </div>
</AuthShell>
