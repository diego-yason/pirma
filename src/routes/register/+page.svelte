<script lang="ts">
    import { authClient } from "$lib/auth-client";
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";
    import { generateKeyPair, sign } from "$lib/client/sw-key";
    import { uploadKeys } from "./keyManagement.remote";

    let email = $state("");
    let password = $state("");
    let confirmPassword = $state("");
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
                    console.log("[register] Generating cryptographic key pair in service worker", {
                        userId: data.user.id,
                    });
                    const { publicKey, kid, publicKeyPw, kidPw, keyLevel, keyLevelPw, algorithm } =
                        await generateKeyPair({
                            userId: data.user.id,
                            password,
                        });
                    console.log("[register] Key pairs generated", {
                        kid,
                        kidPw,
                        keyLevel,
                        keyLevelPw,
                        algorithm,
                    });

                    // Request a challenge from the server to prove key ownership
                    console.log("[register] Requesting challenge");
                    const chalRes = await fetch("/api/keys/challenge");
                    if (!chalRes.ok) throw new Error("Failed to get challenge");
                    const challenge = await chalRes.json();
                    const challengeStr = JSON.stringify(challenge);
                    console.log("[register] Challenge received", { nonce: challenge.nonce });

                    // Sign the challenge with both keys
                    console.log("[register] Signing challenge with both keys");
                    const [sigA, sigB] = await Promise.all([
                        sign(kid, challengeStr),
                        sign(kidPw, challengeStr),
                    ]);

                    console.log("[register] Uploading signed public keys to server");

                    /** Upload a single key with challenge-response, retrying once on failure. */
                    async function uploadWithRetry(opts: {
                        pubkey: string;
                        keyLevel: number;
                        nonce: string;
                        kid: string;
                        signature: string;
                        label: string;
                    }): Promise<boolean> {
                        for (let attempt = 1; attempt <= 2; attempt++) {
                            try {
                                // On retry, get a fresh challenge and re-sign
                                let c = challenge;
                                let sig = opts.signature;
                                if (attempt > 1) {
                                    console.log(`[register] Retry ${opts.label} — fetching new challenge`);
                                    const r = await fetch("/api/keys/challenge");
                                    if (!r.ok) continue;
                                    c = await r.json();
                                    sig = await sign(opts.kid, JSON.stringify(c));
                                }
                                await uploadKeys({
                                    pubkey: opts.pubkey,
                                    keyLevel: opts.keyLevel,
                                    nonce: c.nonce,
                                    kid: opts.kid,
                                    signature: sig,
                                });
                                console.log(`[register] ${opts.label} accepted`);
                                return true;
                            } catch (e) {
                                console.warn(`[register] ${opts.label} attempt ${attempt} failed`, e);
                            }
                        }
                        return false;
                    }

                    const results = await Promise.all([
                        uploadWithRetry({ pubkey: publicKey, keyLevel, nonce: challenge.nonce, kid, signature: sigA, label: "keyA (userId)" }),
                        uploadWithRetry({ pubkey: publicKeyPw, keyLevel: keyLevelPw, nonce: challenge.nonce, kid: kidPw, signature: sigB, label: "keyB (password)" }),
                    ]);

                    const accepted = results.filter(Boolean).length;
                    if (accepted === 0) {
                        throw new Error("Both keys rejected by server — cannot proceed");
                    }
                    console.log(`[register] ${accepted}/2 keys accepted by server`);
                } catch (keyErr) {
                    console.error("[register] Key generation/storage failed:", keyErr);
                    error = "Failed to set up signing keys. Please try again.";
                    loading = false;
                    return;
                }

                console.log("[register] Registration complete, redirecting to login");
                await goto(resolve("/login"));
            }
        } catch (err) {
            console.error("[register] Unexpected error:", err);
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
