<script lang="ts">
    let { data } = $props();

    const { subject, html } = data as { subject: string; html: string };
</script>

<svelte:head><title>Email preview — {subject}</title></svelte:head>

<div class="mx-auto max-w-3xl px-6 py-10">
    <h1 class="mb-1 text-lg font-semibold text-neutral-900">Email preview</h1>
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
