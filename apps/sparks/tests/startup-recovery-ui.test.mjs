import assert from 'node:assert/strict';
import test from 'node:test';
import { createStartupRecovery } from '../js/services/startupRecovery.js';

class Element extends EventTarget {
    constructor() {
        super();
        this.dataset = {};
        this.childNodes = [];
        this.textContent = '';
    }
    append(...nodes) { this.childNodes.push(...nodes); }
    replaceChildren(...nodes) { this.childNodes = [...nodes]; }
    setAttribute() {}
    contains(node) { return this.childNodes.includes(node); }
}

function fixture() {
    const win = new EventTarget(), doc = new EventTarget(), root = new Element();
    const original = new Element(); root.append(original);
    doc.createElement = () => new Element();
    doc.visibilityState = 'visible';
    const nav = { onLine: true }, timers = new Map(), requests = [];
    let now = 0, nextId = 0, available = false, recovered = false, signedOut = false;
    win.setTimeout = (callback, delay) => {
        const id = ++nextId;
        timers.set(id, { at: now + delay, callback });
        return id;
    };
    win.clearTimeout = id => timers.delete(id);
    const error = new TypeError('Failed to fetch');
    const recovery = createStartupRecovery({
        root, window: win, document: doc, navigator: nav,
        isCurrent: () => !signedOut,
        signOut: () => { signedOut = true; recovery.dispose(); },
        retry: async () => {
            requests.push(now);
            if (available) { recovered = true; recovery.dispose(); }
            else recovery.failed(error);
        }
    });
    const card = root.childNodes[0];
    async function advance(delay) {
        const until = now + delay;
        for (;;) {
            const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
            if (!next || next[1].at > until) break;
            now = next[1].at; timers.delete(next[0]); next[1].callback();
            for (let i = 0; i < 8; i++) await Promise.resolve();
        }
        now = until;
    }
    return { win, doc, nav, root, original, recovery, requests, timers, advance,
        button: card.childNodes[2], exit: card.childNodes[3], status: card.childNodes[1],
        available: () => { available = true; }, recovered: () => recovered,
        fail: (failure = error) => recovery.failed(failure) };
}

test('a temporary school outage recovers after the initial retry window with Wi-Fi still connected', async () => {
    const f = fixture(); f.fail();
    await f.advance(10000);
    assert.deepEqual(f.requests, [1000, 4000]);
    f.available();
    await f.advance(60000);
    assert.equal(f.recovered(), true);
    assert.deepEqual(f.root.childNodes, [f.original]);
    assert.equal(f.timers.size, 0);
});

test('a prolonged outage keeps retries spaced out and stops after sign-out', async () => {
    const f = fixture(); f.fail();
    await f.advance(134000);
    assert.deepEqual(f.requests, [1000, 4000, 14000, 44000, 74000, 104000, 134000]);
    f.exit.dispatchEvent(new Event('click'));
    const count = f.requests.length;
    await f.advance(120000);
    f.win.dispatchEvent(new Event('online'));
    f.win.dispatchEvent(new Event('focus'));
    f.doc.dispatchEvent(new Event('visibilitychange'));
    await f.advance(1000);
    assert.equal(f.requests.length, count);
    assert.equal(f.timers.size, 0);
});

test('returning to a visible tab resumes a paused school check', async () => {
    const f = fixture();
    f.doc.visibilityState = 'hidden'; f.fail();
    await f.advance(60000);
    assert.equal(f.requests.length, 0);
    f.available(); f.doc.visibilityState = 'visible';
    f.doc.dispatchEvent(new Event('visibilitychange'));
    await f.advance(0);
    assert.equal(f.recovered(), true);
});

test('offline recovery waits for reconnection and preserves the signed-in recovery view', async () => {
    const f = fixture(); f.nav.onLine = false; f.fail();
    await f.advance(60000);
    assert.equal(f.requests.length, 0);
    assert.match(f.status.textContent, /offline/i);
    f.available(); f.nav.onLine = true; f.win.dispatchEvent(new Event('online'));
    await f.advance(0);
    assert.equal(f.recovered(), true);
});

test('permission denial and invalid sessions do not retry automatically', async () => {
    for (const status of [400, 401, 403, 404]) {
        const f = fixture(); f.fail({ status, code: '42501' });
        await f.advance(60000);
        f.win.dispatchEvent(new Event('online')); f.win.dispatchEvent(new Event('focus'));
        f.doc.dispatchEvent(new Event('visibilitychange'));
        await f.advance(0);
        assert.equal(f.requests.length, 0);
        assert.equal(f.timers.size, 0);
        f.recovery.dispose();
    }
});
