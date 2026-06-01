<script lang="ts">
    import { authClient } from "$lib/auth-client";
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";

    let email = $state("");
    let password = $state("");
    let loading = $state(false);
    let error = $state<string | null>(null);

    async function handleSignIn(e: SubmitEvent) {
        e.preventDefault();
        loading = true;
        error = null;

        if (!email.trim()) {
            error = "Email is required";
            loading = false;
            return;
        }

        if (!password.trim()) {
            error = "Password is required";
            loading = false;
            return;
        }

        try {
            const { data, error: signInError } = await authClient.signIn.email({
                email: email.trim(),
                password,
            });

            if (signInError) {
                error = signInError.message || "Failed to sign in";
                loading = false;
                return;
            }

            if (data) {
                await goto(resolve("/"));
            }
        } catch (err) {
            error = err instanceof Error ? err.message : "An unexpected error occurred";
            loading = false;
        }
    }
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
    <div class="w-full max-w-md space-y-8">
        <div>
            <h2 class="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
                Sign in to your account
            </h2>
        </div>

        <form class="space-y-6" onsubmit={handleSignIn}>
            <div>
                <label for="email" class="block text-sm font-medium text-gray-700">
                    Email address
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    bind:value={email}
                    class="mt-1 block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                    placeholder="you@example.com"
                    required
                />
            </div>

            <div>
                <label for="password" class="block text-sm font-medium text-gray-700">
                    Password
                </label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    bind:value={password}
                    class="mt-1 block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                    placeholder="Enter your password"
                    required
                />
            </div>

            {#if error}
                <div class="rounded-md bg-red-50 p-4">
                    <p class="text-sm font-medium text-red-800">{error}</p>
                </div>
            {/if}

            <button
                type="submit"
                disabled={loading}
                class="relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
            >
                {#if loading}
                    <span class="flex items-center">
                        <svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle
                                class="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                stroke-width="4"
                            />
                            <path
                                class="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                        Signing in...
                    </span>
                {:else}
                    Sign in
                {/if}
            </button>
        </form>

        <p class="text-center text-sm text-gray-600">
            Don't have an account?
            <a href={resolve("/register")} class="font-medium text-blue-600 hover:text-blue-500">
                Sign up here
            </a>
        </p>
    </div>
</div>
