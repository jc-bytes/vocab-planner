import assert from 'node:assert/strict';
import test from 'node:test';
import { installStudentAppUpdates } from '../js/student/studentAppUpdates.js';
import { StudentProgressCore } from '../js/student/studentProgressCoreMethods.js';
import { readFile } from 'node:fs/promises';

async function setup({ firstInstall = false, activity = false, serviceWorker = true, reloadStorage = new Map(), build = 'unit-test' } = {}) {
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible', querySelector: selector => selector.includes('script') ? { getAttribute: () => `/assets/student-${build}.js` } : null });
    const worker = Object.assign(new EventTarget(), { controller: firstInstall ? null : {} });
    const calls = { saves: 0, reloads: 0, updates: 0 };
    const app = { currentActivityType: activity ? 'fill-in-blank' : null,
        progress: { saveLocalProgress() { calls.saves++; } } };
    win.location = { hash: activity ? '#/unit/week1/activity/fill-in-blank' : '#/unit/week1',
        reload() { calls.reloads++; } };
    win.sessionStorage = { getItem: key => reloadStorage.get(key) ?? null, setItem: (key, value) => reloadStorage.set(key, value) };
    win.setInterval = callback => { calls.tick = callback; return 1; };
    win.clearInterval = () => { calls.cleared = true; };
    worker.register = async (url, options) => {
        calls.registration = { url, options };
        return { async update() { calls.updates++; } };
    };
    const nav = { serviceWorker: serviceWorker ? worker : undefined, onLine: true };
    const stop = installStudentAppUpdates({ window: win, document: doc, navigator: nav, getApp: () => app });
    await Promise.resolve(); await Promise.resolve();
    const update = () => { worker.controller = {}; worker.dispatchEvent(new Event('controllerchange')); };
    return { win, doc, worker, calls, app, nav, stop, update };
}

test('updates bypass the HTTP cache and check on startup, focus and reconnect', async () => {
    const s = await setup();
    assert.deepEqual(s.calls.registration, { url: './student-sw.js', options: { updateViaCache: 'none' } });
    assert.equal(s.calls.updates, 1);
    s.win.dispatchEvent(new Event('focus')); await Promise.resolve();
    s.win.dispatchEvent(new Event('online')); await Promise.resolve();
    assert.equal(s.calls.updates, 3);
    s.stop();
});

test('an update refreshes the menu once, after saving local progress', async () => {
    const s = await setup();
    s.win.location.reload = () => { assert.equal(s.calls.saves, 1); s.calls.reloads++; };
    s.update(); s.update(); await s.calls.tick();
    assert.equal(s.calls.reloads, 1);
    s.stop();
});

test('first installation does not reload or interrupt the page', async () => {
    const s = await setup({ firstInstall: true });
    s.update();
    assert.equal(s.calls.reloads, 0);
    s.stop();
});

test('an update waits for students to leave an activity before refreshing', async () => {
    const s = await setup({ activity: true });
    s.update(); await s.calls.tick();
    assert.equal(s.calls.reloads, 0);
    s.win.location.hash = '#/unit/week1';
    s.win.dispatchEvent(new Event('hashchange'));
    assert.equal(s.calls.reloads, 0, 'Route transition may still be saving the activity');
    s.app.currentActivityType = null;
    await s.calls.tick();
    assert.equal(s.calls.reloads, 1);
    s.stop();
});

test('offline and hidden pages defer refresh until visible and online', async () => {
    const s = await setup();
    s.nav.onLine = false; s.update();
    assert.equal(s.calls.reloads, 0);
    s.nav.onLine = true; s.doc.visibilityState = 'hidden'; await s.calls.tick();
    assert.equal(s.calls.reloads, 0);
    s.doc.visibilityState = 'visible'; s.doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(s.calls.reloads, 1);
    s.stop();
});

test('an update never reloads other work screens and disposal removes listeners', async () => {
    const s = await setup();
    s.win.location.hash = '#/sparks'; s.update(); await s.calls.tick();
    assert.equal(s.calls.reloads, 0);
    s.stop();
    s.win.location.hash = '#/units'; s.update();
    assert.equal(s.calls.reloads, 0);
    assert.equal(s.calls.cleared, true);
});

test('the current classes home is safe only after active work has ended', async () => {
    const s = await setup({ activity: true });
    s.win.location.hash = '#/classes'; s.update();
    assert.equal(s.calls.reloads, 0);
    s.app.currentActivityType = null;
    await s.calls.tick();
    assert.equal(s.calls.reloads, 1);
    s.stop();
});

test('stale imports recover safely even when service workers are unavailable', async () => {
    const s = await setup({ serviceWorker: false });
    s.win.location.hash = '#/classes';
    const event = new Event('vite:preloadError', { cancelable: true });
    s.win.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.equal(s.calls.saves, 1);
    assert.equal(s.calls.reloads, 1);
    s.stop();
});

test('stale imports defer recovery during work and keep the failure visible', async () => {
    const s = await setup({ serviceWorker: false, activity: true });
    const event = new Event('vite:preloadError', { cancelable: true });
    s.win.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
    assert.equal(s.calls.reloads, 0);
    s.app.currentActivityType = null;
    s.win.location.hash = '#/classes'; s.win.dispatchEvent(new Event('hashchange'));
    assert.equal(s.calls.reloads, 1);
    s.stop();
});

test('a failed local save prevents stale-import refresh and disposal stops recovery', async () => {
    const s = await setup({ serviceWorker: false });
    s.app.progress.saveLocalProgress = () => { throw new Error('Storage unavailable'); };
    const event = new Event('vite:preloadError', { cancelable: true });
    s.win.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
    assert.equal(s.calls.reloads, 0);
    s.stop();
    s.app.progress.saveLocalProgress = () => { s.calls.saves++; };
    s.win.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    s.win.dispatchEvent(new Event('hashchange'));
    assert.equal(s.calls.reloads, 0);
});

test('real progress storage failure returns false and blocks automatic recovery', async t => {
    t.mock.method(console, 'error', () => {});
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const s = await setup({ serviceWorker: false });
    const manager = { progressData: { units: {} }, studentProfile: {}, coinData: {}, coinHistory: [], scheduleCloudSync() {} };
    const core = new StudentProgressCore({ sm: manager });
    core.updateLevelDisplay = () => {};
    s.app.progress.saveLocalProgress = () => core.saveLocalProgress();
    try {
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
            setItem() { throw new Error('Quota exceeded'); }
        } });
        const event = new Event('vite:preloadError', { cancelable: true });
        s.win.dispatchEvent(event);
        assert.equal(event.defaultPrevented, false);
        assert.equal(s.calls.reloads, 0);
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem() {} } });
        s.win.dispatchEvent(new Event('hashchange'));
        assert.equal(s.calls.reloads, 1);
    } finally {
        s.stop();
        if (original) Object.defineProperty(globalThis, 'localStorage', original);
        else delete globalThis.localStorage;
    }
});

test('production installs stale-import recovery independently of service-worker support', async () => {
    const source = await readFile(new URL('../js/student.js', import.meta.url), 'utf8');
    const install = source.slice(source.lastIndexOf('if (import.meta.env?.PROD'));
    assert.match(install, /installStudentAppUpdates\(\)/);
    assert.doesNotMatch(install, /'serviceWorker' in navigator/);
});

test('preload failures during eager launcher startup remain owned by visible activity recovery', async () => {
    const s = await setup({ serviceWorker: false });
    s.win.location.hash = '#/unit/fixture';
    s.app.activities = { launcher: { isStarting: true } };
    const event = new Event('vite:preloadError', { cancelable: true });
    s.win.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
    assert.equal(s.calls.reloads, 0);
    s.app.activities.launcher.isStarting = false;
    const query = s.doc.querySelector;
    s.doc.querySelector = selector => selector.includes('.activity-load-error') ? {} : query(selector);
    await s.calls.tick();
    assert.equal(s.calls.reloads, 0);
    s.doc.querySelector = query;
    await s.calls.tick();
    assert.equal(s.calls.reloads, 0, 'A handled launch rejection does not schedule a deferred automatic refresh');
    s.stop();
});

test('Menu preparation and retained style error own preload recovery without auto-reload', async () => {
    const s = await setup({ serviceWorker: false });
    s.app.activities = { menu: { isPreparing: true } };
    const event = new Event('vite:preloadError', { cancelable: true });
    s.win.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false); assert.equal(s.calls.reloads, 0);
    s.app.activities.menu.isPreparing = false;
    const query = s.doc.querySelector;
    s.doc.querySelector = selector => selector.includes('.unit-menu-load-error') ? {} : query(selector);
    s.win.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    await s.calls.tick(); assert.equal(s.calls.reloads, 0);
    s.doc.querySelector = query;
    await s.calls.tick();
    assert.equal(s.calls.reloads, 0, 'Handled Menu failure does not leave a pending deferred reload');
    s.stop();
});

test('visible Units preparation and failed CSS own recovery, while hidden error never blocks safe refresh', async () => {
    const s = await setup({ serviceWorker: false });
    s.win.location.hash = '#/units';
    s.app.activities = { unitsPresentationPreparing: true };
    const query = s.doc.querySelector;
    let visible = true, failed = false;
    s.doc.querySelector = selector => {
        if (selector === '#vocab-selection-view:not(.hidden)') return visible ? {} : null;
        if (selector.includes('.student-library-load-error')) return visible && failed ? {} : null;
        return query(selector);
    };
    s.win.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    assert.equal(s.calls.reloads, 0, 'Held Units CSS must reach its caller instead of being preempted');
    s.app.activities.unitsPresentationPreparing = false; failed = true;
    s.win.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    assert.equal(s.calls.reloads, 0, 'Current visible recovery remains owned by Units');
    visible = false; s.win.location.hash = '#/unit/healthy';
    s.win.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    assert.equal(s.calls.reloads, 1, 'Hidden Units error leaves ordinary safe refresh unchanged');
    assert.equal(s.calls.saves, 1); s.stop();
});

test('a persistent preload failure reloads each document build at most once across page recreation', async () => {
    const reloadStorage = new Map();
    for (const [build, expectedReloads] of [['one', 1], ['one', 0], ['two', 1]]) {
        const s = await setup({ serviceWorker: false, reloadStorage, build });
        const event = new Event('vite:preloadError', { cancelable: true });
        s.win.dispatchEvent(event);
        assert.equal(s.calls.reloads, expectedReloads);
        assert.equal(event.defaultPrevented, expectedReloads === 1);
        s.stop();
    }
});

test('preload failures cannot start an unbounded reload loop when session storage is unavailable', async () => {
    const s = await setup({ serviceWorker: false });
    s.win.sessionStorage.setItem = () => { throw new Error('Session storage unavailable'); };
    const event = new Event('vite:preloadError', { cancelable: true });
    s.win.dispatchEvent(event);
    assert.equal(s.calls.reloads, 0);
    assert.equal(event.defaultPrevented, false);
    s.stop();
});
