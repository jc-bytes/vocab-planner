function retryableAccessError(error) {
    const status = Number(error?.status || error?.statusCode);
    if (status) return [408, 425, 429].includes(status) || status >= 500;
    return !/^(22|23|28|42|PGRST30|REQUEST_ABORTED)/.test(String(error?.code || ''));
}

// Loaded only after a startup failure. The auth owners retain the session;
// this module owns retry UI and its short-lived event/timer subscriptions.
export function createStartupRecovery({ root, retry, signOut, isCurrent,
    window: win = window, document: doc = document, navigator: nav = navigator }) {
    let disposed = false, running = false, attempts = 0, timer, retryable = false;
    const original = root ? [...root.childNodes] : [];
    const card = doc.createElement('div');
    card.className = 'card';
    card.dataset.startupRecovery = '';
    const title = doc.createElement('h2');
    title.textContent = 'School access could not load';
    const status = doc.createElement('p');
    status.setAttribute('role', 'status');
    const button = doc.createElement('button');
    button.type = 'button'; button.className = 'btn primary-btn'; button.textContent = 'Try again';
    const exit = doc.createElement('button');
    exit.type = 'button'; exit.className = 'btn secondary-btn'; exit.textContent = 'Sign out';
    card.append(title, status, button, exit);
    root?.replaceChildren(card);
    const current = () => !disposed && isCurrent();
    const cancelTimer = () => { win.clearTimeout(timer); timer = undefined; };
    const run = async () => {
        if (!current() || running || nav.onLine === false || doc.visibilityState === 'hidden') return;
        cancelTimer(); running = true; button.disabled = true;
        status.textContent = 'Checking your school access...';
        try { await retry(); }
        finally { running = false; if (current()) button.disabled = false; }
    };
    const reconnect = () => { if (retryable && doc.visibilityState !== 'hidden') void run(); };
    button.addEventListener('click', () => { void run(); });
    exit.addEventListener('click', () => { if (current()) void signOut(); });
    win.addEventListener('online', reconnect);
    win.addEventListener('focus', reconnect);
    return {
        failed(error) {
            if (!current()) return;
            retryable = retryableAccessError(error);
            status.textContent = retryable
                ? 'You are still signed in. We could not load your school access. Check your connection and try again.'
                : 'You are still signed in, but school access could not be verified. Try again or ask your school administrator.';
            cancelTimer();
            if (retryable && nav.onLine !== false && attempts < 2) {
                timer = win.setTimeout(() => { void run(); }, ++attempts === 1 ? 1000 : 3000);
            }
        },
        dispose() {
            disposed = true; cancelTimer();
            win.removeEventListener('online', reconnect);
            win.removeEventListener('focus', reconnect);
            if (root?.contains(card)) root.replaceChildren(...original);
        }
    };
}

export function showStudentStartupRecovery(auth, user, context, error, signOut) {
    if (!context.isCurrent()) return;
    auth.sm.authInitialized = false;
    auth.setAuthStatus('School access failed - try again');
    auth.sm.switchView('loading-view');
    auth.startupRecovery ||= createStartupRecovery({
        root: document.getElementById('loading-view'),
        isCurrent: () => auth.sm.currentUser?.uid === user.uid,
        retry: () => auth.handleBackendSignIn(user),
        signOut
    });
    auth.startupRecovery.failed(error);
}


export function showTeacherStartupRecovery(manager, user, context, error) {
    if (!context.isCurrent()) return;
    manager.updateAuthUI(user);
    manager.setCloudStatus('School access needs retry', 'error');
    manager.switchView('teacher-loading-view', { updateRoute: false });
    manager.startupRecovery ||= createStartupRecovery({
        root: document.getElementById('teacher-loading-view'),
        isCurrent: () => manager.currentUser?.uid === user.uid,
        retry: () => manager.handleAuthWithRole(user),
        signOut: () => manager.teacherAuthApi.signOut()
    });
    manager.startupRecovery.failed(error);
}
