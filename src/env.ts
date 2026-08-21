import { defineEnvVars } from "@sveltejs/kit/env";

// @migration-task Review usage of dynamic environment variables. They fall back to the empty string if not present, which may not be what you want.

/** Accepts a missing/undefined value (optional env var) and passes it through unchanged. */
const optional = (value: string | undefined): string | undefined => value;

export const variables = defineEnvVars({
    PUBLIC_MAX_RECIPIENTS: { public: true, static: true },
    ORIGIN: { static: true },
    SUPABASE_SECRET_KEY: { static: true },
    PUBLIC_SUPABASE_URL: { public: true, static: true },
    DATABASE_URL: { static: true },
    BETTER_AUTH_SECRET: { static: true },
    KEY_ALLOWED_ALGORITHMS: { static: true },
    KEY_MAX_AGE_DAYS: { static: true },
    KEY_MAX_IDLE_DAYS: { static: true },
    KEY_MAX_SIGNATURES: { static: true },
    OPAQUE_SERVER_KEY: { static: true },
    EMAIL_PROVIDER: { static: true },
    EMAIL_FROM: { static: true },
    RESEND_API_KEY: { static: true },
    SMTP_HOST: { static: true, schema: optional },
    SMTP_PORT: { static: true, schema: optional },
    SMTP_USER: { static: true, schema: optional },
    SMTP_PASS: { static: true, schema: optional },
    SMTP_SECURE: { static: true, schema: optional },
    SMTP_IGNORE_TLS: { static: true, schema: optional },
    EMAIL_REMIND_DAYS: { static: true },
    CRON_SECRET: { static: true },
});
