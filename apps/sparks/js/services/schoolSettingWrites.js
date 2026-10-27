import { requestWithTimeout } from './requestReliability.js';
import { readAuthSessionId } from './supabaseValues.js';

// These two admin mutations share one captured-actor transport, kept off reads.
export async function ownedSchoolSettingWrite(getClient, name, args, options = {}) {
    const ownerUserId = String(options.ownerUserId || '').trim();
    const capturedSession = options.session || options.getSession?.();
    let sessionId = readAuthSessionId(capturedSession);
    const changed = () => new DOMException('The account or settings form changed. Open it again.', 'AbortError');
    const controller = new AbortController();
    const cancel = () => controller.abort(options.signal?.reason || changed());
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) cancel();
    let unsubscribe;
    const assertCurrent = signal => {
        signal.throwIfAborted();
        const currentSession = options.getSession?.();
        if (!ownerUserId || (capturedSession?.user?.id && capturedSession.user.id !== ownerUserId)
            || (currentSession?.user?.id && currentSession.user.id !== ownerUserId)
            || (options.isCurrent && !options.isCurrent())
            || (sessionId && options.getSession && readAuthSessionId(options.getSession()) !== sessionId)) throw changed();
    };
    try {
        return await requestWithTimeout(async signal => {
            assertCurrent(signal);
            const client = await getClient();
            assertCurrent(signal);
            let observedEvent = false;
            const listener = client.auth?.onAuthStateChange?.((event, session) => {
                const nextId = readAuthSessionId(session);
                if (event === 'INITIAL_SESSION') {
                    if (!observedEvent && session?.user?.id && session.user.id !== ownerUserId) cancel();
                    if (!observedEvent && !sessionId) sessionId = nextId;
                    return;
                }
                observedEvent = true;
                if (event === 'SIGNED_OUT' || session?.user?.id !== ownerUserId
                    || (sessionId && nextId && sessionId !== nextId)) cancel();
                if (!sessionId) sessionId = nextId;
            });
            unsubscribe = () => listener?.data?.subscription?.unsubscribe();
            let query = client.rpc(name, { ...args, p_expected_user_id: ownerUserId });
            if (typeof query.abortSignal === 'function') query = query.abortSignal(signal);
            const { data, error, status } = await query;
            assertCurrent(signal);
            if (error) {
                if (status && !error.status) error.status = status;
                throw error;
            }
            return data;
        }, { signal: controller.signal, timeoutMs: options.timeoutMs || 30000, label: 'Saving school settings' });
    } finally {
        unsubscribe?.();
        options.signal?.removeEventListener('abort', cancel);
    }
}
