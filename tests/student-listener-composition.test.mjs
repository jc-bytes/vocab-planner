import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.localStorage = {
    getItem() {
        return null;
    },
    setItem() {},
    removeItem() {}
};
globalThis.document = {
    readyState: 'loading',
    addEventListener() {},
    removeEventListener() {},
    getElementById() {
        return {};
    },
    querySelector() {
        return null;
    },
    querySelectorAll() {
        return [];
    }
};
globalThis.window = {
    location: {
        hash: '',
        pathname: '/student.html',
        search: ''
    },
    history: {
        pushState() {},
        replaceState() {}
    },
    addEventListener() {},
    removeEventListener() {}
};

const { StudentManager } = await import('../js/student.js');
const { StudentListeners } = await import('../js/studentListenerMethods.js');

test('StudentListeners owns isolated lifecycle and export state', () => {
    const manager = {};
    const first = new StudentListeners(manager);
    const second = new StudentListeners(manager);

    assert.equal(first.sm, manager);
    assert.equal(first.initialized, false);
    assert.equal(first.finalReportExportInProgress, false);
    assert.deepEqual(first.disposers, []);

    first.initialized = true;
    first.finalReportExportInProgress = true;
    first.disposers.push(() => {});

    assert.equal(second.initialized, false);
    assert.equal(second.finalReportExportInProgress, false);
    assert.deepEqual(second.disposers, []);
});

test('StudentManager declares the stable listener interface directly', () => {
    for (const method of [
        'initListeners',
        'addListener',
        'setStudentExportButtonState',
        'destroyStudentListeners'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentManager.prototype, method),
            true,
            `${method} must be declared by StudentManager`
        );
    }
});

test('tracked listeners are removed during teardown', () => {
    const listeners = new StudentListeners({});
    const target = new EventTarget();
    let calls = 0;

    listeners.listen(target, 'student-test', () => {
        calls += 1;
    });
    target.dispatchEvent(new Event('student-test'));

    assert.equal(calls, 1);
    assert.equal(listeners.disposers.length, 1);

    listeners.initialized = true;
    listeners.destroy();
    target.dispatchEvent(new Event('student-test'));

    assert.equal(calls, 1);
    assert.equal(listeners.disposers.length, 0);
    assert.equal(listeners.initialized, false);
});

test('export button state remains reversible', () => {
    const listeners = new StudentListeners({});
    const attributes = new Map();
    const button = {
        dataset: {},
        disabled: false,
        innerHTML: '<span>Download</span>',
        setAttribute(name, value) {
            attributes.set(name, value);
        },
        removeAttribute(name) {
            attributes.delete(name);
        }
    };

    listeners.setStudentExportButtonState(button, true, 'Preparing...');
    assert.equal(button.disabled, true);
    assert.equal(attributes.get('aria-busy'), 'true');
    assert.match(button.innerHTML, /Preparing/);

    listeners.setStudentExportButtonState(button, false);
    assert.equal(button.disabled, false);
    assert.equal(attributes.has('aria-busy'), false);
    assert.equal(button.innerHTML, '<span>Download</span>');
    assert.equal('idleHtml' in button.dataset, false);
});
