import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ locals }) => {
    // If user is already logged in, redirect to home
    if (locals.user) {
        redirect(302, "/");
    }

    return {};
};

export const actions = {
    
}