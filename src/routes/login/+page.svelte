<script lang="ts">
    import { resolve } from "$app/paths";
    import { goto } from "$app/navigation";
    import { authClient } from "$lib/client/auth/auth-client.js";
    import type { EventHandler } from "svelte/elements";
    import { setupDeviceKeys } from "$lib/client/crypto/setup-device-keys";

    let submitting = $state(false);
    let email = $state("");
    let password = $state("");

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
            .opaque({
                email,
                password,
            })
            // @ts-expect-error not really important
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

<div class="flex flex-col p-10">
    <h1 class="text-lg text-center">Sign in to your account</h1>
    <div class="flex flex-row gap-10 p-10">
        <form method="POST" onsubmit={login} class="flex-1 flex flex-col gap-6">
            <div class="flex flex-col gap-1">
                <label for="email" class="font-bold tracking-wider"> Email address </label>
                <input
                    type="email"
                    id="email"
                    bind:value={email}
                    placeholder="name@example.com"
                    class="rounded-md text-primary-900"
                    required
                    class:border-red-500={emailError}
                    aria-invalid={emailError ? "true" : undefined}
                    aria-describedby={emailError ? "email-error" : undefined}
                />
                {#if emailError}
                    <span id="email-error" class="text-red-500 text-sm">{emailError}</span>
                {/if}
            </div>
            <div class="flex flex-col gap-1">
                <span class="flex justify-between">
                    <label for="password" class="font-bold tracking-wider"> Password </label>
                    <button
                        type="button"
                        class="font-light dark:text-secondary-200 text-secondary-800 cursor-pointer bg-transparent border-none underline"
                    >
                        Forgot password?
                    </button>
                </span>
                <input
                    type="password"
                    id="password"
                    bind:value={password}
                    placeholder="Password"
                    class="rounded-md text-primary-900"
                    required
                    class:border-red-500={passwordError}
                    aria-invalid={passwordError ? "true" : undefined}
                    aria-describedby={passwordError ? "password-error" : undefined}
                />
                {#if passwordError}
                    <span id="password-error" class="text-red-500 text-sm">{passwordError}</span>
                {/if}
            </div>
            {#if formError}
                <div
                    class="text-red-500 text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md p-3"
                >
                    {formError}
                </div>
            {/if}
            <button
                type="submit"
                disabled={submitting}
                class="tracking-wider bg-secondary-200 py-3 font-bold text-primary-900 rounded-md"
            >
                {submitting ? "Signing in..." : "Sign in"}
            </button>
        </form>
        <div class="flex flex-col gap-2 justify-center">
            <span class="h-[25%] w-px self-center bg-neutral-300/70"></span>
            <span class="tracking-widest">OR</span>
            <span class="h-[25%] w-px self-center bg-neutral-300/70"></span>
        </div>
        <div class="flex-1 flex flex-col justify-center-safe gap-5">
            <button disabled={submitting}> Sign in with Passkey </button>
            <div class="flex gap-2 justify-center-safe">
                <button disabled={submitting}> G </button>
                <button disabled={submitting}> Y </button>
                <button disabled={submitting}> A </button>
                <button disabled={submitting}> F </button>
            </div>
        </div>
    </div>
    <a href={resolve("/register")} class="text-center">
        Don't have an account?
        <span class="dark:text-secondary-200 text-secondary-800"> Sign up </span>
    </a>
</div>
