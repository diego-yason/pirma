import type { LayoutLoad } from "./$types";

import { dev } from "$app/env";
import { redirect } from "@sveltejs/kit";

export const load: LayoutLoad = async () => {
    if (!dev) return redirect(307, "/");
};
