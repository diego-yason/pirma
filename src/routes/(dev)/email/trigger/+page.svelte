<script lang="ts">
    import { enhance } from "$app/forms";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    type FieldDef = {
        key: string;
        label: string;
        type: "text" | "number" | "select";
        options?: string[];
        placeholder?: string;
        sample: string | number;
    };
    type TemplateDef = {
        key: string;
        label: string;
        description: string;
        fields: FieldDef[];
    };

    const templates = $derived(data.templates as TemplateDef[]);
    const provider = $derived(data.provider as string);

    let selectedKey = $state(templates[0].key);
    let to = $state("");
    let values = $state<Record<string, string | number>>({});
    let sending = $state(false);
    let result = $state<{ ok: boolean; message: string } | null>(null);
    let preview = $state<{ subject: string; html: string } | null>(null);

    const selected = $derived(templates.find((t) => t.key === selectedKey) ?? templates[0]);

    function resetValues() {
        const v: Record<string, string | number> = {};
        for (const f of selected.fields) {
            v[f.key] = f.sample;
        }
        values = v;
    }
    resetValues();

    function onTemplateChange() {
        resetValues();
        result = null;
        preview = null;
    }

    function handleSubmit({ action }) {
        const isSend = String(action).includes("/send");
        if (isSend) {
            // Only reached when the form passes client-side validation.
            sending = true;
            result = null;
            preview = null;
        }
        return async ({ result: actionResult }) => {
            if (actionResult.type === "failure") {
                sending = false;
                result = {
                    ok: false,
                    message:
                        (actionResult.data as { error?: string } | undefined)?.error ??
                        "Something went wrong",
                };
                return;
            }

            const data = actionResult.data as
                | {
                      ok?: boolean;
                      eventId?: string;
                      to?: string;
                      preview?: { subject: string; html: string };
                  }
                | undefined;

            if (isSend) {
                sending = false;
                if (data?.ok) {
                    result = {
                        ok: true,
                        message: `Email sent to ${data.to} (event ${data.eventId}).`,
                    };
                } else {
                    result = { ok: false, message: "Send failed (see server logs)." };
                }
            } else {
                if (data?.preview) {
                    preview = data.preview;
                    result = null;
                } else {
                    result = { ok: false, message: "Preview failed (see server logs)." };
                }
            }
        };
    }
</script>

<svelte:head><title>Manual email trigger</title></svelte:head>

<div class="mx-auto max-w-4xl px-6 py-10">
    <h1 class="mb-1 text-lg font-semibold text-neutral-900">Manual email trigger</h1>
    <p class="mb-6 text-sm text-neutral-500">
        Dev-only tool — sends a real email through the normal pipeline (<span class="font-mono"
            >sendEmail</span
        >) to test providers and templates.
    </p>

    <div class="mb-6 flex flex-wrap gap-2 text-xs">
        <span
            class="rounded-full border border-neutral-300 bg-neutral-100 px-3 py-1 font-mono text-neutral-700"
        >
            provider: {provider}
        </span>
        <a
            href="/email/request"
            class="rounded-full border border-neutral-300 px-3 py-1 text-neutral-600 hover:bg-neutral-100"
        >
            View static previews →
        </a>
    </div>

    <form method="POST" use:enhance={handleSubmit} class="flex flex-col gap-5">
        <input type="hidden" name="template" value={selectedKey} />

        <div class="flex flex-col gap-1">
            <label for="template" class="text-sm font-semibold text-neutral-800">Template</label>
            <select
                id="template"
                bind:value={selectedKey}
                onchange={onTemplateChange}
                class="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            >
                {#each templates as t (t.key)}
                    <option value={t.key}>{t.label}</option>
                {/each}
            </select>
            <p class="text-xs text-neutral-500">{selected.description}</p>
        </div>

        <div class="flex flex-col gap-1">
            <label for="to" class="text-sm font-semibold text-neutral-800">Recipient</label>
            <input
                id="to"
                type="email"
                name="to"
                bind:value={to}
                placeholder="name@example.com"
                class="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            />
        </div>

        <fieldset class="flex flex-col gap-3">
            <legend class="text-sm font-semibold text-neutral-800">Template data</legend>
            {#each selected.fields as field (field.key)}
                <div class="flex flex-col gap-1">
                    <label for={field.key} class="text-xs font-medium text-neutral-600">
                        {field.label}
                    </label>
                    {#if field.type === "select"}
                        <select
                            id={field.key}
                            name={field.key}
                            bind:value={values[field.key]}
                            class="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                        >
                            {#each field.options ?? [] as opt (opt)}
                                <option value={opt}>{opt}</option>
                            {/each}
                        </select>
                    {:else if field.type === "number"}
                        <input
                            id={field.key}
                            type="number"
                            name={field.key}
                            bind:value={values[field.key]}
                            class="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                        />
                    {:else}
                        <input
                            id={field.key}
                            type="text"
                            name={field.key}
                            bind:value={values[field.key]}
                            placeholder={field.placeholder ?? String(field.sample)}
                            class="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
                        />
                    {/if}
                </div>
            {/each}
        </fieldset>

        <div class="flex items-center gap-3">
            <button
                type="submit"
                formaction="?/send"
                disabled={sending}
                class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
                {sending ? "Sending…" : "Send email"}
            </button>
            <button
                type="submit"
                formaction="?/preview"
                class="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
            >
                Preview
            </button>
        </div>

        {#if result}
            <div
                class="rounded-md border px-4 py-3 text-sm"
                class:border-green-300={result.ok}
                class:bg-green-50={result.ok}
                class:text-green-800={result.ok}
                class:border-red-300={!result.ok}
                class:bg-red-50={!result.ok}
                class:text-red-800={!result.ok}
            >
                {result.message}
            </div>
        {/if}
    </form>

    {#if preview}
        <div class="mt-8">
            <p class="mb-1 text-sm font-semibold text-neutral-800">
                Preview <span class="font-mono text-xs font-normal text-neutral-500"
                    >— {preview.subject}</span
                >
            </p>
            <iframe
                title="Email preview"
                class="h-[60vh] w-full rounded-lg border border-neutral-200 bg-white"
                srcdoc={preview.html}
            ></iframe>
        </div>
    {/if}
</div>
