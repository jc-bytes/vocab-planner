import assert from 'node:assert/strict';
import { after, test } from 'node:test';

const originalGlobals = {
    document: globalThis.document,
    window: globalThis.window,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout
};

let nextTimerId = 1;
const timers = new Map();
const clearedTimers = [];

function createElement(tagName) {
    const attributes = new Map();
    const listeners = new Map();
    return {
        tagName: tagName.toUpperCase(),
        id: '',
        className: '',
        textContent: '',
        style: {},
        children: [],
        parentNode: null,
        setAttribute(name, value) {
            attributes.set(name, String(value));
        },
        getAttribute(name) {
            return attributes.get(name) ?? null;
        },
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
        removeChild(child) {
            this.children = this.children.filter(candidate => candidate !== child);
            child.parentNode = null;
            return child;
        },
        addEventListener(type, listener) {
            const typeListeners = listeners.get(type) || [];
            typeListeners.push(listener);
            listeners.set(type, typeListeners);
        },
        dispatchEvent(event) {
            if (!event.target) event.target = this;
            event.currentTarget = this;
            for (const listener of listeners.get(event.type) || []) listener(event);
            if (!event.propagationStopped && this.parentNode) this.parentNode.dispatchEvent(event);
        }
    };
}

function findById(root, id) {
    if (root.id === id) return root;
    for (const child of root.children) {
        const match = findById(child, id);
        if (match) return match;
    }
    return null;
}

function clickEvent() {
    return {
        type: 'click',
        target: null,
        currentTarget: null,
        propagationStopped: false,
        stopPropagation() {
            this.propagationStopped = true;
        }
    };
}

{
    const body = createElement('body');
    const head = createElement('head');
    globalThis.document = {
        body,
        head,
        createElement,
        getElementById(id) {
            return findById(body, id) || findById(head, id);
        }
    };
    globalThis.window = { lucide: { createIcons() {} } };
    globalThis.setTimeout = (callback, delay) => {
        const id = nextTimerId++;
        timers.set(id, { callback, delay });
        return id;
    };
    globalThis.clearTimeout = (id) => {
        clearedTimers.push(id);
        timers.delete(id);
    };
}

after(() => {
    Object.assign(globalThis, originalGlobals);
});

const { notifications } = await import('../js/notifications.js');

test('notifications expose appropriate live-region semantics and normalize unknown types', () => {
    const errorToast = notifications.show('Could not save', 'error', 0);
    const fallbackToast = notifications.show('Heads up', 'unknown', 0);

    assert.equal(errorToast.className, 'toast toast-error');
    assert.equal(errorToast.getAttribute('role'), 'alert');
    assert.equal(errorToast.getAttribute('aria-live'), 'assertive');
    assert.equal(errorToast.getAttribute('aria-atomic'), 'true');
    assert.equal(fallbackToast.className, 'toast toast-info');
    assert.equal(fallbackToast.getAttribute('role'), 'status');
    assert.equal(fallbackToast.getAttribute('aria-live'), 'polite');
    assert.equal(fallbackToast.children[1].textContent, 'Heads up');
});

test('clicking a close-button glyph schedules exactly one removal and cancels auto-dismiss', () => {
    timers.clear();
    clearedTimers.length = 0;
    const toast = notifications.success('Saved', 4000);
    const closeButton = toast.children[2];
    const closeGlyph = closeButton.children[0];
    const autoTimerId = [...timers.keys()][0];

    closeGlyph.dispatchEvent(clickEvent());
    closeButton.dispatchEvent(clickEvent());

    assert.deepEqual(clearedTimers, [autoTimerId]);
    assert.equal(toast.style.animation, 'slideOutRight 0.3s ease-out');
    assert.equal(timers.size, 1, 'only the removal animation timer should remain');

    const [{ callback, delay }] = [...timers.values()];
    assert.equal(delay, 300);
    callback();
    assert.equal(toast.parentNode, null);
});

test('clicking the toast surface remains a supported dismissal path', () => {
    timers.clear();
    const toast = notifications.info('Dismiss me', 0);

    toast.dispatchEvent(clickEvent());

    assert.equal(toast.style.animation, 'slideOutRight 0.3s ease-out');
    assert.equal(timers.size, 1);
});
