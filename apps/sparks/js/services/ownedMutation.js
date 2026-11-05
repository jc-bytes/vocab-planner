import { requestWithTimeout } from './requestReliability.js';
import { readAuthSessionId } from './supabaseValues.js';

export function serviceMutationIdentity(service) {
    return { userId: service.currentUser?.uid || service.currentUser?.id || null,
        generation: service.authIdentityGeneration || 0, session: service.currentSession };
}

// Capture the caller before initialization/imports. Public repositories provide a
// synchronous identity getter. Custom clients may supply ownerUserId or a getter;
// without either, their first resolved session defines their initiating account.
// Authorization belongs to this query only, never shared client headers. A request
// already sent may commit as its original actor after a UI/account replacement.
export function runOwnedMutation(getClient, build, { getIdentity, context, ...options } = {}) {
    const identity = getIdentity?.();
    const owner = String(options.ownerUserId || identity?.userId || '').trim();
    const generation = identity?.generation;
    const sessionId = readAuthSessionId(identity?.session);
    const schoolGeneration = context?.getGeneration();
    const changed = () => new DOMException('The account or school changed. Start this action again.', 'AbortError');
    function assertCurrent(signal) {
        signal?.throwIfAborted();
        const current = getIdentity?.();
        if ((getIdentity && (!owner || current?.userId !== owner || current?.generation !== generation
                || sessionId && readAuthSessionId(current?.session) !== sessionId))
            || (context && context.getGeneration() !== schoolGeneration)
            || (options.isCurrent && !options.isCurrent())) throw changed();
    }
    return requestWithTimeout(async signal => {
        assertCurrent(signal);
        const client = await getClient();
        assertCurrent(signal);
        const { data, error } = await client.auth.getSession();
        assertCurrent(signal);
        if (error) throw error;
        const session = data?.session;
        if (!session?.access_token || !session.user?.id || owner && session.user.id !== owner
            || sessionId && readAuthSessionId(session) !== sessionId) throw changed();
        let query = build(client).setHeader('Authorization', `Bearer ${session.access_token}`);
        if (typeof query.abortSignal === 'function') query = query.abortSignal(signal);
        assertCurrent(signal);
        const response = await query;
        assertCurrent(signal);
        if (response.error) {
            if (response.status && !response.error.status) response.error.status = response.status;
            throw response.error;
        }
        return response.data;
    }, { signal: options.signal, timeoutMs: options.timeoutMs || 30000, label: options.label || 'Saving changes' }).catch(error => {
        if (error.code === 'REQUEST_ABORTED') error.name = 'AbortError';
        throw error;
    });
}
