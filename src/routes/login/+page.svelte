<script lang="ts">
    import { enhance } from "$app/forms";
    import { resolve } from "$app/paths";
    import type { SubmitFunction } from "@sveltejs/kit";

    let { form } = $props();

    let submitting = $state(false);

    const handleEnhance: SubmitFunction = () => {
        submitting = true;
        return async ({ result, update }) => {
            submitting = false;
            // Don't reset the form on error so the user keeps their input
            await update({ reset: result.type !== "error" });
        };
    };
</script>

<div class="flex flex-col p-10">
    <h1 class="text-lg text-center">Sign in to your account</h1>
    <div class="flex flex-row gap-10 p-10">
        <form method="POST" use:enhance={handleEnhance} class="flex-1 flex flex-col gap-6">
            <div class="flex flex-col gap-1">
                <label for="email" class="font-bold tracking-wider"> Email address </label>
                <input
                    type="email"
                    id="email"
                    name="email"
                    value={form?.email ?? ""}
                    placeholder="name@example.com"
                    class="rounded-md"
                    required
                    class:border-red-500={form?.emailError}
                    aria-invalid={form?.emailError ? "true" : undefined}
                    aria-describedby={form?.emailError ? "email-error" : undefined}
                />
                {#if form?.emailError}
                    <span id="email-error" class="text-red-500 text-sm">{form.emailError}</span>
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
                    name="password"
                    placeholder="Password"
                    class="rounded-md"
                    required
                    class:border-red-500={form?.passwordError}
                    aria-invalid={form?.passwordError ? "true" : undefined}
                    aria-describedby={form?.passwordError ? "password-error" : undefined}
                />
                {#if form?.passwordError}
                    <span id="password-error" class="text-red-500 text-sm"
                        >{form.passwordError}</span
                    >
                {/if}
            </div>
            {#if form?.formError}
                <div
                    class="text-red-500 text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md p-3"
                >
                    {form.formError}
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
