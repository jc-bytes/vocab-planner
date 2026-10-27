// Credentials stay in this module. Forms receive only an abortable intent.
const clients = new WeakMap(), intents = new WeakMap();
const changed = () => new DOMException('The account changed. Open the password form again.', 'AbortError');

export function invalidatePasswordChangeIntents(client) {
    const state = clients.get(client);
    if (!state) return;
    state.generation++;
    state.pending = null;
    for (const controller of state.controllers) controller.abort(changed());
    state.controllers.clear();
}

export function trackPasswordSessions(client) {
    if (clients.has(client)) return clients.get(client);
    const state = { session: null, generation: 0, controllers: new Set(), pending: null, observed: false };
    clients.set(client, state);
    client.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION' && state.observed) return;
        state.observed = true;
        if (event === 'SIGNED_OUT' || state.session?.user?.id !== session?.user?.id
            || ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY')
                && state.session?.access_token !== session?.access_token)) {
            invalidatePasswordChangeIntents(client);
        }
        state.session = session;
        if (event === 'PASSWORD_RECOVERY' && session) {
            state.pending?.dispose();
            state.pending = capturePasswordChangeIntent(client);
        }
    });
    return state;
}

export function capturePasswordChangeIntent(client, { session, isCurrent = () => true } = {}) {
    const state = trackPasswordSessions(client);
    const source = session || state.session;
    if (!source?.user?.id || !source.access_token || !source.refresh_token) throw changed();
    if (!state.session) state.session = source;
    const generation = state.generation, controller = new AbortController();
    const snapshot = { userId: source.user.id, accessToken: source.access_token,
        refreshToken: source.refresh_token, expiresAt: source.expires_at };
    state.controllers.add(controller);
    const intent = Object.freeze({
        signal: controller.signal,
        isCurrent: () => !controller.signal.aborted && generation === state.generation
            && state.session?.user?.id === snapshot.userId && isCurrent(),
        dispose() { state.controllers.delete(controller); controller.abort(changed()); }
    });
    intents.set(intent, { snapshot, state });
    return intent;
}

export function readPasswordChangeIntent(intent) {
    const stored = intents.get(intent);
    if (!stored || !intent.isCurrent()) throw changed();
    // A refresh within this same incarnation may renew a long-open form. The
    // operation copies these credentials once, before creating its own client.
    const session = stored.state.session;
    return { userId: stored.snapshot.userId, accessToken: session.access_token,
        refreshToken: session.refresh_token, expiresAt: session.expires_at };
}

export function takePasswordRecoveryIntent(client) {
    const state = trackPasswordSessions(client), intent = state.pending;
    state.pending = null;
    if (intent?.isCurrent()) return intent;
    intent?.dispose();
    return null;
}
