<script lang="ts">
    import { resolve } from "$app/paths";

    const keys = [
        {
            icon: "lock",
            title: "Keys never leave your device",
            body: "Signing keys are generated in a service worker. Only public keys ever reach our servers — private keys never do.",
        },
        {
            icon: "layers",
            title: "Session & persistent keys",
            body: "Level-1 session keys live only in memory. Level-2 keys are password-bound and wrapped with AES-GCM and a per-key salt.",
        },
        {
            icon: "check",
            title: "Proof of possession",
            body: "Before a public key is accepted, you sign a one-time challenge — we never trust a key we haven't verified you control.",
        },
        {
            icon: "clock",
            title: "Rotation & revocation",
            body: "Keys auto-rotate on age, idle, usage, and algorithm policy. Revoke any key instantly without losing past verifiability.",
        },
    ];

    const access = [
        {
            icon: "shield",
            title: "OPAQUE password auth",
            body: "Your password never leaves your browser — not even as a hash. Login is resistant to enumeration and offline attacks.",
        },
        {
            icon: "fingerprint",
            title: "Passkeys",
            body: "Sign in with device-bound WebAuthn passkeys for phishing-resistant authentication.",
        },
        {
            icon: "globe",
            title: "Guest OTP",
            body: "Guests prove control of their inbox with a single-use, short-lived email code before signing.",
        },
        {
            icon: "layers",
            title: "Two-factor / tier-2 signing",
            body: "Sensitive packages require a password-unlocked persistent key — the signature itself carries the second factor.",
        },
    ];

    const integrity = [
        {
            icon: "chain",
            title: "Blockchain anchoring",
            body: "Signed artifacts are hashed and anchored on-chain for immutable, timestamped proof.",
        },
        {
            icon: "hash",
            title: "Hashes only",
            body: "Only one-way fingerprints go on-chain — never document content, names, or personal data.",
        },
        {
            icon: "trail",
            title: "Structured audit trail",
            body: "An append-only, hash-chained log records every view, sign, and reject with IP and device context.",
        },
    ];

    const ops = [
        {
            icon: "pencil",
            title: "Redacted, structured logs",
            body: "Centralized log redaction scrubs tokens, codes, and secrets before they're written.",
        },
        {
            icon: "clock",
            title: "Rotation policy",
            body: "Age, idle-time, usage-count, and algorithm checks keep signing keys healthy.",
        },
        {
            icon: "shield",
            title: "Rate limiting",
            body: "Planned: throttling on sign-in, OTP, and reset to blunt credential stuffing and abuse.",
        },
    ];
</script>

<svelte:head>
    <title>Security — Pirma</title>
    <meta
        name="description"
        content="How Pirma keeps your signatures and documents secure — device-held keys, OPAQUE authentication, guest OTP, and hash-only blockchain anchoring."
    />
</svelte:head>

{#snippet icon(name: string)}
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        class="h-6 w-6"
        aria-hidden="true"
    >
        {#if name === "lock"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        {:else if name === "layers"}
            <path stroke-linecap="round" stroke-linejoin="round" d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5" />
        {:else if name === "check"}
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        {:else if name === "clock"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        {:else if name === "shield"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.04A11.96 11.96 0 0 1 3.6 6 12 12 0 0 0 3 9.75c0 5.59 3.82 10.29 9 11.62 5.18-1.33 9-6.03 9-11.62 0-1.31-.21-2.57-.6-3.75h-.15c-3.2 0-6.1-1.25-8.25-3.29Z" />
        {:else if name === "fingerprint"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M7.86 14.4a3.75 3.75 0 1 1 8.28 0m-1.86-1.65a2.25 2.25 0 1 0-4.5 0c0 2.5-.75 4.5-2.25 5.25m9-5.25c0-2.5.75-4.5 2.25-5.25m-9 5.25c0 2.5-.75 4.5-2.25 5.25M12 3.75a8.25 8.25 0 0 0-5.83 2.42M12 3.75a8.25 8.25 0 0 1 5.83 2.42" />
        {:else if name === "globe"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.49 0 4.5-4.03 4.5-9S14.49 3 12 3 7.5 7.03 7.5 12s2.01 9 4.5 9Z" />
        {:else if name === "chain"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.69a4.5 4.5 0 0 1 1.24 7.24l-2.6 2.6a4.5 4.5 0 0 1-6.36-6.36l1.76-1.76m13.35-.62 1.76-1.76a4.5 4.5 0 0 0-6.36-6.36l-2.6 2.6a4.5 4.5 0 0 0 1.24 7.24" />
        {:else if name === "hash"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5" />
        {:else if name === "trail"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 5.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 5.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm8.25-10.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 5.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 5.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM3.75 7.5h6.75m0 5.25H3.75m0 5.25h6.75" />
        {:else if name === "pencil"}
            <path stroke-linecap="round" stroke-linejoin="round" d="m16.86 4.49 2.65 2.65a1.5 1.5 0 0 1 0 2.12l-9.55 9.55-4.77 1.06 1.06-4.77 9.55-9.55a1.5 1.5 0 0 1 1.06-.06Z" />
        {/if}
    </svg>
{/snippet}

{#snippet section(title: string, subtitle: string, items: Array<{ icon: string; title: string; body: string }>)}
    <section class="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div class="mx-auto max-w-2xl text-center">
            <h2 class="text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
            <p class="mt-4 text-lg text-foreground-secondary">{subtitle}</p>
        </div>
        <div class="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {#each items as item (item.title)}
                <div class="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
                    <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary-100 text-secondary-700 dark:bg-secondary-950 dark:text-secondary-300">
                        {@render icon(item.icon)}
                    </div>
                    <h3 class="mt-5 text-lg font-semibold">{item.title}</h3>
                    <p class="mt-2 text-sm leading-relaxed text-foreground-secondary">{item.body}</p>
                </div>
            {/each}
        </div>
    </section>
{/snippet}

<div class="font-inter text-foreground-primary">
    <!-- Header -->
    <section class="border-b border-neutral-200 dark:border-neutral-800">
        <div class="mx-auto max-w-7xl px-6 py-16 md:py-20">
            <p class="text-sm font-semibold tracking-wide text-primary-600 dark:text-primary-400">Security</p>
            <h1 class="mt-3 max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">
                Security isn't a feature. It's the foundation.
            </h1>
            <p class="mt-4 max-w-2xl text-lg text-foreground-secondary">
                Every layer — from the key in your browser to the hash on the chain — is built to
                keep your documents private and your signatures provable.
            </p>
        </div>
    </section>

    {@render section(
        "Signing key architecture",
        "Your private keys stay on your device. We only ever see — and verify — public keys.",
        keys,
    )}

    {@render section(
        "Identity & access",
        "Strong authentication for account holders, and safe-by-design access for guests.",
        access,
    )}

    <!-- Integrity -->
    <section class="border-y border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
        <div class="mx-auto max-w-7xl px-6 py-16 md:py-20">
            <div class="mx-auto max-w-2xl text-center">
                <h2 class="text-3xl font-bold tracking-tight md:text-4xl">Integrity &amp; privacy</h2>
                <p class="mt-4 text-lg text-foreground-secondary">
                    Proof of authenticity without sacrificing confidentiality.
                </p>
            </div>
            <div class="mt-12 grid gap-6 md:grid-cols-3">
                {#each integrity as item (item.title)}
                    <div class="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                        <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-tertiary-100 text-tertiary-700 dark:bg-tertiary-950 dark:text-tertiary-300">
                            {@render icon(item.icon)}
                        </div>
                        <h3 class="mt-5 text-lg font-semibold">{item.title}</h3>
                        <p class="mt-2 text-sm leading-relaxed text-foreground-secondary">{item.body}</p>
                    </div>
                {/each}
            </div>
        </div>
    </section>

    {@render section(
        "Operational hardening",
        "The practices that keep the platform healthy over time.",
        ops,
    )}

    <!-- CTA -->
    <section class="mx-auto max-w-7xl px-6 py-20">
        <div class="rounded-3xl bg-primary-600 px-8 py-14 text-center text-white">
            <h2 class="text-3xl font-bold tracking-tight md:text-4xl">Sign with confidence</h2>
            <p class="mx-auto mt-4 max-w-xl text-primary-100">
                Your documents stay private. Your signatures stay provable.
            </p>
            <div class="mt-8 flex flex-wrap items-center justify-center gap-4">
                <a
                    href={resolve("register")}
                    class="rounded-lg bg-white px-6 py-3 font-semibold text-primary-700 transition hover:bg-primary-50"
                >
                    Get started free
                </a>
                <a
                    href={resolve("blockchain")}
                    class="rounded-lg border border-white/40 px-6 py-3 font-semibold text-white transition hover:bg-primary-700"
                >
                    How anchoring works
                </a>
            </div>
        </div>
    </section>
</div>
