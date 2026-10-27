import assert from 'node:assert/strict';
import test from 'node:test';
import { login } from '../scripts/lib/browser-login.mjs';

function fixture({ initial = 'loading', bootstrap = 'form' } = {}) {
    let state = initial;
    let submissions = 0;
    const listeners = new Map();
    const form = { selector: '#form', email: '#email', password: '#password' };
    const element = kind => ({ textContent: state === 'error' && kind === 'error' ? 'Sign-in failed.' : '',
        getClientRects: () => state === kind ? [{ width: 100, height: 40 }] : [],
        checkVisibility: () => state === kind });
    const doc = { querySelector(selector) {
        const kind = { '#form': 'form', '#ready': 'ready', '#error': 'error' }[selector];
        return kind && (kind !== 'ready' || state === 'ready') ? element(kind) : null;
    } };
    const evaluate = (fn, arg) => {
        const previous = globalThis.document;
        const previousStyle = globalThis.getComputedStyle;
        globalThis.document = doc;
        globalThis.getComputedStyle = () => ({ visibility: 'visible' });
        try { return fn(arg); } finally { globalThis.document = previous; globalThis.getComputedStyle = previousStyle; }
    };
    const page = {
        on(event, handler) { listeners.set(event, handler); },
        off(event) { listeners.delete(event); }, url: () => 'http://localhost/teacher.html',
        async goto() {
            listeners.get('response')?.({ status: () => 503,
                url: () => 'http://localhost/rest/v1/rpc/my_school_access_v1?secret=must-not-log' });
            listeners.get('requestfailed')?.({ failure: () => ({ errorText: 'net::ERR_CONNECTION_RESET' }),
                url: () => 'http://localhost/auth/v1/token?secret=must-not-log' });
        },
        locator(selector) { return {
            async isVisible() { return state === ({ '#form': 'form', '#ready': 'ready' }[selector]); },
            async textContent() { return doc.querySelector(selector)?.textContent || ''; },
            async click() { submissions++; state = 'ready'; }
        }; },
        async fill() { assert.equal(state, 'form', 'only fill an available form'); },
        async evaluate(fn, arg) { return evaluate(fn, arg); },
        async waitForFunction(fn, arg) {
            if (state === 'loading') state = bootstrap;
            if (!evaluate(fn, arg)) throw new Error('Readiness timeout');
        }
    };
    return { page, options: { baseUrl: 'http://localhost', pagePath: '/teacher.html', form,
        email: 'fixture@example.invalid', password: 'fixture', ready: '#ready', error: '#error' },
        submissions: () => submissions, listeners };
}

test('login waits for a delayed bootstrap form before deciding whether to submit', async () => {
    const f = fixture();
    await login(f.page, f.options);
    assert.equal(f.submissions(), 1);
    assert.equal(f.listeners.size, 0);
});

test('login preserves an already authenticated session', async () => {
    const f = fixture({ initial: 'ready' });
    await login(f.page, f.options);
    assert.equal(f.submissions(), 0);
});

test('bootstrap timeout reports safe state and network metadata and removes listeners', async () => {
    const f = fixture({ bootstrap: 'stalled' });
    await assert.rejects(login(f.page, f.options), error => {
        assert.match(error.message, /bootstrap/);
        assert.match(error.message, /"ready":false,"form":false,"error":false/);
        assert.match(error.message, /"status":503/);
        assert.match(error.message, /ERR_CONNECTION_RESET/);
        assert.doesNotMatch(error.message, /secret|must-not-log|fixture@example|password/);
        return true;
    });
    assert.equal(f.listeners.size, 0);
});

test('login fails on an explicit sign-in error without submitting', async () => {
    const f = fixture({ bootstrap: 'error' });
    await assert.rejects(login(f.page, f.options), /login failed: Sign-in failed/);
    assert.equal(f.submissions(), 0);
});
