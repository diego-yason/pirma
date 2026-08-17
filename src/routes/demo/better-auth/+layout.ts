import type { LayoutLoad } from "./$types";
import { dev } from "$app/env";
import { redirect } from "@sveltejs/kit";

/**
 * Dev-only gate for the Better Auth demo routes.
 * These pages exercise the real auth API (sign-in/sign-up actions) and must
 * never be reachable in a production build.
 */
export const load: LayoutLoad = async () => {
    if (!dev) return redirect(307, "/");
};
