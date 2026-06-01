<script>
    import { resolve } from "$app/paths";
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<a href={resolve("/register")}>Register</a>
<a href={resolve("/login")}>Login</a>

<a href={resolve("/doc/new")}>Create Document</a>
