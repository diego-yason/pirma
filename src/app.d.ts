import type { User, Session } from "better-auth/minimal";

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
    namespace App {
        interface Locals {
            user?: User;
            session?: Session;
            /** Set when a guest token is validated for signing. */
            guest?: {
                recipientId: string;
                packageId: string;
                name: string;
                email: string;
            };
        }

        // interface Error {}
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}
    }
}

export {};
