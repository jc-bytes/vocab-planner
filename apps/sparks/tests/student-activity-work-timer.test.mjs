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
