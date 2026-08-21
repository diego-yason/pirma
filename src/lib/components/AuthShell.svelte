<script lang="ts">
    import { resolve } from "$app/paths";
    import { page } from "$app/state";

    let { children } = $props();

    // Keep the shell's "active" label in sync with the route for the footer.
    const isLogin = $derived(page.url.pathname.endsWith("/login"));
</script>

<div class="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
    {#snippet logo()}
        <a href={resolve("/")} class="inline-flex items-center gap-2.5">
            <span
                class="grid h-10 w-10 place-items-center rounded-xl bg-linear-to-br from-secondary-500 to-primary-700 text-lg font-black text-white shadow-lg shadow-primary-900/30"
                aria-hidden="true"
            >
                P
            </span>
            <span class="text-xl font-bold tracking-tight">Pirma</span>
        </a>
    {/snippet}

    <!-- Brand / marketing panel -->
    <aside
        class="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-primary-900 via-primary-950 to-secondary-950 p-12 text-white lg:flex"
    >
        <!-- decorative glows -->
        <div
            aria-hidden="true"
            class="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-secondary-500/30 blur-3xl"
        ></div>
        <div
            aria-hidden="true"
            class="pointer-events-none absolute -right-24 -bottom-40 h-112 w-md rounded-full bg-tertiary-500/20 blur-3xl"
        ></div>
        <div
            aria-hidden="true"
            class="pointer-events-none absolute top-1/3 right-16 h-40 w-40 rounded-full bg-primary-400/20 blur-2xl"
        ></div>

        <div class="relative z-10">{@render logo()}</div>

        <div class="relative z-10 max-w-md">
            <h2 class="text-4xl leading-tight font-bold tracking-tight">
                Sign documents securely, from anywhere.
            </h2>
            <p class="mt-4 text-sm leading-relaxed text-white/70">
                Pirma keeps every signature private, verifiable, and post-quantum ready — with a
                clear audit trail for every document you send.
            </p>

            <ul class="mt-10 space-y-5">
                {#each ["End-to-end encrypted signing keys", "Verifiable signatures with a tamper-evident trail", "Guest signing, reminders, and email notifications", "Post-quantum ready (PQC) by design"] as feature (feature)}
                    <li class="flex items-start gap-3 text-sm text-white/85">
                        <span
                            class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15 text-white"
                            aria-hidden="true"
                        >
                            <svg
                                viewBox="0 0 16 16"
                                fill="none"
                                class="h-3 w-3"
                                stroke="currentColor"
                                stroke-width="2.2"><path d="M3 8.5 6.2 11.5 13 5"></path></svg
                            >
                        </span>
                        <span>{feature}</span>
                    </li>
                {/each}
            </ul>
        </div>

        <div class="relative z-10 text-xs text-white/45">
            <p>© 2026 Pirma · Trusted signatures for modern teams.</p>
        </div>
    </aside>

    <!-- Form panel -->
    <main
        class="flex min-h-screen items-center justify-center bg-neutral-50 px-6 py-12 dark:bg-neutral-950"
    >
        <div class="w-full max-w-md">
            <div
                class="rounded-2xl border border-neutral-200 bg-white p-8 shadow-xl shadow-neutral-200/50 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-black/40"
            >
                <!-- mobile-only logo -->
                <div class="mb-8 lg:hidden">{@render logo()}</div>

                {@render children()}
            </div>

            <p class="mt-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
                {isLogin ? "New to Pirma?" : "Already have an account?"}
                <a
                    href={resolve(isLogin ? "register" : "login")}
                    class="font-semibold text-secondary-600 hover:text-secondary-500 dark:text-secondary-400"
                >
                    {isLogin ? "Create an account" : "Sign in"}
                </a>
            </p>
        </div>
    </main>
</div>
