import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SECRET_KEY } from "$app/env/private";
import { PUBLIC_SUPABASE_URL } from "$app/env/public";

if (!SUPABASE_SECRET_KEY) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
}

export const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
