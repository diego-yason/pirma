import type { BetterAuthPlugin } from "better-auth";
// import { createAuthMiddleware } from "better-auth/api";

import { getRandomValues, subtle } from "node:crypto";

export const zeroKnowledge = () =>
    ({
        id: "zero-knowledge",
        init: (ctx) => {
            return {
                context: {
                    generateKeyAndPair: async function () {
                        // 256 bit array
                        const key = getRandomValues(new Uint8Array(32));
                        getRandomValues(key);

                        const pair = subtle.generateKey("Ed25519", true, []);


                    },
                },
            };
        },
        schema: {
            
            user: {
                fields: {
                    pServer: {
                        type: "string",
                        required: true,
                        unique: false,
                    },
                    pubServer: {
                        type: "string",
                        required: true,
                        unique: false,
                    },
                    pUser: {
                        type: "string",
                        required: true,
                        unique: false,
                    },
                    envUser: {
                        type: "string",
                        required: true,
                        unique: false,
                    },
                    oprfKey: {
                        type: "string",
                        required: true,
                        unique: false,
                    },
                },
            },
        },
    }) satisfies BetterAuthPlugin;
