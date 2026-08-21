<script>
    import { FingerprintProvider } from "@fingerprint/svelte";
    import VisitorData from "./VisitorData.svelte";
</script>

<FingerprintProvider
    options={{
        apiKey: "K1Jj8dPCi6aSRU8l7ZsZ",
        endpoints: ["https://id.kingmarine.xyz"],
        region: "ap",
    }}
>
    <!-- <VisitorData /> -->
</FingerprintProvider>
