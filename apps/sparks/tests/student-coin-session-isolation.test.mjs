import assert from 'node:assert/strict';
import test from 'node:test';

const stored = new Map(), nodes = new Map();
function element() {
    return { style: {}, classList: { add() {}, remove() {} }, callbacks: {},
        addEventListener(type, callback) { this.callbacks[type] = callback; },
        setAttribute() {}, appendChild() {}, querySelector() { return null; }, querySelectorAll() { return []; },
        remove() { this.removed = true; }, contains() { return false; }
    };
}
globalThis.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
globalThis.sessionStorage = { getItem() { return null; }, setItem() {} };
globalThis.document = { readyState: 'loading', addEventListener() {}, removeEventListener() {},
    createElement: element, getElementById: id => nodes.get('#' + id) || null,
    querySelector: selector => nodes.get(selector) || null, querySelectorAll() { return []; },
    body: { appendChild(node) { if (node.id) nodes.set('#' + node.id, node); } }, head: { appendChild() {} } };
globalThis.window = { addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });

const { StudentProgress } = await import('../js/student/studentProgress.js');
const { StudentGameAccess } = await import('../js/student/studentGameAccessMethods.js');
const { supabaseService } = await import('../js/supabaseService.js');
const { setActiveStudentStorageOwner } = await import('../js/student/persistence/studentStorage.js');

test.beforeEach(() => { stored.clear(); nodes.clear(); setActiveStudentStorageOwner('student-a'); });
function fixture() {
    const effects = [];
    const sm = { authDisabled: false, currentUser: { uid: 'student-a' },
        coinData: { balance: 50, giftCoins: 7 }, coinHistory: [], progressData: { totalXp: 0, units: {} }, studentProfile: {},
        updateCoinDisplay: () => effects.push('display'), setAuthStatus: value => effects.push(value), showToast: value => effects.push(value) };
    sm.progress = new StudentProgress(sm);
    return { sm, progress: sm.progress, effects };
}
function deferred() {
    let resolve, reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
}
const wallet = { totalXp: 77, coinData: { balance: 123, giftCoins: 0 } };
const replacements = {
    account: ({ sm }) => { sm.currentUser = { uid: 'student-b' }; setActiveStudentStorageOwner('student-b'); },
    generation: ({ progress }) => progress.cloud.stopCoinSync(),
    progress: ({ sm }) => { sm.progress = new StudentProgress(sm); },
    cloud: ({ progress }) => { progress.cloud = { cloudGeneration: progress.cloud.cloudGeneration }; },
    authMode: ({ sm }) => { sm.authDisabled = true; },
    storageOwner: () => setActiveStudentStorageOwner('student-b')
};

test('pending gift/spend success and failure cannot affect replaced account sessions or storage', async t => {
    for (const [name, replace] of Object.entries(replacements)) {
        for (const method of ['acceptGiftCoins', 'deductCoins']) {
            for (const fails of [false, true]) {
                const current = fixture();
                setActiveStudentStorageOwner('student-a');
                const request = deferred();
                t.mock.method(supabaseService, method === 'acceptGiftCoins' ? 'acceptStudentGiftCoins' : 'spendStudentCoins', () => request.promise);
                const pending = current.progress[method](10);
                replace(current);
                current.sm.coinData = { balance: 5, giftCoins: 2 };
                current.sm.progressData = { totalXp: 0, units: {} };
                current.effects.length = 0;
                stored.clear();
                if (fails) request.reject(new Error('Old request failed')); else request.resolve(wallet);
                await pending;
                assert.equal(current.sm.coinData.balance, 5, `${name}/${method}/${fails}`);
                assert.equal(current.sm.progressData.totalXp, 0);
                assert.deepEqual(current.effects, []);
                assert.equal(stored.size, 0, 'Old wallet is never persisted under the active owner');
            }
        }
    }
});

test('detached progress and foreign storage ownership cannot dispatch coin mutations', async t => {
    for (const invalidate of [current => { current.sm.progress = new StudentProgress(current.sm); }, () => setActiveStudentStorageOwner('student-b')]) {
        setActiveStudentStorageOwner('student-a');
        const current = fixture();
        let calls = 0;
        t.mock.method(supabaseService, 'acceptStudentGiftCoins', async () => { calls++; return wallet; });
        t.mock.method(supabaseService, 'spendStudentCoins', async () => { calls++; return wallet; });
        invalidate(current);
        await current.progress.acceptGiftCoins();
        assert.equal(await current.progress.deductCoins(1), false);
        assert.equal(calls, 0);
    }
});

test('same progress instance cannot dispatch from a gift panel rendered in an old account or generation', async t => {
    for (const replacement of [replacements.account, replacements.generation]) {
        setActiveStudentStorageOwner('student-a');
        const current = fixture();
        nodes.clear();
        const accept = element(); nodes.set('#accept-gift-coins', accept); nodes.set('#close-notification-panel', element());
        let calls = 0;
        t.mock.method(supabaseService, 'acceptStudentGiftCoins', async () => { calls++; return wallet; });
        current.progress.notifications.showNotificationPanel();
        const panel = nodes.get('#coin-notification-panel');
        replacement(current);
        await accept.callbacks.click();
        assert.equal(calls, 0);
        assert.equal(panel.removed, true);
        assert.equal(current.sm.progress, current.progress, 'Authentication reuses the original progress object');
    }
});

test('current gift/spend and demo coin operations retain their successful behavior', async t => {
    const current = fixture();
    t.mock.method(supabaseService, 'acceptStudentGiftCoins', async () => wallet);
    t.mock.method(supabaseService, 'spendStudentCoins', async () => ({ ...wallet, coinData: { balance: 113, giftCoins: 0 } }));
    await current.progress.acceptGiftCoins();
    assert.equal(current.sm.coinData.balance, 123);
    assert.ok(current.effects.includes('You received 7 coins!'));
    assert.equal(await current.progress.deductCoins(10), true);
    assert.equal(current.sm.coinData.balance, 113);
    assert.equal(JSON.parse(stored.get('student:v2:student-a:progress')).coins, 113);
    current.sm.authDisabled = true; current.sm.currentUser = null; setActiveStudentStorageOwner('local-dev');
    assert.equal(await current.progress.deductCoins(3), true);
    assert.equal(current.sm.coinData.balance, 110);
    await current.progress.acceptGiftCoins();
    assert.equal(current.sm.coinData.balance, 110);
});

test('real coin service cannot dispatch across account/generation changes while initialization awaits', async t => {
    const originalClient = supabaseService.client;
    t.after(() => { supabaseService.client = originalClient; });
    for (const method of ['acceptGiftCoins', 'deductCoins', 'arcade']) {
        for (const replace of [replacements.account, replacements.generation]) {
            setActiveStudentStorageOwner('student-a');
            const current = fixture();
            const initialized = deferred();
            let calls = 0;
            t.mock.method(supabaseService, 'init', () => initialized.promise);
            supabaseService.client = { rpc() { calls++; return Promise.resolve({ data: wallet, error: null }); } };
            const pending = method === 'arcade'
                ? new StudentGameAccess({ sm: current.sm, sessionOwnerId: 'student-a', destroyed: false }).startMinute('snake')
                : current.progress[method](10);
            replace(current);
            initialized.resolve();
            await pending;
            assert.equal(calls, 0, 'The real service rechecks the coin session before RPC dispatch');
            assert.deepEqual(current.effects, []);
        }
    }
});

test('real coin service forwards cancellation without adding client predicates to RPC payloads', async t => {
    const { installSupabaseStudentWriteMethods } = await import('../js/supabaseStudentWriteMethods.js');
    const calls = [];
    const service = { init: async () => {}, client: { rpc(name, args) {
        const call = { name, args }; calls.push(call);
        return { abortSignal(signal) { call.signal = signal; return this; }, then(resolve) { return Promise.resolve({ data: wallet, error: null }).then(resolve); } };
    } } };
    installSupabaseStudentWriteMethods(service);
    const controller = new AbortController();
    for (const method of ['acceptStudentGiftCoins', 'spendStudentCoins']) {
        assert.deepEqual(await service[method]({ clientId: 'client-a', amount: 10 }, { isCurrent: () => true, signal: controller.signal }), wallet);
    }
    assert.equal(calls.length, 2);
    for (const call of calls) {
        assert.equal(call.signal, controller.signal);
        assert.equal('isCurrent' in call.args, false);
        assert.equal('signal' in call.args, false);
    }
    controller.abort();
    await assert.rejects(service.acceptStudentGiftCoins({}, { signal: controller.signal }), error => error.name === 'AbortError');
    assert.equal(calls.length, 2);
});


test('a reused progress instance can claim gifts for its new current account', async t => {
    const current = fixture();
    current.progress.cloud.stopCoinSync();
    current.sm.currentUser = { uid: 'student-b' };
    setActiveStudentStorageOwner('student-b');
    t.mock.method(supabaseService, 'acceptStudentGiftCoins', async () => wallet);
    await current.progress.acceptGiftCoins();
    assert.equal(current.sm.coinData.balance, 123);
    assert.equal(JSON.parse(stored.get('student:v2:student-b:progress')).coins, 123);
});
