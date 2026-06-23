<script lang="ts">
    import type { PageProps } from "./$types";

    let { data }: PageProps = $props();
</script>

<div class="ml-5 mt-8">
    <h2 class="text-xl font-semibold">Package Created</h2>
    <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
        Package ID: <code class="font-mono">{data.packageId}</code>
    </p>
</div>
