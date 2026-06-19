<script lang="ts">
    import type { Pathname } from "$app/types";
    import { resolve } from "$app/paths";
    import { page } from "$app/state";
    import { locales, localizeHref } from "$lib/paraglide/runtime";
    import { onMount } from "svelte";
    import "./layout.css";
    import favicon from "$lib/assets/favicon.svg";
    import { dev } from "$app/env";

    let { children } = $props();

    let isDarkMode = $state(false);

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

    onMount(() => {
        const storedTheme = localStorage.getItem("theme");
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

        isDarkMode = storedTheme ? storedTheme === "dark" : prefersDark;
        syncTheme();
    });
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if dev}
    <button
        type="button"
        class="fixed right-4 top-4 z-50 rounded-full border border-neutral-300 bg-neutral-50 px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        aria-pressed={isDarkMode}
        aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        onclick={toggleDarkMode}
    >
        {isDarkMode ? "Light mode" : "Dark mode"}
    </button>
{/if}

{@render children()}

<div style="display:none">
    {#each locales as locale (locale)}
        <a href={resolve(localizeHref(page.url.pathname, { locale }) as Pathname)}>{locale}</a>
    {/each}
</div>
