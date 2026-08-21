<script lang="ts">
    let { data } = $props();

    const { subject, html } = data as { subject: string; html: string };
</script>

<svelte:head><title>Email preview — {subject}</title></svelte:head>

<div class="mx-auto max-w-3xl px-6 py-10">
    <div class="mb-1 flex items-center justify-between">
        <h1 class="text-lg font-semibold text-neutral-900">Email preview</h1>
        <a
            href="/email/trigger"
            class="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
        >
            Manual trigger →
        </a>
    </div>
    <p class="mb-6 text-sm text-neutral-500">
        Template: <span class="font-mono">signer-invite</span> · Subject:
        <span class="font-mono">{subject}</span>
    </p>
    <iframe
        title="Email preview"
        class="h-[80vh] w-full rounded-lg border border-neutral-200 bg-white"
        srcdoc={html}
    />
</div>
