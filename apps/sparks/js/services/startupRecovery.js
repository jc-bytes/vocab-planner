function retryableAccessError(error) {
    const status = Number(error?.status || error?.statusCode);
    if (status) return [408, 425, 429].includes(status) || status >= 500;
    return !/^(22|23|28|42|PGRST30|REQUEST_ABORTED)/.test(String(error?.code || ''));
}

const retryDelays = [1000, 3000, 10000, 30000];

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
    title.textContent = 'Connecting to your school';
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
        catch (error) { failed(error); }
        finally { running = false; if (current()) button.disabled = false; }
    };
    function showFailure() {
        title.textContent = retryable ? 'Connecting to your school' : 'School access needs attention';
        if (retryable && nav.onLine === false) {
            status.textContent = 'You are still signed in. You are offline. We will try again when your connection returns.';
        } else {
            status.textContent = retryable
                ? 'You are still signed in. We could not finish checking your school access. We will keep trying automatically. You can also choose Try again.'
                : 'You are still signed in, but school access could not be verified. Try again or ask your school administrator.';
        }
    }
    function failed(error) {
        if (!current()) return;
        retryable = retryableAccessError(error);
        showFailure(); cancelTimer();
        if (retryable && nav.onLine !== false && doc.visibilityState !== 'hidden') {
            const delay = retryDelays[Math.min(attempts++, retryDelays.length - 1)];
            timer = win.setTimeout(() => { void run(); }, delay);
        }
    }
    const reconnect = () => {
        if (!current() || !retryable) return;
        if (nav.onLine === false || doc.visibilityState === 'hidden') {
            cancelTimer(); showFailure();
        } else void run();
    };
    button.addEventListener('click', () => { void run(); });
    exit.addEventListener('click', () => { if (current()) void signOut(); });
    win.addEventListener('online', reconnect);
    win.addEventListener('offline', reconnect);
    win.addEventListener('focus', reconnect);
    doc.addEventListener('visibilitychange', reconnect);
    return {
        failed,
        dispose() {
            disposed = true; cancelTimer();
            win.removeEventListener('online', reconnect);
            win.removeEventListener('offline', reconnect);
            doc.removeEventListener('visibilitychange', reconnect);
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
