<script lang="ts">
    type Flag = "urgent" | "important" | "due-soon";

    interface Props {
        flags?: Flag[];
        title?: string;
        from?: string;
        fromEmail?: string;
        dueDate?: string;
        pages?: number;
    }

    let {
        flags = ["important", "due-soon"],
        title = "Non-Disclosure Agreement (Q3 Project)",
        from = "Prima Corp Legal",
        fromEmail = "legal@example.com",
        dueDate = "Today",
        pages = 12,
    }: Props = $props();

    const flagConfig: Record<Flag, { label: string; bg: string; text: string }> = {
        urgent: { label: "URGENT", bg: "bg-red-200", text: "text-red-800" },
        important: { label: "IMPORTANT", bg: "bg-amber-200", text: "text-amber-800/80" },
        "due-soon": { label: "DUE SOON", bg: "bg-blue-200", text: "text-blue-800" },
    };

    // Canonical display order — always show flags in this sequence
    const flagOrder: Flag[] = ["urgent", "important", "due-soon"];
    const sortedFlags = $derived(
        flags.toSorted((a, b) => flagOrder.indexOf(a) - flagOrder.indexOf(b)),
    );

    const cardColor: Record<Flag, string> = {
        urgent: "border-red-800",
        important: "border-amber-800/80",
        "due-soon": "border-blue-800",
    };

    const leftBorder = $derived(
        sortedFlags.length > 0 ? cardColor[sortedFlags[0]] : "border-neutral-300",
    );
</script>

<div
    class="flex gap-4 justify-between items-center-safe px-5 py-5 border-l-4 {leftBorder}"
    class:border={sortedFlags.includes("urgent")}
>
    <p
        class="h-15 rounded-md content-center aspect-square {flagConfig[sortedFlags[0]]?.bg ||
            'bg-gray-200'} font-extrabold text-4xl {flagConfig[sortedFlags[0]]?.text ||
            'text-gray-800'} text-center"
    >
        !
    </p>
    <div class="grow">
        <div class="flex gap-3 items-center flex-wrap">
            <p class="text-xl font-bold">{title}</p>
            {#each sortedFlags as flag (flag)}
                <span
                    class="text-sm py-1 px-2 rounded-md {flagConfig[flag].bg} {flagConfig[flag]
                        .text} font-semibold"
                >
                    {flagConfig[flag].label}
                </span>
            {/each}
        </div>
        <p>From: <span class="font-medium">{from}</span> &lt;{fromEmail}&gt;</p>
        <div class="flex gap-3">
            <p>Due {dueDate}</p>
            <p>{pages} Pages</p>
        </div>
    </div>
    <button class="bg-secondary-600 text-primary-50 px-8 py-3 rounded-md cursor-pointer"
        >Review & Sign</button
    >
</div>
