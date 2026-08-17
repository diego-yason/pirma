<script lang="ts">
    import { resolve } from "$app/paths";
    import { authClient } from "#lib/client/auth/auth-client.js";

    let email = $state("");
    let submitting = $state(false);
    let sent = $state(false);
    let error = $state<string | null>(null);

    async function handleSubmit(e: Event) {
        e.preventDefault();
        submitting = true;
        error = null;

        const res = await authClient.requestPasswordReset({
            email: email.trim(),
            redirectTo: "/reset-password",
        });

        submitting = false;
        if (res.error) {
            error = res.error.message ?? "Something went wrong. Please try again.";
            return;
        }

        // Never reveal whether the account exists.
        sent = true;
    }
</script>

<div class="flex flex-col items-center p-10">
    <h1 class="text-lg text-center">Reset your password</h1>

    {#if sent}
        <div class="mt-6 max-w-sm text-center">
            <p class="text-sm text-neutral-600">
                If an account exists for <strong>{email.trim()}</strong>, we've sent a password
                reset link. Check your inbox (and spam folder).
            </p>
            <a href={resolve("login")} class="mt-4 inline-block text-sm underline">Back to sign in</a>
        </div>
    {:else}
        <form onsubmit={handleSubmit} class="mt-6 flex w-full max-w-sm flex-col gap-6">
            <div class="flex flex-col gap-1">
                <label for="email" class="font-bold tracking-wider"> Email address </label>
                <input
                    type="email"
                    id="email"
                    bind:value={email}
                    placeholder="name@example.com"
                    class="rounded-md text-primary-900"
                    required
                    class:border-red-500={error}
                    aria-invalid={error ? "true" : undefined}
                />
            </div>
            {#if error}
                <div
                    class="text-red-500 text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md p-3"
                >
                    {error}
                </div>
            {/if}
            <button
                type="submit"
                disabled={submitting}
                class="tracking-wider bg-secondary-200 py-3 font-bold text-primary-900 rounded-md"
            >
                {submitting ? "Sending..." : "Send reset link"}
            </button>
            <a href={resolve("login")} class="text-center text-sm underline">
                Back to sign in
            </a>
        </form>
    {/if}
</div>
