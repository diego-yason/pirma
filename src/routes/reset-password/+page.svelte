<script lang="ts">
    import { resolve } from "$app/paths";
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { authClient } from "#lib/client/auth/auth-client.js";

    let token = $derived(page.url.searchParams.get("token") ?? "");
    let password = $state("");
    let confirm = $state("");
    let submitting = $state(false);
    let error = $state<string | null>(null);

    async function handleSubmit(e: Event) {
        e.preventDefault();
        error = null;

        if (!token) {
            error = "This reset link is missing its token. Please request a new one.";
            return;
        }
        if (password.length < 8) {
            error = "Password must be at least 8 characters.";
            return;
        }
        if (password !== confirm) {
            error = "Passwords don't match.";
            return;
        }

        submitting = true;
        const res = await authClient.resetPassword({ newPassword: password, token });
        submitting = false;

        if (res.error) {
            error = res.error.message ?? "Reset failed. The link may be invalid or expired.";
            return;
        }

        await goto(resolve("login"));
    }
</script>

<div class="flex flex-col items-center p-10">
    <h1 class="text-lg text-center">Choose a new password</h1>

    {#if !token}
        <p class="mt-6 max-w-sm text-center text-sm text-neutral-600">
            This reset link is invalid or expired.
            <a href={resolve("forgot-password")} class="underline">Request a new one</a>.
        </p>
    {:else}
        <form onsubmit={handleSubmit} class="mt-6 flex w-full max-w-sm flex-col gap-6">
            <div class="flex flex-col gap-1">
                <label for="password" class="font-bold tracking-wider"> New password </label>
                <input
                    type="password"
                    id="password"
                    bind:value={password}
                    placeholder="At least 8 characters"
                    class="rounded-md text-primary-900"
                    required
                    minlength="8"
                />
            </div>
            <div class="flex flex-col gap-1">
                <label for="confirm" class="font-bold tracking-wider"> Confirm password </label>
                <input
                    type="password"
                    id="confirm"
                    bind:value={confirm}
                    placeholder="Repeat your new password"
                    class="rounded-md text-primary-900"
                    required
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
                {submitting ? "Saving..." : "Set new password"}
            </button>
        </form>
    {/if}
</div>
