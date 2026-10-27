import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig } from './supabaseClient.js';
import { readPasswordChangeIntent } from './passwordChangeIntent.js';

// An isolated memory-only Auth client cannot read or replace the next account's
// browser session. Do not sign it out: that could revoke the original session.
export async function updatePasswordForIntent(intent, password, {
    signal, clearFlag = false, config = resolveSupabaseConfig(), fetch: transport = globalThis.fetch,
    createClient: makeClient = createClient
} = {}) {
    const snapshot = readPasswordChangeIntent(intent);
    const assertCurrent = () => {
        signal?.throwIfAborted();
        readPasswordChangeIntent(intent);
        if (snapshot.expiresAt && snapshot.expiresAt * 1000 <= Date.now() + 1000) {
            throw new Error('Your password session expired. Sign in or request a new recovery link.');
        }
    };
    assertCurrent();
    const client = makeClient(config.url, config.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
            storageKey: `sparks-password-${crypto.randomUUID()}` },
        global: { fetch: (url, init) => {
            assertCurrent();
            // setSession can refresh an expired token. Never rotate the shared
            // session's refresh token from this short-lived client.
            if (new URL(url).pathname.endsWith('/token')) {
                throw new Error('Your password session expired. Sign in or request a new recovery link.');
            }
            return transport(url, { ...init, signal });
        } }
    });
    try {
        const verified = await client.auth.getUser(snapshot.accessToken);
        if (verified.error) throw verified.error;
        if (verified.data.user?.id !== snapshot.userId) throw new Error('The password session does not match this account.');
        assertCurrent();
        const session = await client.auth.setSession({ access_token: snapshot.accessToken, refresh_token: snapshot.refreshToken });
        if (session.error) throw session.error;
        if (session.data.user?.id !== snapshot.userId) throw new Error('The password session does not match this account.');
        assertCurrent();
        const updated = await client.auth.updateUser({ password });
        if (updated.error) throw updated.error;
        assertCurrent();
        if (clearFlag) {
            const result = await client.from('profiles').update({ must_change_password: false })
                .eq('user_id', snapshot.userId).select('user_id').single().abortSignal(signal);
            if (result.error) throw result.error;
            assertCurrent();
        }
    } finally { await client.auth.dispose(); }
}
