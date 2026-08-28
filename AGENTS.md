## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: prettier, vitest, eslint, playwright, tailwindcss, sveltekit-adapter, drizzle, better-auth, mcp, paraglide, storybook

---

## Docs (read first)

- `docs/ai/directory.md` — index of all AI/design docs (start here to find any doc)
- `docs/ai/core-objectives.md` — platform objectives (O1–O8) and the primary objective
- `docs/ai/roadmap.md` — living plan & feature status (P0–P3 matrix, §1–§8)
- `docs/ai/blockers/` — what's currently blocking each objective (with unblock paths)

Ground work in the platform's goals and current state before changing code.

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

---

## Database workflow (Drizzle)

- Authoritative schema lives in `src/lib/server/db/schema.ts`; `drizzle/schema.ts` + `drizzle/meta/*` are generated.
- **Apply schema changes to the dev DB with `npm run db:push -- --force`** — the `-- --force` skips drizzle-kit's interactive prompt in non-TTY shells. The DB is reachable in this env; **`db:migrate` fails here, so use `db:push`**.
- Generate versioned migration files with `npm run db:generate` (writes `drizzle/000X_*.sql`). Keep them and `drizzle/meta/_journal.json` consistent — don't hand-edit generated files, regenerate instead.
- `npm run db:studio` opens Drizzle Studio for inspection.

## TypeScript imports — `.d.ts` files

- `.d.ts` type modules imported through the `#lib` **subpath** must include the explicit `.d.ts` extension:
  - ✅ `import type { PlacedRect } from "#lib/client/types/SignatureBoxTypes.d.ts";`
  - ❌ `import type { PlacedRect } from "#lib/client/types/SignatureBoxTypes";` — fails to resolve in TS / svelte-check / LSP (`Cannot find module '#lib/client/types/SignatureBoxTypes'`).
- **Relative** imports of the same `.d.ts` resolve fine WITHOUT the suffix (e.g. `PDFViewer.svelte` uses `../types/SignatureBoxTypes`).
- These are `import type` only — fully erased at build, so there's no runtime impact; this is purely a resolution requirement.
