import assert from 'node:assert/strict';
import test from 'node:test';

const sessionValues = new Map();
globalThis.sessionStorage = {
    getItem(key) {
        return sessionValues.get(key) || null;
    },
    setItem(key, value) {
        sessionValues.set(key, String(value));
    }
};
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
    addEventListener() {},
    removeEventListener() {}
};

const { StudentProgress } = await import('../js/student/studentProgress.js');
const { StudentManager } = await import('../js/student.js');
const { StudentProgressCloud } = await import('../js/student/studentProgressCloudMethods.js');
const { StudentProgressCoins } = await import('../js/student/studentProgressCoinMethods.js');
const { StudentProgressCore } = await import('../js/student/studentProgressCoreMethods.js');
const { StudentProgressSyncQueue } = await import('../js/student/studentProgressSyncQueue.js');
const { StudentCoinNotifications } = await import('../js/student/studentCoinNotifications.js');

function createManager() {
    return {
        authDisabled: true,
        currentUser: null,
        coinData: { balance: 0, giftCoins: 0, totalEarned: 0, totalSpent: 0, totalGifted: 0 },
        coinHistory: [],
        coins: 0,
        progressData: { units: {} },
        setAuthStatus() {},
        updateCoinDisplay() {},
        showNotificationBadge() {},
        hideNotificationBadge() {}
    };
}

test('StudentProgress owns explicit core, cloud, sync queue, and coin components', () => {
    const manager = createManager();
    const progress = new StudentProgress(manager);

    assert.equal(progress.sm, manager);
    assert.ok(progress.core instanceof StudentProgressCore);
    assert.ok(progress.cloud instanceof StudentProgressCloud);
    assert.ok(progress.syncQueue instanceof StudentProgressSyncQueue);
    assert.ok(progress.coins instanceof StudentProgressCoins);
    assert.ok(progress.notifications instanceof StudentCoinNotifications);
    assert.equal(progress.core.progress, progress);
    assert.equal(progress.cloud.progress, progress);
    assert.equal(progress.syncQueue.progress, progress);
    assert.equal(progress.coins.progress, progress);
    assert.equal(progress.notifications.progress, progress);
    assert.ok(progress.clientId);
});

test('level display shows total XP and XP remaining to the next level', () => {
    const manager = createManager();
    manager.progressData.totalXp = 249;
    const progress = new StudentProgress(manager);
    const elements = new Map([
        ['[data-student-level]', { textContent: '' }],
        ['[data-student-level-title]', { textContent: '' }],
        ['[data-student-xp-current]', { textContent: '' }],
        ['[data-student-xp-goal]', { textContent: '' }],
        ['[data-student-xp-remaining]', { textContent: '' }],
        ['[data-student-next-level]', { textContent: '' }],
        ['[data-student-xp-fill]', { style: {} }]
    ]);
    const levelDisplay = {
        title: '',
        attributes: {},
        querySelector(selector) {
            return elements.get(selector) || null;
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        }
    };
    const originalQuerySelector = document.querySelector;
    document.querySelector = selector => selector === '#student-level-display' ? levelDisplay : null;

    try {
        progress.core.updateLevelDisplay();
        assert.equal(elements.get('[data-student-level]').textContent, '2');
        assert.equal(elements.get('[data-student-level-title]').textContent, 'Explorer');
        assert.equal(elements.get('[data-student-xp-current]').textContent, '149');
        assert.equal(elements.get('[data-student-xp-goal]').textContent, '150');
        assert.equal(elements.get('[data-student-xp-remaining]').textContent, '1');
        assert.equal(elements.get('[data-student-next-level]').textContent, '3');
        assert.match(elements.get('[data-student-xp-fill]').style.width, /^99\.3/);
        assert.match(levelDisplay.title, /249 XP total/);
        assert.equal(levelDisplay.attributes['aria-valuemax'], '150');
        assert.equal(levelDisplay.attributes['aria-valuenow'], '149');
        assert.match(levelDisplay.attributes['aria-label'], /1 experience points to Level 3/);
    } finally {
        document.querySelector = originalQuerySelector;
    }
});

test('StudentProgress declares its stable lifecycle interface directly', () => {
    for (const method of [
        'loadLocalProgress',
        'saveLocalProgress',
        'scheduleCloudSync',
        'cancelScheduledCloudSync',
        'applyProgressSnapshot',
        'startCoinSync',
        'stopCoinSync',
        'loadCloudProgress',
        'flushLocalSyncQueue',
        'addCoins',
        'deductCoins',
        'acceptGiftCoins',
        'updateCoinDisplay',
        'showNotificationBadge',
        'hideNotificationBadge',
        'showNotificationPanel'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentProgress.prototype, method),
            true,
            `${method} must be declared by StudentProgress`
        );
    }
});

test('StudentManager declares only the cross-component progress interface directly', () => {
    for (const method of [
        'updateLevelDisplay',
        'scheduleCloudSync',
        'updateCoinDisplay'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentManager.prototype, method),
            true,
            `${method} must be declared by StudentManager`
        );
    }
});

test('progress-owned notifications render and hide the pending coin badge', () => {
    const manager = createManager();
    manager.coinData.giftCoins = 125;
    const progress = new StudentProgress(manager);
    const elements = new Map();
    const parent = {
        style: {},
        appendChild(element) {
            elements.set(`#${element.id}`, element);
        }
    };
    elements.set('#coin-balance', { parentElement: parent });
    const originalQuerySelector = document.querySelector;
    const originalCreateElement = document.createElement;
    document.querySelector = selector => elements.get(selector) || null;
    document.createElement = () => ({
        style: {},
        addEventListener(type, listener) {
            this.listeners ||= {};
            this.listeners[type] = listener;
        }
    });

    try {
        progress.showNotificationBadge();
        const badge = elements.get('#coin-notification-badge');
        assert.ok(badge);
        assert.equal(badge.textContent, '99+');
        assert.equal(badge.style.display, 'flex');
        assert.equal(parent.style.position, 'relative');
        assert.equal(typeof badge.listeners.click, 'function');

        progress.hideNotificationBadge();
        assert.equal(badge.style.display, 'none');
    } finally {
        document.querySelector = originalQuerySelector;
        document.createElement = originalCreateElement;
    }
});

test('scheduled cloud saving is owned and cancellable by StudentProgress', () => {
    const manager = createManager();
    manager.currentUser = { uid: 'student-1' };
    const statuses = [];
    manager.setAuthStatus = status => statuses.push(status);
    const progress = new StudentProgress(manager);
    let scheduledCallback = null;
    let clearedTimer = null;
    let saveCount = 0;
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    globalThis.setTimeout = callback => {
        scheduledCallback = callback;
        return 42;
    };
    globalThis.clearTimeout = timer => {
        clearedTimer = timer;
    };
    progress.cloud.saveProgressToCloud = () => {
        saveCount += 1;
    };

    try {
        progress.scheduleCloudSync();
        assert.equal(progress.scheduledCloudSaveTimeout, 42);
        assert.deepEqual(statuses, ['Saving...']);

        progress.scheduleCloudSync();
        assert.equal(clearedTimer, 42);
        scheduledCallback();
        assert.equal(progress.scheduledCloudSaveTimeout, null);
        assert.equal(saveCount, 1);
    } finally {
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
    }
});

test('coin operations use the coordinator for core persistence', () => {
    const manager = createManager();
    const progress = new StudentProgress(manager);
    let saveCount = 0;
    progress.saveLocalProgress = () => {
        saveCount += 1;
    };

    progress.addCoins(12, 'activity', 'Completed practice');

    assert.equal(manager.coinData.balance, 12);
    assert.equal(manager.coinData.totalEarned, 12);
    assert.equal(manager.coins, 12);
    assert.equal(manager.coinHistory.length, 1);
    assert.equal(manager.coinHistory[0].clientId, progress.clientId);
    assert.equal(saveCount, 1);
});

test('cloud synchronization state is owned by the cloud component', () => {
    const first = new StudentProgress(createManager());
    const second = new StudentProgress(createManager());

    first.cloud.coinRefreshInFlight = true;
    first.cloud.coinRefreshPendingOptions = { reason: 'test' };

    assert.equal(second.cloud.coinRefreshInFlight, false);
    assert.equal(second.cloud.coinRefreshPendingOptions, null);
    assert.equal('coinRefreshInFlight' in first, false);
});
