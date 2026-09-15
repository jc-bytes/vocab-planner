import assert from 'node:assert/strict';
import test from 'node:test';
import { installStudentAppUpdates } from '../js/student/studentAppUpdates.js';

async function setup({ firstInstall = false, activity = false } = {}) {
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    const worker = Object.assign(new EventTarget(), { controller: firstInstall ? null : {} });
    const calls = { saves: 0, reloads: 0, updates: 0 };
    const app = { currentActivityType: activity ? 'fill-in-blank' : null,
        progress: { saveLocalProgress() { calls.saves++; } } };
    win.location = { hash: activity ? '#/unit/week1/activity/fill-in-blank' : '#/unit/week1',
        reload() { calls.reloads++; } };
    win.setInterval = callback => { calls.tick = callback; return 1; };
    win.clearInterval = () => { calls.cleared = true; };
    worker.register = async (url, options) => {
        calls.registration = { url, options };
        return { async update() { calls.updates++; } };
    };
    const nav = { serviceWorker: worker, onLine: true };
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
