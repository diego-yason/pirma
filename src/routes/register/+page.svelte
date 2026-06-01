<script lang="ts">
    import { authClient } from "$lib/auth-client";
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";
    import {
        generateKeyPair,
        exportPublicKey,
        encryptPrivateKey,
    } from "$lib/client/key/generateKey";
    import { storeKeys } from "$lib/client/key/store";
    import {uploadKeys} from "./keyManagement.remote"

    let email = $state("");
    let password = $state("");
    let confirmPassword = $state("");
    let loading = $state(false);
    let error = $state<string | null>(null);

    async function handleRegister(e: SubmitEvent) {
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

        if (password !== confirmPassword) {
            error = "Passwords do not match";
            loading = false;
            return;
        }

        if (password.length < 8) {
            error = "Password must be at least 8 characters";
            loading = false;
            return;
        }

        try {
            const { data, error: signUpError } = await authClient.signUp.email({
                email: email.trim(),
                password,
                name: email.split("@")[0],
            });

            if (signUpError) {
                error = signUpError.message || "Failed to register";
                loading = false;
                return;
            }
            console.log("Registration successful:", data);
            if (data?.user?.id) {
                // Generate cryptographic key pair and store encrypted in IndexedDB.
                // Wrapped in an IIFE so the key handles go out of scope immediately
                // after wrapping, minimizing in-memory exposure.
                try {
                    console.log("Generating key pair for user:", data.user.id);

                    const { publicKey, encryptedPrivateKey } = await (async () => {
                        const kp = await generateKeyPair();
                        const pub = await exportPublicKey(kp.publicKey);
                        const enc = await encryptPrivateKey(kp.privateKey, password, data.user.id);
                        return { publicKey: pub, encryptedPrivateKey: enc };
                    })();


                    const storeKeyPromise = storeKeys(data.user.id, {
                        publicKey,
                        encryptedPrivateKey,
                    });

                    // convert to b64 strings
                    const b64Keys = {
                        pubkey: btoa(publicKey),
                        pkey: btoa(encryptedPrivateKey),
                    };
                    
                    await uploadKeys(b64Keys);

                    await Promise.all([storeKeyPromise]);
                } catch (keyErr) {
                    console.error("Key generation/storage failed:", keyErr);
                    // Continue with registration even if key storage fails
                }

                await goto(resolve("/login"));
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
                Create your account
            </h2>
            <p class="mt-2 text-center text-sm text-gray-600">
                Sign up with your email and password
            </p>
        </div>

        <form class="space-y-6" onsubmit={handleRegister}>
            <div>
                <label for="email" class="block text-sm font-medium text-gray-700"> Email </label>
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
                    placeholder="At least 8 characters"
                    required
                />
            </div>

            <div>
                <label for="confirmPassword" class="block text-sm font-medium text-gray-700">
                    Confirm Password
                </label>
                <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    bind:value={confirmPassword}
                    class="mt-1 block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
                    placeholder="Confirm your password"
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
                        Creating account...
                    </span>
                {:else}
                    Create Account
                {/if}
            </button>
        </form>

        <p class="text-center text-sm text-gray-600">
            Already have an account?
            <a href={resolve("/login")} class="font-medium text-blue-600 hover:text-blue-500">
                Sign in here
            </a>
        </p>
    </div>
</div>
