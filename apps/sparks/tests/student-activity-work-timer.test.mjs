import assert from 'node:assert/strict';
import test from 'node:test';

let visibilityState = 'visible';
let focused = true;
const listeners = new Map();
const storage = new Map();
const indicator = {
    hidden: true,
    textContent: '',
    classList: {
        late: false,
        toggle(name, value) { if (name === 'is-late') this.late = Boolean(value); },
        remove(name) { if (name === 'is-late') this.late = false; }
    },
    setAttribute() {}
};

globalThis.document = {
    get visibilityState() { return visibilityState; },
    hasFocus() { return focused; },
    addEventListener(type, listener) { listeners.set(`document:${type}`, listener); },
    removeEventListener(type) { listeners.delete(`document:${type}`); },
    querySelector(selector) { return selector === '#activity-time-indicator' ? indicator : null; }
};
globalThis.window = {
    addEventListener(type, listener) { listeners.set(`window:${type}`, listener); },
    removeEventListener(type) { listeners.delete(`window:${type}`); }
};
globalThis.localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
};

const { StudentActivityWorkTimer } = await import('../js/student/studentActivityWorkTimer.js');

test('activity timer counts focused visible time and pauses while hidden', () => {
    let now = 0;
    const timer = new StudentActivityWorkTimer({ now: () => now });
    timer.start({ attemptId: 'attempt-1', activeSeconds: 0, timeLimitSeconds: 60 });

    now = 15_000;
    assert.equal(timer.getSnapshot().activeSeconds, 15);

    visibilityState = 'hidden';
    listeners.get('document:visibilitychange')();
    now = 45_000;
    assert.equal(timer.getSnapshot().activeSeconds, 15);

    visibilityState = 'visible';
    listeners.get('document:visibilitychange')();
    now = 55_000;
    assert.equal(timer.getSnapshot().activeSeconds, 25);
    timer.destroy();
});

test('activity timer restores saved time and marks only time beyond the limit late', () => {
    storage.set('student_activity_active_time:attempt-2', '45');
    let now = 0;
    const timer = new StudentActivityWorkTimer({ now: () => now });
    timer.start({ attemptId: 'attempt-2', activeSeconds: 30, timeLimitSeconds: 60 });

    now = 15_000;
    assert.equal(timer.getSnapshot().activeSeconds, 60);
    assert.equal(timer.getSnapshot().isLate, false);

    now = 16_000;
    timer.render();
    assert.equal(timer.getSnapshot().isLate, true);
    assert.equal(indicator.classList.late, true);
    assert.match(indicator.textContent, /^Late by/);
    timer.destroy();
});


test('untimed attempts count foreground time without displaying a limit or creating lateness', () => {
    let now = 0;
    const timer = new StudentActivityWorkTimer({ now: () => now });
    visibilityState = 'visible'; focused = true;
    timer.start({ attemptId: 'untimed-attempt', activeSeconds: 0 });
    now = 30_000;
    assert.equal(timer.getSnapshot().activeSeconds, 30);
    assert.equal(timer.getSnapshot().isLate, false);
    timer.render(); assert.equal(indicator.hidden, true);
    timer.handleBlur(); now = 90_000;
    assert.equal(timer.getSnapshot().activeSeconds, 30);
    timer.destroy();
});

const settleReports = () => new Promise(resolve => setImmediate(resolve));

test('background time reports catch sync throws and retry without acknowledging failure', async t => {
    let now = 0;
    let calls = 0;
    const timer = new StudentActivityWorkTimer({ now: () => now, onReport() {
        calls++;
        if (calls === 1) throw new Error('Network down');
        return Promise.resolve({ activeSeconds: 60 });
    } });
    t.after(() => timer.destroy());
    t.mock.method(console, 'warn', () => {});
    timer.start({ attemptId: 'failed-sync-report' });
    now = 30_000;
    assert.doesNotThrow(() => timer.tick());
    await settleReports();
    assert.equal(timer.lastReportedSeconds, 0);
    assert.equal(storage.get('student_activity_active_time:failed-sync-report'), '30');
    now = 31_000;
    timer.tick();
    assert.equal(calls, 1, 'Failed reports must not retry every second');
    now = 60_000;
    timer.tick();
    await settleReports();
    assert.equal(calls, 2);
    assert.equal(timer.lastReportedSeconds, 60);
});

test('rejected time reports remain handled and local active seconds survive', async t => {
    let now = 0;
    const timer = new StudentActivityWorkTimer({ now: () => now, onReport: async () => { throw new Error('Disconnected'); } });
    t.after(() => timer.destroy());
    t.mock.method(console, 'warn', () => {});
    timer.start({ attemptId: 'failed-async-report' });
    now = 30_000;
    timer.tick();
    await settleReports();
    assert.equal(timer.lastReportedSeconds, 0);
    assert.equal(storage.get('student_activity_active_time:failed-async-report'), '30');
});

test('time reports serialize and send the latest cumulative seconds after settling', async t => {
    let now = 0;
    let release;
    const reports = [];
    const timer = new StudentActivityWorkTimer({ now: () => now, onReport(snapshot) {
        reports.push(snapshot);
        return new Promise(resolve => { release = resolve; });
    } });
    t.after(() => timer.destroy());
    timer.start({ attemptId: 'serialized-report' });
    now = 30_000; timer.tick();
    now = 60_000; timer.tick();
    assert.equal(reports.length, 1);
    release({ activeSeconds: 30 });
    await settleReports();
    timer.tick();
    assert.equal(reports.length, 2);
    assert.equal(reports[1].activeSeconds, 60);
    release({ activeSeconds: 60 });
    await settleReports();
    assert.equal(timer.lastReportedSeconds, 60);
});

test('restarting the same attempt isolates old report results and cleanup', async t => {
    let now = 0;
    const releases = [];
    const timer = new StudentActivityWorkTimer({ now: () => now, onReport: () => new Promise(resolve => releases.push(resolve)) });
    t.after(() => timer.destroy());
    timer.start({ attemptId: 'restarted-report' });
    now = 30_000; timer.tick();
    timer.start({ attemptId: 'restarted-report' });
    timer.tick();
    assert.equal(releases.length, 2);
    releases[0]({ activeSeconds: 30 });
    await settleReports();
    assert.equal(timer.lastReportedSeconds, 0, 'Old success must not acknowledge the new timer generation');
    now = 60_000; timer.tick();
    assert.equal(releases.length, 2, 'Old cleanup must not release the new in-flight report');
    releases[1]({ activeSeconds: 30 });
    await settleReports();
    assert.equal(timer.lastReportedSeconds, 30);
});

test('a stale rejected report cannot delay or clear the new attempt report', async t => {
    let now = 0;
    const requests = [];
    let warnings = 0;
    const timer = new StudentActivityWorkTimer({ now: () => now, onReport: () => (
        new Promise((resolve, reject) => requests.push({ resolve, reject }))
    ) });
    t.after(() => timer.destroy());
    t.mock.method(console, 'warn', () => { warnings++; });
    timer.start({ attemptId: 'old-rejected-report' });
    now = 30_000; timer.tick();
    timer.start({ attemptId: 'new-pending-report' });
    now = 60_000; timer.tick();
    requests[0].reject(new Error('Old connection failure'));
    await settleReports();
    assert.equal(timer.reportInFlight, true);
    assert.equal(timer.nextReportAt, 0);
    assert.equal(warnings, 0);
    requests[1].resolve({ activeSeconds: 30 });
    await settleReports();
    assert.equal(timer.lastReportedSeconds, 30);
    assert.equal(timer.reportInFlight, false);
});
