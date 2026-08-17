<script lang="ts">
    import { resolve } from "$app/paths";

    const tiers = [
        {
            name: "Free",
            price: "$0",
            period: "forever",
            blurb: "For trying it out and occasional signing.",
            features: [
                "3 documents / month",
                "1 signer per document",
                "Guest signing with email OTP",
                "Basic audit trail",
                "Email invitations",
            ],
            cta: "Start free",
            href: resolve("register"),
            highlight: false,
        },
        {
            name: "Pro",
            price: "$25",
            period: "per month",
            blurb: "For individuals and teams who sign regularly.",
            features: [
                "Unlimited documents",
                "Multiple signers & signing order",
                "Two-factor / tier-2 signing",
                "Reminders & deadlines",
                "Blockchain anchoring",
                "PDF/A + PAdES archival",
                "Priority support",
            ],
            cta: "Start 14-day trial",
            href: resolve("register"),
            highlight: true,
        },
        {
            name: "Business",
            price: "$49",
            period: "per month",
            blurb: "For organizations that need control and scale.",
            features: [
                "Everything in Pro",
                "Organizations, teams & roles",
                "Admin console",
                "Developer API & webhooks",
                "Custom retention policies",
                "SSO (coming soon)",
            ],
            cta: "Contact sales",
            href: resolve("register"),
            highlight: false,
        },
    ];

    const comparison = [
        ["Documents", "3 / month", "Unlimited", "Unlimited"],
        ["Signers per document", "1", "Multiple", "Multiple"],
        ["Guest signing (OTP)", "✓", "✓", "✓"],
        ["Signing order", "—", "✓", "✓"],
        ["Two-factor / tier-2 signing", "—", "✓", "✓"],
        ["Reminders & deadlines", "—", "✓", "✓"],
        ["Blockchain anchoring", "—", "✓", "✓"],
        ["PDF/A + PAdES archival", "—", "✓", "✓"],
        ["Organizations & roles", "—", "—", "✓"],
        ["API & webhooks", "—", "—", "✓"],
    ];

    const faqs = [
        {
            q: "Do my signers need an account?",
            a: "No. Signers can sign as guests with a secure email one-time code. Only the document owner needs an account.",
        },
        {
            q: "Is it legally binding?",
            a: "Yes — signatures follow ESIGN / UETA and are eIDAS-ready, with consent capture and a full audit trail for each signing.",
        },
        {
            q: "What goes on the blockchain?",
            a: "Only a one-way hash of the signed document. Your content, signer names, and personal data never leave our systems.",
        },
        {
            q: "Can I cancel or change plans?",
            a: "Yes. Upgrade, downgrade, or cancel anytime. Your signed documents and their proofs remain accessible.",
        },
    ];
</script>

<svelte:head>
    <title>Pricing — Pirma</title>
    <meta
        name="description"
        content="Simple, transparent pricing for Pirma — free to start, with Pro and Business plans for teams and organizations."
    />
</svelte:head>

<div class="font-inter text-foreground-primary">
    <!-- Header -->
    <section class="border-b border-neutral-200 dark:border-neutral-800">
        <div class="mx-auto max-w-7xl px-6 py-16 text-center md:py-20">
            <p class="text-sm font-semibold tracking-wide text-primary-600 dark:text-primary-400">Pricing</p>
            <h1 class="mx-auto mt-3 max-w-2xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">
                Start free. Scale when you're ready.
            </h1>
            <p class="mx-auto mt-4 max-w-xl text-lg text-foreground-secondary">
                No per-signature fees. No surprises. Every plan includes device-held keys and
                guest signing.
            </p>
        </div>
    </section>

    <!-- Tiers -->
    <section class="mx-auto max-w-7xl px-6 py-16">
        <div class="grid gap-8 lg:grid-cols-3">
            {#each tiers as tier (tier.name)}
                <div
                    class="relative flex flex-col rounded-3xl border p-8"
                    class:border-primary-500={tier.highlight}
                    class:shadow-xl={tier.highlight}
                    class:border-neutral-200={!tier.highlight}
                    class:dark:border-neutral-800={!tier.highlight}
                    class:dark:border-primary-600={tier.highlight}
                >
                    {#if tier.highlight}
                        <span class="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white">
                            Most popular
                        </span>
                    {/if}
                    <h2 class="text-lg font-semibold">{tier.name}</h2>
                    <p class="mt-1 text-sm text-foreground-secondary">{tier.blurb}</p>
                    <div class="mt-5 flex items-baseline gap-2">
                        <span class="text-4xl font-bold">{tier.price}</span>
                        <span class="text-sm text-foreground-tertiary">{tier.period}</span>
                    </div>
                    <a
                        href={tier.href}
                        class="mt-6 rounded-lg px-5 py-3 text-center font-semibold transition"
                        class:bg-primary-600={tier.highlight}
                        class:text-white={tier.highlight}
                        class:hover:bg-primary-700={tier.highlight}
                        class:border={!tier.highlight}
                        class:border-neutral-300={!tier.highlight}
                        class:dark:border-neutral-700={!tier.highlight}
                        class:hover:bg-neutral-100={!tier.highlight}
                        class:dark:hover:bg-neutral-900={!tier.highlight}
                    >
                        {tier.cta}
                    </a>
                    <ul class="mt-8 space-y-3 text-sm">
                        {#each tier.features as feature (feature)}
                            <li class="flex items-start gap-3">
                                <span class="mt-0.5 text-tertiary-600">✓</span>
                                <span class="text-foreground-secondary">{feature}</span>
                            </li>
                        {/each}
                    </ul>
                </div>
            {/each}
        </div>

        <p class="mt-10 text-center text-sm text-foreground-secondary">
            Notaries can add the <strong>Notary workspace</strong> — commissions, RON &amp; ION,
            and a journal of record — starting at <strong>$99/mo</strong>.
            <a class="text-primary-600 underline" href={resolve("features")}>Learn more</a>
        </p>
    </section>

    <!-- Comparison table -->
    <section class="border-t border-neutral-200 dark:border-neutral-800">
        <div class="mx-auto max-w-5xl px-6 py-16">
            <h2 class="text-center text-2xl font-bold tracking-tight md:text-3xl">Compare plans</h2>
            <div class="mt-10 overflow-x-auto">
                <table class="w-full min-w-140 text-sm">
                    <thead>
                        <tr class="border-b border-neutral-200 text-left dark:border-neutral-800">
                            <th class="py-3 pr-4 font-semibold">Feature</th>
                            <th class="py-3 pr-4 font-semibold">Free</th>
                            <th class="py-3 pr-4 font-semibold">Pro</th>
                            <th class="py-3 font-semibold">Business</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each comparison as row (row[0])}
                            <tr class="border-b border-neutral-100 dark:border-neutral-900">
                                <td class="py-3 pr-4 text-foreground-secondary">{row[0]}</td>
                                <td class="py-3 pr-4">{row[1]}</td>
                                <td class="py-3 pr-4">{row[2]}</td>
                                <td class="py-3">{row[3]}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>
    </section>

    <!-- FAQ -->
    <section class="border-t border-neutral-200 dark:border-neutral-800">
        <div class="mx-auto max-w-3xl px-6 py-16">
            <h2 class="text-center text-2xl font-bold tracking-tight md:text-3xl">Frequently asked questions</h2>
            <div class="mt-10 space-y-4">
                {#each faqs as faq (faq.q)}
                    <details class="group rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
                        <summary class="flex cursor-pointer list-none items-center justify-between font-semibold">
                            {faq.q}
                            <span class="text-neutral-400 transition group-open:rotate-45">+</span>
                        </summary>
                        <p class="mt-3 text-sm leading-relaxed text-foreground-secondary">{faq.a}</p>
                    </details>
                {/each}
            </div>
        </div>
    </section>

    <!-- CTA -->
    <section class="mx-auto max-w-7xl px-6 pb-20">
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
            </div>
        </div>
    </section>
</div>
