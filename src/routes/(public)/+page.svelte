<script lang="ts">
    import { resolve } from "$app/paths";

    const features = [
        {
            title: "Legally binding e-signatures",
            body: "Signatures that hold up — ESIGN / UETA and eIDAS-ready, with click-to-consent disclosure and a full audit trail.",
            href: resolve("features"),
            icon: "pen",
        },
        {
            title: "Blockchain-anchored integrity",
            body: "Every signed document is hashed and anchored to the blockchain, so authenticity and timestamps are independently provable.",
            href: resolve("blockchain"),
            icon: "chain",
        },
        {
            title: "PDF/A & PAdES archival",
            body: "Long-term PDF/A-2b artifacts with embedded PAdES signatures — built to remain verifiable for decades.",
            href: resolve("security"),
            icon: "archive",
        },
        {
            title: "Guest & remote signing",
            body: "Signers don't need an account. Invite anyone by email and let them sign securely with a one-time code.",
            href: resolve("features"),
            icon: "globe",
        },
        {
            title: "Identity verification",
            body: "Email OTP, two-factor authentication, and optional KYC give you confidence in who's actually signing.",
            href: resolve("security"),
            icon: "shield",
        },
        {
            title: "Notary & RON",
            body: "From in-person notarization to remote online notarization, with a tamper-evident journal of record.",
            href: resolve("features"),
            icon: "seal",
        },
    ];

    const steps = [
        {
            title: "Upload your document",
            body: "Drop in a PDF, DOCX, or image. We normalize it to PDF/A for long-term archiving.",
        },
        {
            title: "Place fields & invite signers",
            body: "Drag signature, initials, and text fields. Add signers and set signing order, deadlines, and 2FA.",
        },
        {
            title: "Sign & anchor to the chain",
            body: "Everyone signs from any device. The finished artifact is sealed and anchored to the blockchain.",
        },
    ];

    const stats = [
        { value: "2 min", label: "average time to sign" },
        { value: "100%", label: "tamper-evident records" },
        { value: "7 days", label: "guest sign links" },
        { value: "A-2b", label: "PDF/A archival grade" },
    ];
</script>

<svelte:head>
    <title>Pirma — Sign, notarize, and verify with blockchain certainty</title>
    <meta
        name="description"
        content="Pirma is a modern e-signature and e-notary platform with blockchain anchoring, PDF/A archival, and identity verification."
    />
</svelte:head>

<div class="font-inter text-foreground-primary">
    <!-- ── Hero ─────────────────────────────────────────────── -->
    <section class="relative overflow-hidden">
        <div class="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
            <div>
                <p class="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold tracking-wide text-primary-700 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-300">
                    <span class="h-1.5 w-1.5 rounded-full bg-primary-500"></span>
                    E-signature &amp; e-notary, reimagined
                </p>
                <h1 class="mt-5 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
                    Sign, notarize, and verify documents with
                    <span class="text-secondary-600 dark:text-secondary-400">blockchain certainty</span>.
                </h1>
                <p class="mt-5 max-w-xl text-lg text-foreground-secondary">
                    Pirma turns every signature into a tamper-evident record — legally binding
                    e-signatures, PDF/A archiving, and cryptographic proof anchored on-chain.
                </p>
                <div class="mt-8 flex flex-wrap items-center gap-4">
                    <a
                        href={resolve("register")}
                        class="rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white transition hover:bg-primary-700"
                    >
                        Start free
                    </a>
                    <a
                        href={resolve("features")}
                        class="rounded-lg border border-neutral-300 px-6 py-3 font-semibold text-foreground-primary transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
                    >
                        Explore features
                    </a>
                </div>
                <p class="mt-6 text-sm text-foreground-tertiary">
                    ESIGN / UETA compliant · eIDAS-ready · PAdES &amp; PDF/A
                </p>
            </div>

            <div class="relative">
                <img
                    src="https://placehold.co/1200x900/4f46e5/ffffff?text=Signing+Dashboard"
                    alt="Pirma signing dashboard preview"
                    class="w-full rounded-2xl border border-neutral-200 shadow-2xl dark:border-neutral-800"
                />
            </div>
        </div>
    </section>

    <!-- ── Stats ────────────────────────────────────────────── -->
    <section class="border-y border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
        <div class="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 py-10 md:grid-cols-4">
            {#each stats as stat (stat.label)}
                <div class="text-center">
                    <p class="text-3xl font-bold text-primary-600 dark:text-primary-400">{stat.value}</p>
                    <p class="mt-1 text-sm text-foreground-secondary">{stat.label}</p>
                </div>
            {/each}
        </div>
    </section>

    <!-- ── Features ─────────────────────────────────────────── -->
    <section class="mx-auto max-w-7xl px-6 py-20 md:py-24">
        <div class="mx-auto max-w-2xl text-center">
            <h2 class="text-3xl font-bold tracking-tight md:text-4xl">Everything a modern signing platform needs</h2>
            <p class="mt-4 text-lg text-foreground-secondary">
                From the first upload to the final on-chain proof, Pirma covers the whole lifecycle.
            </p>
        </div>

        <div class="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {#each features as feature (feature.title)}
                <a
                    href={feature.href}
                    class="group rounded-2xl border border-neutral-200 p-6 transition hover:border-primary-300 hover:shadow-lg dark:border-neutral-800 dark:hover:border-primary-700"
                >
                    <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary-100 text-secondary-700 dark:bg-secondary-950 dark:text-secondary-300">
                        {#if feature.icon === "pen"}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-6 w-6"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 2.651 2.65a1.5 1.5 0 0 1 0 2.122l-9.55 9.55-4.772 1.06 1.06-4.771 9.551-9.55a1.5 1.5 0 0 1 1.06-.061Z" /><path d="m14.5 7.5 3 3" /></svg>
                        {:else if feature.icon === "chain"}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-6 w-6"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-2.6 2.6a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-2.6 2.6a4.5 4.5 0 0 0 1.242 7.244" /></svg>
                        {:else if feature.icon === "archive"}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-6 w-6"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632A2.25 2.25 0 0 1 17.378 20H6.622a2.25 2.25 0 0 1-2.247-1.868L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>
                        {:else if feature.icon === "globe"}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-6 w-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3 7.5 7.03 7.5 12s2.015 9 4.5 9Zm0 0c-3.866 0-7-1.79-7-4s3.134-4 7-4 7 1.79 7 4-3.134 4-7 4Z" /></svg>
                        {:else if feature.icon === "shield"}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-6 w-6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.96 11.96 0 0 1 3.598 6 12 12 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Z" /></svg>
                        {:else}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-6 w-6"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" /></svg>
                        {/if}
                    </div>
                    <h3 class="mt-5 text-lg font-semibold">{feature.title}</h3>
                    <p class="mt-2 text-sm leading-relaxed text-foreground-secondary">{feature.body}</p>
                </a>
            {/each}
        </div>
    </section>

    <!-- ── How it works ─────────────────────────────────────── -->
    <section class="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div class="mx-auto max-w-7xl px-6 py-20 md:py-24">
            <div class="mx-auto max-w-2xl text-center">
                <h2 class="text-3xl font-bold tracking-tight md:text-4xl">Three steps to a sealed signature</h2>
                <p class="mt-4 text-lg text-foreground-secondary">No accounts required for your signers. No friction.</p>
            </div>

            <div class="mt-14 grid gap-8 md:grid-cols-3">
                {#each steps as step, i (step.title)}
                    <div class="relative rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
                        <span class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white">
                            {i + 1}
                        </span>
                        <h3 class="mt-5 text-lg font-semibold">{step.title}</h3>
                        <p class="mt-2 text-sm leading-relaxed text-foreground-secondary">{step.body}</p>
                    </div>
                {/each}
            </div>

            <img
                src="https://placehold.co/1200x500/0ea5e9/ffffff?text=Assign+fields+%26+invite+signers"
                alt="How signing works in Pirma"
                class="mt-12 w-full rounded-2xl border border-neutral-200 dark:border-neutral-800"
            />
        </div>
    </section>

    <!-- ── Blockchain / security highlight ───────────────────── -->
    <section class="mx-auto max-w-7xl px-6 py-20 md:py-24">
        <div class="grid items-center gap-12 md:grid-cols-2">
            <img
                src="https://placehold.co/900x600/14b8a6/ffffff?text=Hash+Chain+Anchoring"
                alt="Blockchain anchoring diagram"
                class="order-last w-full rounded-2xl border border-neutral-200 shadow-xl dark:border-neutral-800 md:order-first"
            />
            <div>
                <h2 class="text-3xl font-bold tracking-tight md:text-4xl">Every signature, provably yours.</h2>
                <p class="mt-4 text-lg text-foreground-secondary">
                    Each finished document is hashed and anchored to the blockchain, producing an
                    immutable proof of what was signed — and when. A structured audit trail records
                    every view, sign, and reject for compliance and dispute resolution.
                </p>
                <ul class="mt-6 space-y-3 text-sm">
                    <li class="flex items-start gap-3">
                        <span class="mt-0.5 text-tertiary-600">✓</span>
                        <span>Content-addressed hashing of the final PDF/A artifact</span>
                    </li>
                    <li class="flex items-start gap-3">
                        <span class="mt-0.5 text-tertiary-600">✓</span>
                        <span>Append-only, hash-chained audit log with IP &amp; device context</span>
                    </li>
                    <li class="flex items-start gap-3">
                        <span class="mt-0.5 text-tertiary-600">✓</span>
                        <span>Independent public verification for any signed document</span>
                    </li>
                </ul>
                <a
                    href={resolve("blockchain")}
                    class="mt-8 inline-block rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white transition hover:bg-primary-700"
                >
                    Learn about anchoring
                </a>
            </div>
        </div>
    </section>

    <!-- ── Testimonial ───────────────────────────────────────── -->
    <section class="border-t border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
        <div class="mx-auto max-w-3xl px-6 py-20 text-center">
            <blockquote class="text-2xl font-medium leading-snug">
                “Pirma removed the last bit of doubt from our contracts. The on-chain proof means we
                never argue about what was signed.”
            </blockquote>
            <div class="mt-8 flex items-center justify-center gap-4">
                <img
                    src="https://placehold.co/96x96/4f46e5/ffffff?text=JD"
                    alt="Customer avatar"
                    class="h-12 w-12 rounded-full"
                />
                <div class="text-left">
                    <p class="font-semibold">Juan Dela Cruz</p>
                    <p class="text-sm text-foreground-secondary">COO, Acme Corporation</p>
                </div>
            </div>
        </div>
    </section>

    <!-- ── CTA band ──────────────────────────────────────────── -->
    <section class="mx-auto max-w-7xl px-6 py-20">
        <div class="rounded-3xl bg-primary-600 px-8 py-14 text-center text-white">
            <h2 class="text-3xl font-bold tracking-tight md:text-4xl">Ready to sign smarter?</h2>
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

    <!-- ── Footer ────────────────────────────────────────────── -->
    <footer class="border-t border-neutral-200 dark:border-neutral-800">
        <div class="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 md:grid-cols-4">
            <div>
                <p class="text-xl font-bold">Pirma</p>
                <p class="mt-3 max-w-xs text-sm text-foreground-secondary">
                    Secure e-signature and e-notary with blockchain anchoring and PDF/A archival.
                </p>
            </div>
            <div>
                <p class="font-semibold">Product</p>
                <ul class="mt-4 space-y-2 text-sm text-foreground-secondary">
                    <li><a class="hover:text-foreground-primary" href={resolve("features")}>Features</a></li>
                    <li><a class="hover:text-foreground-primary" href={resolve("blockchain")}>Blockchain</a></li>
                    <li><a class="hover:text-foreground-primary" href={resolve("security")}>Security</a></li>
                    <li><a class="hover:text-foreground-primary" href={resolve("pricing")}>Pricing</a></li>
                </ul>
            </div>
            <div>
                <p class="font-semibold">Company</p>
                <ul class="mt-4 space-y-2 text-sm text-foreground-secondary">
                    <li><a class="hover:text-foreground-primary" href={resolve("features")}>About</a></li>
                    <li><a class="hover:text-foreground-primary" href={resolve("features")}>Blog</a></li>
                    <li><a class="hover:text-foreground-primary" href={resolve("features")}>Careers</a></li>
                </ul>
            </div>
            <div>
                <p class="font-semibold">Legal</p>
                <ul class="mt-4 space-y-2 text-sm text-foreground-secondary">
                    <li><a class="hover:text-foreground-primary" href={resolve("security")}>Privacy</a></li>
                    <li><a class="hover:text-foreground-primary" href={resolve("security")}>Terms</a></li>
                    <li><a class="hover:text-foreground-primary" href={resolve("security")}>Compliance</a></li>
                </ul>
            </div>
        </div>
        <div class="border-t border-neutral-200 py-6 text-center text-sm text-foreground-tertiary dark:border-neutral-800">
            © {new Date().getFullYear()} Pirma. All rights reserved.
        </div>
    </footer>
</div>
