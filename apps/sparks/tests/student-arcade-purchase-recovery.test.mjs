import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.document = { readyState: 'loading', addEventListener() {}, removeEventListener() {},
    getElementById: () => ({}), querySelector: () => null, querySelectorAll: () => [] };
globalThis.window = { addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout };
let values;
let createdGames = [];
const settleClock = async games => { while (games.lifecycle.clockWritePending) await new Promise(resolve => setImmediate(resolve)); };
globalThis.localStorage = { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
const { StudentGames } = await import('../js/student/studentGames.js');
const { readLocalArcadeSession, writeLocalArcadeSession } = await import('../js/student/studentArcadeSessionStorage.js');
const { installSupabaseStudentWriteMethods } = await import('../js/supabaseStudentWriteMethods.js');
const { supabaseService } = await import('../js/supabaseService.js');
const { notifications } = await import('../js/notifications.js');
const { schoolContext } = await import('../js/services/schoolContext.js');

test.beforeEach(t => {
    values = new Map();
    createdGames = [];
    t.after(async () => { for (const games of createdGames) await settleClock(games); });
    t.mock.method(console, 'warn', () => {});
    t.mock.method(console, 'error', () => {});
    t.mock.method(notifications, 'warning', () => {});
});
function gamesFor(owner = 'owner-a', clientId = 'original-client') {
    const sm = { currentUser: { uid: owner }, authDisabled: false, coins: 10,
        activities: { async refreshCurrentSparkGate() {}, getPendingRequiredWork: () => ({ isBlocked: false }),
            vocabularyData: { async loadClassSelection() {}, classSelection: { ready: true, owner, generation: 1, readySchoolGeneration: schoolContext.getGeneration() } } },
        progress: { clientId, cloud: { cloudGeneration: 1, applyRemoteCoinProgress(wallet) { sm.coins = wallet.coins; } } } };
    const games = new StudentGames(sm);
    createdGames.push(games);
    games.loadGlobalSettings = async () => {};
    games.getExchangeRate = () => 10;
    games.updateArcadeUI = async () => {};
    games.lifecycle.launchGame = () => true;
    return games;
}
function installBackend(t, rpc, { recover, timeoutMs = 1000 } = {}) {
    const confirmed = new Map();
    const backend = { async init() {}, client: { async rpc(name, params) {
        if (name === 'recover_student_arcade_minute_owned_v1') {
            return { data: recover ? await recover(params) : confirmed.has(params.p_event_id)
                ? { receiptFound: true, purchase: confirmed.get(params.p_event_id) } : { receiptFound: false } };
        }
        const response = await rpc(name, params);
        if (response?.data?.minuteSeconds === 60) confirmed.set(params.p_event_id, response.data);
        return response;
    } } };
    installSupabaseStudentWriteMethods(backend, { context: { getGeneration: () => 0 } });
    t.mock.method(supabaseService, 'startStudentArcadeMinute', (payload, options) => backend.startStudentArcadeMinute(payload, { ...options, timeoutMs }));
    t.mock.method(supabaseService, 'recoverStudentArcadeMinute', (payload, options) => backend.recoverStudentArcadeMinute(payload, { ...options, timeoutMs }));
    t.mock.method(supabaseService, 'getOwnArcadeTime', async () => ({ availableSeconds: 0 }));
}
const receiptResult = () => ({ minuteSeconds: 60, coinCost: 10, coinWallet: { userId: 'owner-a', coins: 0 }, arcadeTime: { userId: 'owner-a', availableSeconds: 0 } });

test('a committed purchase with a lost response replays its original receipt after reload before zero-balance gates', async t => {
    const calls = [], receipts = new Map();
    let debits = 0;
    installBackend(t, (_name, params) => {
        calls.push(params);
        if (!receipts.has(params.p_event_id)) {
            receipts.set(params.p_event_id, receiptResult()); debits++;
            return new Promise(() => {});
        }
        return Promise.resolve({ data: receipts.get(params.p_event_id) });
    }, { timeoutMs: 5, recover(params) {
        calls.push(params);
        return { receiptFound: true, purchase: receipts.get(params.p_event_id) };
    } });
    const first = gamesFor();
    await assert.rejects(first.access.startMinute('snake'), { code: 'REQUEST_TIMEOUT' });
    const pending = readLocalArcadeSession(first.sessionOwnerId).pendingPurchase;
    assert.equal(pending.eventId, calls[0].p_event_id);
    first.destroy();
    const restored = gamesFor('owner-a', 'different-client-after-reload');
    restored.sm.coins = 0;
    assert.equal(await restored.startGame('snake'), true);
    assert.equal(debits, 1);
    assert.equal(restored.gameTimeRemaining, 60);
    assert.equal(calls[1].p_event_id, calls[0].p_event_id);
    assert.equal(calls[1].p_client_id, 'original-client');
    const session = readLocalArcadeSession(restored.sessionOwnerId);
    assert.equal(session.pendingPurchase, null);
    assert.equal(session.lastAppliedEventId, pending.eventId);
    const again = gamesFor();
    assert.equal(again.gameTimeRemaining, 60);
    restored.destroy(); again.destroy();
});

test('storage failure prevents a new debit before dispatch', async t => {
    let calls = 0;
    installBackend(t, () => { calls++; return Promise.resolve({ data: receiptResult() }); });
    t.mock.method(localStorage, 'setItem', () => { throw new Error('Quota exceeded'); });
    const games = gamesFor();
    await assert.rejects(games.access.startMinute('snake'), { code: 'ARCADE_STORAGE_UNAVAILABLE' });
    assert.equal(calls, 0);
    assert.equal(games.gameTimeRemaining, 0);
});

test('ordinary timer writes preserve a zero-time pending receipt', () => {
    const pendingPurchase = { eventId: 'arcade-minute:test-event', gameId: 'snake', clientId: 'original-client' };
    writeLocalArcadeSession('owner-a', { remainingSeconds: 0, pendingPurchase });
    writeLocalArcadeSession('owner-a', { remainingSeconds: 0, gameId: 'snake' });
    assert.deepEqual(readLocalArcadeSession('owner-a').pendingPurchase, pendingPurchase);
});

test('failure saving the confirmed credit keeps the receipt recoverable without another debit', async t => {
    const receipts = new Map(); let debits = 0, writes = 0;
    installBackend(t, (_name, params) => {
        if (!receipts.has(params.p_event_id)) { debits++; receipts.set(params.p_event_id, receiptResult()); }
        return Promise.resolve({ data: receipts.get(params.p_event_id) });
    });
    const originalWrite = localStorage.setItem;
    t.mock.method(localStorage, 'setItem', (key, value) => {
        if (++writes === 2) throw new Error('Quota while crediting');
        originalWrite(key, value);
    });
    const first = gamesFor();
    await assert.rejects(first.access.startMinute('snake'), { code: 'ARCADE_STORAGE_UNAVAILABLE' });
    assert.ok(readLocalArcadeSession('owner-a').pendingPurchase);
    assert.equal(first.gameTimeRemaining, 0);
    const next = gamesFor();
    await next.loadArcadeTime({ force: true });
    assert.equal(next.gameTimeRemaining, 60);
    assert.equal(debits, 1);
    next.gameTimeRemaining = 0; next.updateGameTimer();
    const saved = readLocalArcadeSession('owner-a');
    assert.ok(saved.lastAppliedEventId);
    assert.equal(saved.pendingPurchase, null);
});

test('concurrent purchase callers share one receipt and credit only once', async t => {
    let calls = 0, release;
    installBackend(t, () => { calls++; return new Promise(resolve => { release = resolve; }); });
    const games = gamesFor();
    const first = games.access.startMinute('snake');
    const second = games.access.startMinute('snake');
    while (!release) await Promise.resolve();
    release({ data: receiptResult() });
    const results = await Promise.all([first, second]);
    assert.equal(calls, 1);
    assert.ok(results.every(result => result.localCreditApplied));
    assert.equal(games.gameTimeRemaining, 60);
});

test('an account switch cannot credit or replay the old owner receipt into the replacement account', async t => {
    let release;
    t.mock.method(supabaseService, 'startStudentArcadeMinute', () => new Promise(resolve => { release = resolve; }));
    const old = gamesFor();
    const pending = old.access.startMinute('snake');
    while (!release) await new Promise(resolve => setImmediate(resolve));
    old.sm.currentUser = { uid: 'owner-b' };
    release(receiptResult());
    assert.equal(await pending, null);
    assert.equal(old.gameTimeRemaining, 0);
    assert.ok(readLocalArcadeSession('owner-a').pendingPurchase);
    const replacement = gamesFor('owner-b');
    assert.equal(replacement.access.purchases.hasPending(), false);
    assert.equal(replacement.gameTimeRemaining, 0);
    assert.equal(readLocalArcadeSession('owner-b').lastAppliedEventId, '');
});

test('Stop during an actual purchase keeps its paid minute for resume and releases the start lock', async t => {
    let calls = 0, release;
    installBackend(t, () => { calls++; return new Promise(resolve => { release = resolve; }); });
    t.mock.method(supabaseService, 'getOwnArcadeTime', async () => ({ availableSeconds: 60 }));
    const games = gamesFor();
    const pending = games.startGame('snake');
    while (!release) await Promise.resolve();
    assert.equal(await games.requestAdditionalTime(), false);
    games.stopCurrentGame();
    release({ data: receiptResult() });
    assert.equal(await pending, false);
    assert.equal(games.isStartingGame, false);
    assert.equal(games.gameTimeRemaining, 60);
    assert.equal(readLocalArcadeSession('owner-a').remainingSeconds, 60);
    assert.equal(await games.startGame('pong'), true);
    assert.equal(calls, 1);
    assert.equal(games.gameTimeRemaining, 60);
});

test('old-release timer writes cannot overwrite the migrated receipt or resurrect drained time', () => {
    const legacy = 'student_arcade_session_v1:owner-a';
    values.set(legacy, JSON.stringify({ remainingSeconds: 120, gameId: 'snake' }));
    assert.equal(readLocalArcadeSession('owner-a').remainingSeconds, 120);
    const pendingPurchase = { eventId: 'arcade-minute:migrated-receipt', gameId: 'snake', clientId: 'original-client' };
    writeLocalArcadeSession('owner-a', { pendingPurchase });
    values.set(legacy, JSON.stringify({ remainingSeconds: 600, gameId: 'pong' }));
    assert.deepEqual(readLocalArcadeSession('owner-a').pendingPurchase, pendingPurchase);
    assert.equal(readLocalArcadeSession('owner-a').remainingSeconds, 120);
    writeLocalArcadeSession('owner-a', { remainingSeconds: 0, pendingPurchase: null });
    assert.ok(values.has('student_arcade_session_v2:owner-a'));
    assert.equal(readLocalArcadeSession('owner-a').remainingSeconds, 0);
});

for (const malformed of ['{broken-json', JSON.stringify({ remainingSeconds: 0, pendingPurchase: { eventId: 'short' } })]) {
    test('malformed v2 purchase data blocks debits and survives ordinary timer writes', async t => {
        let calls = 0;
        installBackend(t, () => { calls++; return Promise.resolve({ data: receiptResult() }); });
        values.set('student_arcade_session_v2:owner-a', malformed);
        const games = gamesFor();
        games.updateGameTimer();
        assert.equal(values.get('student_arcade_session_v2:owner-a'), malformed);
        await assert.rejects(games.access.startMinute('snake'), { code: 'ARCADE_STORAGE_UNAVAILABLE' });
        assert.equal(calls, 0);
        assert.equal(values.get('student_arcade_session_v2:owner-a'), malformed);
    });
}

test('lock acquisition has a deadline and a late lock callback cannot dispatch a debit', async t => {
    let lateCallback, lockSignal, calls = 0;
    const nav = globalThis.navigator;
    const previous = Object.getOwnPropertyDescriptor(nav, 'locks');
    Object.defineProperty(nav, 'locks', { configurable: true, value: {
        request(_name, options, callback) { lockSignal = options.signal; lateCallback = callback; return new Promise(() => {}); }
    } });
    t.after(() => { if (previous) Object.defineProperty(nav, 'locks', previous); else delete nav.locks; });
    installBackend(t, () => { calls++; return Promise.resolve({ data: receiptResult() }); });
    const games = gamesFor();
    games.access.purchases.timeoutMs = 5;
    await assert.rejects(games.access.startMinute('snake'), { code: 'REQUEST_TIMEOUT' });
    assert.equal(lockSignal.aborted, true);
    assert.equal(games.access.purchases.inFlight, null);
    assert.throws(lateCallback, { code: 'REQUEST_TIMEOUT' });
    assert.equal(calls, 0);
    assert.equal(readLocalArcadeSession('owner-a').pendingPurchase, null);
});

test('a stale same-release tab clock adopts a newly paid receipt instead of erasing its minute', async t => {
    let calls = 0;
    installBackend(t, () => { calls++; return Promise.resolve({ data: receiptResult() }); });
    const staleTab = gamesFor();
    const purchaser = gamesFor();
    await purchaser.access.startMinute('snake');
    assert.equal(purchaser.gameTimeRemaining, 60);
    staleTab.lifecycle.updateGameTimer();
    await settleClock(staleTab);
    assert.equal(staleTab.gameTimeRemaining, 60);
    assert.equal(readLocalArcadeSession('owner-a').remainingSeconds, 60);
    const reload = gamesFor();
    assert.equal(reload.gameTimeRemaining, 60);
    assert.equal(calls, 1);
    assert.equal(readLocalArcadeSession('owner-a').pendingPurchase, null);
});

test('a same-owner clock cannot write while a purchase owns the native cross-tab lock', async t => {
    let release;
    installBackend(t, () => new Promise(resolve => { release = resolve; }));
    const stale = gamesFor(), buyer = gamesFor();
    const pending = buyer.access.startMinute('snake');
    while (!release) await new Promise(resolve => setImmediate(resolve));
    const receipt = readLocalArcadeSession('owner-a').pendingPurchase;
    assert.ok(receipt);
    stale.updateGameTimer();
    await settleClock(stale);
    assert.deepEqual(readLocalArcadeSession('owner-a').pendingPurchase, receipt);
    release({ data: receiptResult() });
    await pending;
    await settleClock(buyer);
    stale.updateGameTimer();
    await settleClock(stale);
    assert.equal(stale.gameTimeRemaining, 60);
    assert.equal(readLocalArcadeSession('owner-a').remainingSeconds, 60);
    assert.equal(readLocalArcadeSession('owner-a').pendingPurchase, null);
});

for (const message of ['Not enough coins.', 'Complete another formative activity before continuing the Arcade.']) {
    test('a confirmed rejected purchase does not buy later just because the wallet is refreshed', async t => {
        const calls = [];
        installBackend(t, (_name, params) => {
            calls.push(params);
            return Promise.resolve(calls.length === 1 ? { error: { code: 'P0001', message } } : { data: receiptResult() });
        });
        const games = gamesFor();
        await assert.rejects(games.access.startMinute('snake'), { code: 'P0001' });
        assert.equal(readLocalArcadeSession('owner-a').pendingPurchase, null);
        await games.loadArcadeTime({ force: true });
        assert.equal(calls.length, 1);
        await games.access.startMinute('snake');
        assert.equal(calls.length, 2);
        assert.notEqual(calls[1].p_event_id, calls[0].p_event_id);
        assert.equal(calls[1].p_expected_user_id, 'owner-a');
    });
}

for (const failure of [
    { code: '42501', message: 'Owner changed' },
    { code: 'P0001', message: 'The client event ID was already used for a different request.' },
    { status: 400, message: 'Unexpected rejection' }
]) {
    test('uncertain owner, receipt conflict and unknown failures retain the original purchase', async t => {
        installBackend(t, () => Promise.resolve({ error: failure }));
        const games = gamesFor();
        await assert.rejects(games.access.startMinute('snake'));
        assert.ok(readLocalArcadeSession('owner-a').pendingPurchase);
    });
}

test('required work prevents a NEW receipt and debit under the purchase lock', async t => {
    let calls = 0;
    installBackend(t, () => { calls++; return Promise.resolve({ data: receiptResult() }); });
    const games = gamesFor();
    games.sm.activities.getPendingRequiredWork = () => ({ isBlocked: true });
    await assert.rejects(games.access.startMinute('snake'), { code: 'ARCADE_REQUIRED_WORK' });
    assert.equal(calls, 0);
    assert.equal(readLocalArcadeSession(games.sessionOwnerId).pendingPurchase, null);
    assert.equal(await games.requestAdditionalTime(), false);
    assert.equal(calls, 0);
});

test('an existing receipt reconciles despite readiness failure, which still blocks a NEW spend', async t => {
    const calls = [];
    installBackend(t, (_name, args) => { calls.push(args); return Promise.resolve({ data: receiptResult() }); }, {
        recover(args) { calls.push(args); return { receiptFound: true, purchase: receiptResult() }; }
    });
    const games = gamesFor();
    const pendingPurchase = { eventId: 'arcade-minute:existing', gameId: 'snake', clientId: 'paid-client' };
    writeLocalArcadeSession(games.sessionOwnerId, { pendingPurchase });
    games.sm.activities.vocabularyData.loadClassSelection = async () => { throw new Error('Class read unavailable'); };
    await games.loadArcadeTime({ force: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].p_event_id, pendingPurchase.eventId);
    assert.equal(games.gameTimeRemaining, 60);
    assert.equal(readLocalArcadeSession(games.sessionOwnerId).pendingPurchase, null);
    await assert.rejects(games.access.startMinute('snake'), /Class read unavailable/);
    assert.equal(calls.length, 1);
});

test('an unpaid uncertain intent cannot create a first debit after required work becomes blocked', async t => {
    let starts = 0, lookups = 0;
    const fail = new Error('Transport failed before commit');
    installBackend(t, () => { starts++; return Promise.reject(fail); }, {
        recover() { lookups++; return { receiptFound: false }; }
    });
    const games = gamesFor();
    await assert.rejects(games.access.startMinute('snake'), /before commit/);
    const original = readLocalArcadeSession(games.sessionOwnerId).pendingPurchase;
    games.sm.activities.getPendingRequiredWork = () => ({ isBlocked: true });
    await assert.rejects(games.loadArcadeTime({ force: true }), { code: 'ARCADE_REQUIRED_WORK' });
    assert.equal(starts, 1);
    assert.equal(lookups, 1);
    assert.deepEqual(readLocalArcadeSession(games.sessionOwnerId).pendingPurchase, original);
    assert.equal(games.gameTimeRemaining, 0);
});

for (const lookup of [null, {}, [], { receiptFound: 'false' }, { receiptFound: false, purchase: {} }, { receiptFound: true }, { receiptFound: true, purchase: {} }]) {
    test('an ambiguous recovery response preserves the intent and never falls back to spending', async t => {
        let starts = 0;
        installBackend(t, () => { starts++; return Promise.resolve({ data: receiptResult() }); }, { recover: () => lookup });
        const games = gamesFor();
        const pendingPurchase = { eventId: 'arcade-minute:unknown', gameId: 'snake', clientId: 'saved-client' };
        writeLocalArcadeSession(games.sessionOwnerId, { pendingPurchase });
        await assert.rejects(games.loadArcadeTime({ force: true }));
        assert.equal(starts, 0);
        assert.deepEqual(readLocalArcadeSession(games.sessionOwnerId).pendingPurchase, pendingPurchase);
        assert.equal(games.gameTimeRemaining, 0);
    });
}

test('confirmed missing receipt retries its original stable intent only after eligibility succeeds', async t => {
    const starts = [];
    installBackend(t, (_name, args) => { starts.push(args); return Promise.resolve({ data: receiptResult() }); });
    const games = gamesFor();
    const pendingPurchase = { eventId: 'arcade-minute:missing', gameId: 'snake', clientId: 'saved-client' };
    writeLocalArcadeSession(games.sessionOwnerId, { pendingPurchase });
    await games.loadArcadeTime({ force: true });
    assert.equal(starts.length, 1);
    assert.equal(starts[0].p_event_id, pendingPurchase.eventId);
    assert.equal(starts[0].p_client_id, pendingPurchase.clientId);
    assert.equal(starts[0].p_game_id, pendingPurchase.gameId);
    assert.equal(games.gameTimeRemaining, 60);
    await games.loadArcadeTime({ force: true });
    assert.equal(starts.length, 1);
    assert.equal(games.gameTimeRemaining, 60);
});
