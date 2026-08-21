<script>
    import { useVisitorData } from "@fingerprint/svelte";
    const { getData, data, isLoading, error } = useVisitorData({ immediate: false });
</script>

<div>
    <button onclick={() => getData()}>Get visitor data</button>
    {#if $isLoading}
        Loading...
    {/if}
    {#if $error}
        {$error.message}
    {/if}
    {#if $data}
        <pre>{JSON.stringify($data, null, 2)}</pre>
    {/if}
</div>
