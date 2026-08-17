import { createAuthClient } from "better-auth/client";
import { passkeyClient } from "@better-auth/passkey/client";
import { anonymousClient } from "better-auth/client/plugins";
import { opaqueClient } from "$plugins/better-auth-opaque/src/client";

export const authClient = createAuthClient({
    baseURL: typeof window !== "undefined" ? window.location.origin : "",
    plugins: [passkeyClient(), anonymousClient(), opaqueClient()],
});
