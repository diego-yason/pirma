<script lang="ts">
    import { resolve } from "$app/paths";

    const steps = [
        {
            icon: "hash",
            title: "Hash",
            body: "When a document is finalized, we compute a deterministic SHA-256 of the signed PDF/A artifact.",
        },
        {
            icon: "send",
            title: "Submit",
            body: "That hash is sent to the anchoring service — never the document itself.",
        },
        {
            icon: "clock",
            title: "Confirm",
            body: "The service writes it to the chain. We poll — or receive a webhook — until it's confirmed.",
        },
        {
            icon: "search",
            title: "Verify",
            body: "Anyone can check a document's hash against the chain, at any time, forever.",
        },
    ];

    const privacy = [
        {
            icon: "hash",
            title: "Hashes only",
            body: "A one-way, content-addressed fingerprint. It can't be reversed into the original document.",
        },
        {
            icon: "lock",
            title: "Zero PII",
            body: "No names, emails, files, or signature images ever touch the chain — just hashes.",
        },
        {
            icon: "shield",
            title: "You hold the proof",
            body: "The transaction hash and block number are stored locally so verification is instant.",
        },
    ];
</script>

<svelte:head>
    <title>Blockchain Anchoring — Pirma</title>
    <meta
        name="description"
        content="Pirma anchors document hashes to the blockchain for immutable, timestamped proof — without putting any of your data on-chain."
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
        {#if name === "hash"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5" />
        {:else if name === "send"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.27 3.13a59.77 59.77 0 0 1 18.82 8.87 59.77 59.77 0 0 1-18.82 8.87L6 12Zm0 0h7.5" />
        {:else if name === "clock"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        {:else if name === "search"}
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.2-5.2m2.7-6.3a8.25 8.25 0 1 1-16.5 0 8.25 8.25 0 0 1 16.5 0Z" />
        {:else if name === "chain"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.69a4.5 4.5 0 0 1 1.24 7.24l-2.6 2.6a4.5 4.5 0 0 1-6.36-6.36l1.76-1.76m13.35-.62 1.76-1.76a4.5 4.5 0 0 0-6.36-6.36l-2.6 2.6a4.5 4.5 0 0 0 1.24 7.24" />
        {:else if name === "lock"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        {:else if name === "shield"}
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.04A11.96 11.96 0 0 1 3.6 6 12 12 0 0 0 3 9.75c0 5.59 3.82 10.29 9 11.62 5.18-1.33 9-6.03 9-11.62 0-1.31-.21-2.57-.6-3.75h-.15c-3.2 0-6.1-1.25-8.25-3.29Z" />
        {:else if name === "check"}
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        {/if}
    </svg>
{/snippet}

<div class="font-inter text-foreground-primary">
    <!-- Header -->
    <section class="border-b border-neutral-200 dark:border-neutral-800">
        <div class="mx-auto max-w-7xl px-6 py-16 md:py-20">
            <p class="text-sm font-semibold tracking-wide text-primary-600 dark:text-primary-400">Blockchain anchoring</p>
            <h1 class="mt-3 max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">
                Proof, not promises.
            </h1>
            <p class="mt-4 max-w-2xl text-lg text-foreground-secondary">
                Every finished document is fingerprinted and anchored to the blockchain, giving you
                an immutable, timestamped record of what was signed — without putting any of your
                data on-chain.
            </p>
        </div>
    </section>

    <!-- Hero diagram -->
    <section class="mx-auto max-w-7xl px-6 py-16">
        <img
            src="https://placehold.co/1200x600/1e1b4b/ffffff?text=Anchoring+Flow"
            alt="Blockchain anchoring flow diagram"
            class="w-full rounded-2xl border border-neutral-200 shadow-xl dark:border-neutral-800"
        />
    </section>

    <!-- How it works -->
    <section class="mx-auto max-w-7xl px-6 pb-20">
        <div class="mx-auto max-w-2xl text-center">
            <h2 class="text-3xl font-bold tracking-tight md:text-4xl">How anchoring works</h2>
            <p class="mt-4 text-lg text-foreground-secondary">
                Four steps between a signed document and permanent proof.
            </p>
        </div>

        <div class="mt-12 grid gap-6 md:grid-cols-4">
            {#each steps as step, i (step.title)}
                <div class="relative rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
                    <div class="flex items-center justify-between">
                        <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300">
                            {@render icon(step.icon)}
                        </div>
                        <span class="text-4xl font-bold text-neutral-200 dark:text-neutral-800">{i + 1}</span>
                    </div>
                    <h3 class="mt-5 text-lg font-semibold">{step.title}</h3>
                    <p class="mt-2 text-sm leading-relaxed text-foreground-secondary">{step.body}</p>
                </div>
            {/each}
        </div>
    </section>

    <!-- What goes on-chain -->
    <section class="border-y border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
        <div class="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 md:grid-cols-2">
            <div>
                <h2 class="text-3xl font-bold tracking-tight md:text-4xl">Only hashes. Never your documents.</h2>
                <p class="mt-4 text-lg text-foreground-secondary">
                    The chain stores a one-way fingerprint of each signed artifact. It proves
                    <em>what</em> was signed and <em>when</em> — without ever exposing the content,
                    the parties, or any personal information.
                </p>
                <ul class="mt-6 space-y-3 text-sm">
                    <li class="flex items-start gap-3">
                        <span class="mt-0.5 text-tertiary-600">✓</span>
                        <span>Deterministic SHA-256 of the final PDF/A artifact</span>
                    </li>
                    <li class="flex items-start gap-3">
                        <span class="mt-0.5 text-tertiary-600">✓</span>
                        <span>No raw content, signature images, or PII on-chain</span>
                    </li>
                    <li class="flex items-start gap-3">
                        <span class="mt-0.5 text-tertiary-600">✓</span>
                        <span>Status transitions from <code class="rounded bg-neutral-200 px-1 py-0.5 text-xs dark:bg-neutral-800">signed</code> to <code class="rounded bg-neutral-200 px-1 py-0.5 text-xs dark:bg-neutral-800">anchored</code></span>
                    </li>
                </ul>
            </div>

            <!-- Sample proof card -->
            <div class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
                <div class="flex items-center gap-2">
                    <span class="flex h-8 w-8 items-center justify-center rounded-full bg-tertiary-100 text-tertiary-700 dark:bg-tertiary-950 dark:text-tertiary-300">
                        {@render icon("check")}
                    </span>
                    <p class="font-semibold">Anchor confirmed</p>
                </div>
                <dl class="mt-5 space-y-3 text-sm">
                    <div class="flex justify-between gap-4">
                        <dt class="text-foreground-secondary">Transaction</dt>
                        <dd class="truncate font-mono text-xs">0x7a3f…9c2e</dd>
                    </div>
                    <div class="flex justify-between gap-4">
                        <dt class="text-foreground-secondary">Block</dt>
                        <dd class="font-mono text-xs">18,234,567</dd>
                    </div>
                    <div class="flex justify-between gap-4">
                        <dt class="text-foreground-secondary">Timestamp</dt>
                        <dd class="font-mono text-xs">2026-08-16T12:00:00Z</dd>
                    </div>
                    <div class="flex justify-between gap-4">
                        <dt class="text-foreground-secondary">Payload hash</dt>
                        <dd class="truncate font-mono text-xs">sha256:8f1c…b4d2</dd>
                    </div>
                </dl>
                <p class="mt-4 text-xs text-foreground-tertiary">Illustrative proof record — stored locally for instant verification.</p>
            </div>
        </div>
    </section>

    <!-- Public verification -->
    <section class="mx-auto max-w-7xl px-6 py-20">
        <div class="grid items-center gap-12 md:grid-cols-2">
            <div>
                <h2 class="text-3xl font-bold tracking-tight md:text-4xl">Verify anything, forever.</h2>
                <p class="mt-4 text-lg text-foreground-secondary">
                    A public verification page lets anyone check a document's hash against the
                    chain — no account, no Pirma login, no trust required.
                </p>
                <a
                    href={resolve("register")}
                    class="mt-8 inline-block rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white transition hover:bg-primary-700"
                >
                    Start anchoring documents
                </a>
            </div>
            <div class="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
                <label for="verifyHash" class="text-sm font-semibold">Check a document hash</label>
                <input
                    id="verifyHash"
                    type="text"
                    placeholder="Paste a payload hash…"
                    class="mt-2 w-full rounded-md border-neutral-300 font-mono text-sm dark:border-neutral-700"
                />
                <button
                    type="button"
                    class="mt-3 w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                >
                    Verify
                </button>
                <p class="mt-3 text-xs text-foreground-tertiary">
                    Coming soon — a live public verifier for anchored documents.
                </p>
            </div>
        </div>
    </section>

    <!-- Privacy by design -->
    <section class="border-t border-neutral-200 dark:border-neutral-800">
        <div class="mx-auto max-w-7xl px-6 py-20">
            <div class="mx-auto max-w-2xl text-center">
                <h2 class="text-3xl font-bold tracking-tight md:text-4xl">Privacy by design</h2>
                <p class="mt-4 text-lg text-foreground-secondary">
                    Anchoring proves integrity without sacrificing confidentiality.
                </p>
            </div>
            <div class="mt-12 grid gap-6 md:grid-cols-3">
                {#each privacy as item (item.title)}
                    <div class="rounded-2xl border border-neutral-200 p-6 text-center dark:border-neutral-800">
                        <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-secondary-100 text-secondary-700 dark:bg-secondary-950 dark:text-secondary-300">
                            {@render icon(item.icon)}
                        </div>
                        <h3 class="mt-5 text-lg font-semibold">{item.title}</h3>
                        <p class="mt-2 text-sm leading-relaxed text-foreground-secondary">{item.body}</p>
                    </div>
                {/each}
            </div>
        </div>
    </section>

    <!-- CTA -->
    <section class="mx-auto max-w-7xl px-6 pb-20">
        <div class="rounded-3xl bg-primary-600 px-8 py-14 text-center text-white">
            <h2 class="text-3xl font-bold tracking-tight md:text-4xl">Make every signature provable</h2>
            <p class="mx-auto mt-4 max-w-xl text-primary-100">
                Sign once, anchor forever. Your documents stay private — their proof stays public.
            </p>
            <div class="mt-8 flex flex-wrap items-center justify-center gap-4">
                <a
                    href={resolve("register")}
                    class="rounded-lg bg-white px-6 py-3 font-semibold text-primary-700 transition hover:bg-primary-50"
                >
                    Get started free
                </a>
                <a
                    href={resolve("security")}
                    class="rounded-lg border border-white/40 px-6 py-3 font-semibold text-white transition hover:bg-primary-700"
                >
                    How we secure it
                </a>
            </div>
        </div>
    </section>
</div>
