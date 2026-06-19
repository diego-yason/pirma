<script>
    import SignatureRequest from "./SignatureRequest.svelte";
</script>

<!-- consistent R-padding is 4 -->

<h2 class="text-3xl px-4 font-bold">Waiting for You</h2>
<p class="text-lg px-4 mb-4 text-neutral-200">
    You have 1 document waiting for your review and signature and received 5 documents that are
    completely signed.
</p>

<div class="flex flex-col px-5">
    <SignatureRequest></SignatureRequest>
</div>

<div class="px-4 mt-8">
    <div class="py-2 border border-neutral-800 items-center rounded-t-md flex justify-between px-4">
        <h2 class="text-2xl font-semibold tracking-wide">Recent Documents</h2>
        <a class="text-secondary-500 tracking-wide" href="">View All</a>
    </div>
    <!-- header -->
    <div class="text-sm grid border-neutral-800 grid-cols-8 border border-t-0 py-4 px-4">
        <p class="font-medium text-neutral-500 tracking-wider uppercase col-span-3">
            Document Name
        </p>
        <p class="font-medium text-neutral-500 tracking-wider uppercase col-span-2">Owner</p>
        <p class="font-medium text-neutral-500 tracking-wider uppercase">Date</p>
        <p class="font-medium text-neutral-500 tracking-wider uppercase">Status</p>
        <p class="font-medium text-neutral-500 tracking-wider uppercase">view</p>
    </div>
    <div
        class="text-sm grid py-4 border border-t-0 border-neutral-800 rounded-b-md grid-cols-8 px-4 items-center"
    >
        <p class="col-span-3">Q3 Non-Disclosure Agreement</p>
        <p class="col-span-2">Juan Dela Cruz (you)</p>
        <p class="">21 June 2026</p>
        <p class="">Awaiting Signatories</p>
        <!-- TODO: turn to options menu -->
        <a href="" class="text-secondary-200">View Document</a>
    </div>
</div>
