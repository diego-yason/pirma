import { createAuthClient } from 'better-auth/client';
import { passkeyClient } from '@better-auth/passkey/client';

export const authClient = createAuthClient({
	baseURL: typeof window !== 'undefined' ? window.location.origin : '',
	plugins: [passkeyClient()]
});
