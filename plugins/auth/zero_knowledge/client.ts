import { BetterAuthClientPlugin } from "better-auth/client";
import { zeroKnowledgePlugin } from "./index";

type ZeroKnowledgePlugin = typeof zeroKnowledgePlugin;

export const zeroKnowledgeClientPlugin = () => {
    return {
        id: "zero-knowledge",
        $InferServerPlugin: {} as ReturnType<ZeroKnowledgePlugin>,
    } satisfies BetterAuthClientPlugin;
};
