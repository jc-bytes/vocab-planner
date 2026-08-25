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
        return null;
    },
    createElement() {
        return {
            style: {},
            appendChild() {},
            remove() {},
            classList: { add() {}, remove() {} },
            addEventListener() {},
            setAttribute() {},
            querySelector() { return { addEventListener() {} }; }
        };
    },
    body: { appendChild() {} },
    head: { appendChild() {} },
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
const { StudentRouting } = await import('../js/studentRoutingMethods.js');

function createManager() {
    return {
        authDisabled: true,
        currentUser: null,
        currentVocab: null,
        activities: {
            activityRouteTypes: ['flashcards', 'illustration'],
            availableVocabs: [],
            renderDashboard() {}
        }
    };
}

test('StudentRouting owns route and lazy-game state', () => {
    const manager = createManager();
    const first = new StudentRouting(manager);
    const second = new StudentRouting(manager);

    assert.equal(first.sm, manager);
    assert.equal(first.routeReady, false);
    assert.equal(first.isApplyingRoute, false);
    assert.equal(first.pendingRoute, null);
    assert.equal(first.games, null);
    assert.equal(first.gamesPromise, null);

    first.routeReady = true;
    first.isApplyingRoute = true;
    first.games = {};

    assert.equal(second.routeReady, false);
    assert.equal(second.isApplyingRoute, false);
    assert.equal(second.pendingRoute, null);
    assert.equal(second.games, null);
});

test('route changes are queued while a previous route is still loading', async () => {
    const manager = createManager();
    const routing = new StudentRouting(manager);
    routing.routeReady = true;
    const applied = [];
    let releaseFirst;
    routing.applyRouteTarget = async route => {
        applied.push(route.view);
        if (route.view === 'unit') {
            await new Promise(resolve => {
                releaseFirst = resolve;
            });
        }
    };

    const firstApply = routing.applyRoute({ view: 'unit', unitId: 'one' });
    window.location.hash = '#/menu';
    routing.handleRouteChange();
    releaseFirst();
    await firstApply;

    assert.deepEqual(applied, ['unit', 'menu']);
    assert.equal(routing.pendingRoute, null);
    assert.equal(routing.isApplyingRoute, false);
});

test('StudentManager declares the stable routing interface directly', () => {
    for (const method of [
        'getVocabRouteId',
        'getCurrentVocabRouteId',
        'getGames',
        'parseRoute',
        'setRoute',
        'navigateTo',
        'restoreRouteOrDefault',
        'handleRouteChange',
        'isKnownActivityType'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentManager.prototype, method),
            true,
            `${method} must be declared by StudentManager`
        );
    }

    assert.equal(
        Object.prototype.hasOwnProperty.call(StudentManager.prototype, 'resetRouteState'),
        false,
        'route reset belongs to StudentRouting; session cleanup uses resetSessionRouting'
    );
});

test('route parsing and building preserve the public URL contract', () => {
    const routing = new StudentRouting(createManager());

    assert.deepEqual(routing.parseRoute('#/menu'), { view: 'menu' });
    assert.deepEqual(routing.parseRoute('#/sparks'), { view: 'sparks' });
    assert.deepEqual(routing.parseRoute('#/units?trimester=t2&month=july'), {
        view: 'units',
        all: false,
        trimester: 't2',
        month: 'july'
    });
    assert.deepEqual(routing.parseRoute('#/unit/week%201/activity/illustration?word=3'), {
        view: 'activity',
        unitId: 'week 1',
        activityType: 'illustration',
        word: 3,
        hasWordParam: true,
        wordWasInvalid: false
    });
    assert.equal(
        routing.buildRoute({ view: 'activity', unitId: 'week 1', activityType: 'illustration', word: 3 }),
        '#/unit/week%201/activity/illustration?word=3'
    );
    assert.equal(routing.buildRoute({ view: 'sparks' }), '#/sparks');
});

test('route lookup and activity validation use the StudentActivities-owned catalog', () => {
    const manager = createManager();
    manager.activities.availableVocabs = [{ id: 'unit-1', name: 'Unit One' }];
    const routing = new StudentRouting(manager);

    assert.equal(routing.findVocabByRouteId('unit-1'), manager.activities.availableVocabs[0]);
    assert.equal(routing.isKnownActivityType('flashcards'), true);
    assert.equal(routing.isKnownActivityType('unknown-activity'), false);
});

test('every route out of an activity waits for pending verified progress', async () => {
    const manager = createManager();
    manager.currentActivityType = 'flashcards';
    manager.currentVocab = { id: 'unit-1', name: 'Unit One' };
    let releaseSync;
    const events = [];
    manager.activities.flushPendingActivityProgress = () => new Promise(resolve => {
        releaseSync = () => {
            events.push('synced');
            resolve();
        };
    });
    manager.cleanupActivity = () => events.push('cleanup');
    manager.resetStudentVocabularyDrilldown = () => {};
    manager.activities.renderDashboard = () => events.push('dashboard');
    manager.switchView = view => events.push(view);
    const routing = new StudentRouting(manager);

    const leaving = routing.applyRouteTarget({ view: 'units' });
    await Promise.resolve();
    assert.deepEqual(events, []);

    releaseSync();
    await leaving;

    assert.deepEqual(events, ['synced', 'cleanup', 'dashboard', 'vocab-selection-view']);
});

test('changing an illustration word route does not flush or interrupt the active activity', async () => {
    const manager = createManager();
    manager.currentActivityType = 'illustration';
    manager.currentVocab = { id: 'unit-1', name: 'Unit One' };
    let flushes = 0;
    manager.activities.flushPendingActivityProgress = async () => { flushes += 1; };
    const routing = new StudentRouting(manager);

    await routing.flushActivityProgressBeforeRoute({
        view: 'activity',
        unitId: 'unit-1',
        activityType: 'illustration',
        word: 2
    });

    assert.equal(flushes, 0);
});

test('direct activity restoration keeps the unit menu deferred until the activity is ready', async () => {
    const manager = createManager();
    const vocab = { id: 'unit-1', name: 'Unit One' };
    const calls = [];
    manager.activities.availableVocabs = [vocab];
    manager.activities.loadVocabulary = async (...args) => calls.push(['loadVocabulary', ...args]);
    manager.activities.startActivity = async (...args) => calls.push(['startActivity', ...args]);
    const routing = new StudentRouting(manager);

    await routing.applyRouteTarget({
        view: 'activity',
        unitId: 'unit-1',
        activityType: 'flashcards'
    });

    assert.deepEqual(calls, [
        ['loadVocabulary', vocab, {
            fromRoute: true,
            skipActivityPreload: true,
            deferActivityMenu: true
        }],
        ['startActivity', 'flashcards', {
            fromRoute: true,
            initialWordIndex: 0,
            requestedWord: null,
            hasWordParam: undefined,
            wordWasInvalid: undefined
        }]
    ]);
});

test('reset clears only routing lifecycle state', () => {
    const routing = new StudentRouting(createManager());
    const games = {};
    routing.routeReady = true;
    routing.isApplyingRoute = true;
    routing.games = games;

    routing.reset();

    assert.equal(routing.routeReady, false);
    assert.equal(routing.isApplyingRoute, false);
    assert.equal(routing.games, games);
});

test('arcade routing redirects blocked students to their oldest pending unit', async () => {
    const manager = createManager();
    const pendingVocab = { id: 'unit-1', name: 'Pending Unit' };
    const calls = [];
    const access = {
        isBlocked: true,
        remainingActivities: 2,
        next: { vocab: pendingVocab, routeId: 'unit-1' }
    };
    manager.activities.getPendingRequiredWork = () => access;
    manager.activities.updateArcadeGateDisplay = value => calls.push(['gate', value]);
    manager.activities.loadVocabulary = async (...args) => calls.push(['loadVocabulary', ...args]);
    const routing = new StudentRouting(manager);
    routing.setRoute = (...args) => calls.push(['setRoute', ...args]);

    const opened = await routing.showArcadeView();

    assert.equal(opened, false);
    assert.deepEqual(calls, [
        ['gate', access],
        ['setRoute', { view: 'unit', unitId: 'unit-1' }, { replace: true }],
        ['loadVocabulary', pendingVocab, { fromRoute: true }]
    ]);
});

test('arcade routing sends required current Spark work to the Sparks view', async () => {
    const manager = createManager();
    const calls = [];
    const access = {
        isBlocked: true,
        remainingActivities: 1,
        spark: { spark: { id: 'spark-1' }, remaining: 1 },
        next: { kind: 'spark', spark: { id: 'spark-1' } }
    };
    manager.activities.refreshCurrentSparkGate = async () => calls.push(['refreshSpark']);
    manager.activities.getPendingRequiredWork = () => access;
    manager.activities.updateArcadeGateDisplay = value => calls.push(['gate', value]);
    const routing = new StudentRouting(manager);
    routing.setRoute = (...args) => calls.push(['setRoute', ...args]);
    routing.showSparksView = async () => calls.push(['showSparks']);

    const opened = await routing.showArcadeView();

    assert.equal(opened, false);
    assert.deepEqual(calls, [
        ['refreshSpark'],
        ['gate', access],
        ['setRoute', { view: 'sparks' }, { replace: true }],
        ['showSparks']
    ]);
});
