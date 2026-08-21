<script lang="ts">
    import type { Path } from "$app/types";
    import { resolve } from "$app/paths";
    import { page } from "$app/state";
    import { locales, localizeHref } from "#lib/paraglide/runtime.js";
    import { onMount } from "svelte";
    import "./layout.css";
    import favicon from "#lib/assets/favicon.svg";
    import { dev } from "$app/env";

    import Fingerprint from "#lib/client/fingerprint/index.svelte";

    let { children } = $props();

    let isDarkMode = $state(false);

    // Draggable state
    let buttonRight = $state(16);
    let buttonY = $state(600);
    let dragging = $state(false);
    let dragOffsetRight = $state(0);
    let dragOffsetY = $state(0);

    function syncTheme() {
        const root = document.documentElement;

        root.classList.toggle("dark", isDarkMode);
        root.style.colorScheme = isDarkMode ? "dark" : "light";
    }

    function toggleDarkMode() {
        isDarkMode = !isDarkMode;
        localStorage.setItem("theme", isDarkMode ? "dark" : "light");
        syncTheme();
    }

    function onHandlePointerDown(e: PointerEvent) {
        dragging = true;
        dragOffsetRight = window.innerWidth - e.clientX - buttonRight;
        dragOffsetY = e.clientY - buttonY;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }

    function onHandlePointerMove(e: PointerEvent) {
        if (!dragging) return;
        buttonRight = window.innerWidth - e.clientX - dragOffsetRight;
        buttonY = e.clientY - dragOffsetY;
    }

    function onHandlePointerUp() {
        dragging = false;
    }

    onMount(() => {
        const storedTheme = localStorage.getItem("theme");
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

        isDarkMode = storedTheme ? storedTheme === "dark" : prefersDark;
        syncTheme();
    });
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<Fingerprint></Fingerprint>

{#if dev}
    <div
        class="fixed z-50 flex flex-col"
        class:opacity-50={!dragging}
        class:dark:opacity-20={!dragging}
        class:opacity-80={dragging}
        class:dark:opacity-40={dragging}
        style="right: {buttonRight}px; top: {buttonY}px;"
    >
        <button
            type="button"
            class="rounded-t-full border border-neutral-300 bg-neutral-50 px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800 select-none"
            aria-pressed={isDarkMode}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            onclick={toggleDarkMode}
        >
            {isDarkMode ? "Light mode" : "Dark mode"}
        </button>
        <div
            role="button"
            tabindex="0"
            class="h-4 rounded-b-full border border-t-0 border-neutral-300 bg-neutral-50 shadow-sm transition dark:border-neutral-700 dark:bg-neutral-900 select-none"
            class:cursor-grab={!dragging}
            class:cursor-grabbing={dragging}
            onpointerdown={onHandlePointerDown}
            onpointermove={onHandlePointerMove}
            onpointerup={onHandlePointerUp}
        ></div>
    </div>
{/if}

{@render children()}

<div style="display:none">
    {#each locales as locale (locale)}
        <a href={resolve(localizeHref(page.url.pathname, { locale }) as Path)}>{locale}</a>
    {/each}
</div>
