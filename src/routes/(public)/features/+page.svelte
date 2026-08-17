<script lang="ts">
    import { resolve } from "$app/paths";

    const core = [
        {
            icon: "pen",
            title: "Legally binding e-signatures",
            body: "Server-verified ECDSA signatures bound to the document, the exact fields, and the signer — nothing can be altered after signing.",
        },
        {
            icon: "list",
            title: "Signing order & routing",
            body: "Group signers into a sequence and enforce it server-side, so documents are signed in exactly the right order.",
        },
        {
            icon: "shield",
            title: "Two-factor / tier-2 signing",
            body: "Require a password-unlocked persistent key for sensitive packages with per-package 2FA.",
        },
        {
            icon: "globe",
            title: "Guest & remote signing",
            body: "Anyone can sign from any device — no account needed. Email OTP proves ownership of the inbox.",
        },
        {
            icon: "bell",
            title: "Invites, reminders & deadlines",
            body: "Automatic email invitations, day-3 / day-7 nudges, and expiration dates keep packages moving.",
        },
        {
            icon: "users",
            title: "Viewers, roles & reject flow",
            body: "Fine-grained recipient roles, viewer access control, and signer rejection with reasons and owner alerts.",
        },
    ];

    const integrity = [
        {
            icon: "chain",
            title: "Blockchain anchoring",
            body: "Every finished artifact's hash is anchored on-chain for independent, timestamped proof of what was signed.",
        },
        {
            icon: "archive",
            title: "PDF/A-2b archival",
            body: "Documents are normalized to PDF/A-2b with embedded fonts and XMP metadata for decades-long retention.",
        },
        {
            icon: "seal",
            title: "PAdES signatures",
            body: "Standards-based embedded signatures (PAdES-BASELINE-T) with trusted timestamps for long-term validity.",
        },
        {
            icon: "check",
            title: "Public verification",
            body: "A public verify page lets anyone independently check PDF/A conformance, the PAdES signature, and the anchor.",
        },
    ];

    const identity = [
        {
            icon: "id",
            title: "Identity verification",
            body: "Email OTP today; SMS OTP, knowledge-based checks, and optional KYC/ID verification on the roadmap.",
        },
        {
            icon: "pin",
            title: "Device & geolocation attestation",
            body: "Capture a device fingerprint and location with each signature for stronger audit context.",
        },
        {
            icon: "trail",
            title: "Structured audit trail",
            body: "An append-only, hash-chained event log records every view, sign, and reject with IP and device data.",
        },
    ];

    const compliance = [
        {
            icon: "scale",
            title: "ESIGN / UETA / eIDAS",
            body: "Built-in disclosure, click-to-consent capture, and signer rights information for major frameworks.",
        },
        {
            icon: "users",
            title: "Organizations, teams & roles",
            body: "Multi-tenant workspaces with roles, permissions, and per-seat management.",
        },
        {
            icon: "code",
            title: "Developer API & webhooks",
            body: "Programmatic document creation, signing-status events, and webhooks for your own systems.",
        },
        {
            icon: "cloud",
            title: "Upload integrations",
            body: "Bring documents in from cloud storage and other sources, straight into the signing flow.",
        },
    ];

    const notary = [
        {
            icon: "id",
            title: "Notary commission management",
            body: "Track licenses, jurisdictions, and expiry across your notary team — with expiry reminders.",
        },
        {
            icon: "grad",
            title: "Compliance onboarding",
            body: "Process video, quiz, certificate, and platform-managed court filing for every notary.",
        },
        {
            icon: "video",
            title: "RON + ION notarization",
            body: "In-person and remote online notarization, with audiovisual recording for RON sessions.",
        },
        {
            icon: "book",
            title: "Journal of record",
            body: "A private-chain record of every notarial act — tamper-evident and audit-ready.",
        },
        {
            icon: "doc",
            title: "Acknowledgment & jurat",
            body: "Jurisdiction-aware wording so each act matches the ceremony you actually performed.",
        },
        {
            icon: "users",
            title: "Witnesses",
            body: "Add witnesses who sign for a different reason, alongside your signers.",
        },
        {
            icon: "qr",
            title: "E-notary seal & QR validator",
            body: "A tamper-evident seal with a QR code anyone can scan to verify.",
        },
    ];
</script>

<svelte:head>
    <title>Features — Pirma</title>
    <meta
        name="description"
        content="Explore Pirma's e-signature, blockchain anchoring, PDF/A archival, identity verification, and e-notary features."
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
        {#if name === "pen"}
            <path stroke-linecap="round" stroke-linejoin="round" d="m16.86 4.49 2.65 2.65a1.5 1.5 0 0 1 0 2.12l-9.55 9.55-4.77 1.06 1.06-4.77 9.55-9.55a1.5 1.5 0 0 1 1.06-.06Z" />
            <path d="m14.5 7.5 3 3" />
        {:else if name === "list"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.008M3.75 12h.008M3.75 17.25h.008" />
        {:else if name === "shield"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.04A11.96 11.96 0 0 1 3.6 6 12 12 0 0 0 3 9.75c0 5.59 3.82 10.29 9 11.62 5.18-1.33 9-6.03 9-11.62 0-1.31-.21-2.57-.6-3.75h-.15c-3.2 0-6.1-1.25-8.25-3.29Z" />
        {:else if name === "globe"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.49 0 4.5-4.03 4.5-9S14.49 3 12 3 7.5 7.03 7.5 12s2.01 9 4.5 9Zm0 0c-3.87 0-7-1.79-7-4s3.13-4 7-4 7 1.79 7 4-3.13 4-7 4Z" />
        {:else if name === "bell"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M14.86 17.08a23.85 23.85 0 0 0 5.45-1.31A8.97 8.97 0 0 1 18 9.75a6 6 0 0 0-12 0c0 4.5-1.67 6.37-2.31 6.02a23.85 23.85 0 0 0 5.45 1.31m5.72 0V18a2.25 2.25 0 1 1-4.5 0v-.92" />
        {:else if name === "users"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.13v-2.51c0-1.02.6-1.93 1.5-2.34a7.5 7.5 0 0 0-9 0c.9.41 1.5 1.32 1.5 2.34v2.51M12 10.88a3.38 3.38 0 1 0 0-6.76 3.38 3.38 0 0 0 0 6.76Zm6 0a3.38 3.38 0 1 0-2.3-5.9M18 15.6c1.48.45 2.25 1.25 2.25 2.28v1.25" />
        {:else if name === "chain"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.69a4.5 4.5 0 0 1 1.24 7.24l-2.6 2.6a4.5 4.5 0 0 1-6.36-6.36l1.76-1.76m13.35-.62 1.76-1.76a4.5 4.5 0 0 0-6.36-6.36l-2.6 2.6a4.5 4.5 0 0 0 1.24 7.24" />
        {:else if name === "archive"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.63 10.63a2.25 2.25 0 0 1-2.25 1.87H6.62a2.25 2.25 0 0 1-2.25-1.87L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.38 7.5h17.25c.62 0 1.13-.5 1.13-1.13v-1.5c0-.62-.5-1.12-1.13-1.12H3.38c-.62 0-1.13.5-1.13 1.13v1.5c0 .62.5 1.12 1.13 1.12Z" />
        {:else if name === "seal"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3.75c1.5 0 2.25.75 3.75.75 1.5 0 2.25 1.13 2.25 2.63 0 1.5.75 2.24 0 3.74-.75 1.5-.75 2.63-2.25 2.63-1.5 0-2.25.75-3.75.75s-2.25-.75-3.75-.75c-1.5 0-1.5-1.13-2.25-2.63-.75-1.5 0-2.24 0-3.74 0-1.5.75-2.63 2.25-2.63 1.5 0 2.25-.75 3.75-.75Z" />
        {:else if name === "check"}
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        {:else if name === "id"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 9.38h2.25m-2.25 3h2.25m-2.25 3h2.25M4.5 19.5h15v-12a1.5 1.5 0 0 0-1.5-1.5H6a1.5 1.5 0 0 0-1.5 1.5v12Zm0-12a1.5 1.5 0 0 1 1.5-1.5h3.75a3 3 0 0 1 3 3v.75a2.25 2.25 0 0 1-2.25 2.25H4.5" />
        {:else if name === "pin"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm0 0c0 3.5-3 6.75-3 6.75s-3-3.25-3-6.75a3 3 0 0 1 6 0Zm-.75-2.25h.008" />
        {:else if name === "trail"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 5.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 5.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm8.25-10.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 5.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 5.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM3.75 7.5h6.75m0 5.25H3.75m0 5.25h6.75" />
        {:else if name === "scale"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3.75v16.5m0-16.5 6 3.75m-6-3.75-6 3.75M3 7.5l2.25 5.25L7.5 7.5H3Zm16.5 0-2.25 5.25L15 7.5h4.5ZM12 20.25h7.5m-15 0h7.5" />
        {:else if name === "code"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
        {:else if name === "cloud"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.33-7.24 6 6 0 0 0-11.65-1.83A4.5 4.5 0 0 0 2.25 15Z" />
        {:else if name === "grad"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.15a60.37 60.37 0 0 0 7.74 7.74l-2.13 2.13a1.5 1.5 0 0 1-2.12 0L5.13 17.4a1.5 1.5 0 0 1 0-2.12l-1.87 1.87Zm15.49-7.9-4.94.98a1.5 1.5 0 0 0-.64.3L5.13 12.6l2.25 2.25 9.06-9.06c.08-.08.19-.2.3-.64l.99-4.94Z" />
        {:else if name === "video"}
            <path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9A2.25 2.25 0 0 0 4.5 18.75Z" />
        {:else if name === "book"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.04A7.88 7.88 0 0 0 5.25 3.75c-1.03 0-2 .23-2.25.25v13.5c.25-.02 1.22-.25 2.25-.25 2.5 0 4.94 1.06 6.75 2.75V6.04Zm0 0A7.88 7.88 0 0 1 18.75 3.75c1.03 0 2 .23 2.25.25v13.5c-.25-.02-1.22-.25-2.25-.25-2.5 0-4.94 1.06-6.75 2.75M12 6.04v13.71" />
        {:else if name === "doc"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.63a2.62 2.62 0 0 0-2.63-2.62H6.38a2.62 2.62 0 0 0-2.63 2.62v6a2.62 2.62 0 0 0 2.63 2.63h7.5M14.25 9 12 12m0 0L9.75 14.25M12 12l2.25 2.25M12 12 9.75 9.75" />
        {:else if name === "qr"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.88h4.5v4.5h-4.5v-4.5Zm12 0h4.5v4.5h-4.5v-4.5Zm-12 12h4.5v4.5h-4.5v-4.5Zm12 0h4.5v4.5h-4.5v-4.5ZM7.5 6h.008M19.5 6h.008M7.5 18h.008M19.5 18h.008M6 3.75h.008M18 3.75h.008M6 15.75h.008M18 15.75h.008" />
        {/if}
    </svg>
{/snippet}

{#snippet section(title: string, subtitle: string, items: Array<{ icon: string; title: string; body: string }>, status?: string)}
    <section class="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
                <div class="flex items-center gap-3">
                    <h2 class="text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
                    {#if status}
                        <span class="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            {status}
                        </span>
                    {/if}
                </div>
                <p class="mt-2 max-w-2xl text-foreground-secondary">{subtitle}</p>
            </div>
        </div>
        <div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {#each items as item (item.title)}
                <div class="rounded-2xl border border-neutral-200 p-6 transition hover:border-primary-300 hover:shadow-md dark:border-neutral-800 dark:hover:border-primary-700">
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
            <p class="text-sm font-semibold tracking-wide text-primary-600 dark:text-primary-400">Features</p>
            <h1 class="mt-3 max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">
                Built for the whole signing lifecycle
            </h1>
            <p class="mt-4 max-w-2xl text-lg text-foreground-secondary">
                Everything you need to sign, notarize, archive, and prove documents — from the
                first upload to on-chain proof.
            </p>
        </div>
    </section>

    {@render section(
        "Core signing",
        "The day-to-day signing workflow, available today.",
        core,
        "Live today",
    )}

    {@render section(
        "Integrity & archival",
        "Cryptographic proof and long-term retention, from our roadmap.",
        integrity,
        "Coming soon",
    )}

    {@render section(
        "Identity, security & audit",
        "Know who signed, from where, and on what device.",
        identity,
        "Coming soon",
    )}

    {@render section(
        "Compliance & organizations",
        "Fit into the legal and operational world around you.",
        compliance,
        "Coming soon",
    )}

    <!-- ── Notary (distinct section) ─────────────────────────── -->
    <section class="border-y border-neutral-200 bg-tertiary-50/40 dark:border-neutral-800 dark:bg-tertiary-950/20">
        <div class="mx-auto max-w-7xl px-6 py-16 md:py-24">
            <div class="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <div class="flex items-center gap-3">
                        <h2 class="text-2xl font-bold tracking-tight md:text-3xl">Notary &amp; e-notarization</h2>
                        <span class="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Coming soon
                        </span>
                    </div>
                    <p class="mt-2 max-w-2xl text-foreground-secondary">
                        A dedicated notary workspace — commissions, journals, and both in-person and
                        remote online notarization — built on the same tamper-evident foundation.
                    </p>
                </div>
                <a
                    href={resolve("register")}
                    class="rounded-lg bg-primary-600 px-5 py-2.5 font-semibold text-white transition hover:bg-primary-700"
                >
                    Join the waitlist
                </a>
            </div>

            <div class="mt-12 grid items-start gap-10 lg:grid-cols-3">
                <div class="grid gap-6 sm:grid-cols-2 lg:col-span-2">
                    {#each notary as item (item.title)}
                        <div class="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
                            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-tertiary-100 text-tertiary-700 dark:bg-tertiary-950 dark:text-tertiary-300">
                                {@render icon(item.icon)}
                            </div>
                            <h3 class="mt-5 text-lg font-semibold">{item.title}</h3>
                            <p class="mt-2 text-sm leading-relaxed text-foreground-secondary">{item.body}</p>
                        </div>
                    {/each}
                </div>
                <div class="lg:sticky lg:top-8">
                    <img
                        src="https://placehold.co/900x1100/0d9488/ffffff?text=RON+%26+Notary+Journal"
                        alt="Remote online notarization and journal preview"
                        class="w-full rounded-2xl border border-neutral-200 shadow-lg dark:border-neutral-800"
                    />
                </div>
            </div>
        </div>
    </section>

    <!-- CTA -->
    <section class="mx-auto max-w-7xl px-6 py-20">
        <div class="rounded-3xl bg-primary-600 px-8 py-14 text-center text-white">
            <h2 class="text-3xl font-bold tracking-tight md:text-4xl">See it in action</h2>
            <p class="mx-auto mt-4 max-w-xl text-primary-100">
                Create your first document in minutes. Your signers don't even need an account.
            </p>
            <div class="mt-8 flex flex-wrap items-center justify-center gap-4">
                <a
                    href={resolve("register")}
                    class="rounded-lg bg-white px-6 py-3 font-semibold text-primary-700 transition hover:bg-primary-50"
                >
                    Get started free
                </a>
                <a
                    href={resolve("pricing")}
                    class="rounded-lg border border-white/40 px-6 py-3 font-semibold text-white transition hover:bg-primary-700"
                >
                    View pricing
                </a>
            </div>
        </div>
    </section>
</div>
