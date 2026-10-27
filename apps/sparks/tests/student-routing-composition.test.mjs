import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.localStorage = {
    getItem() {
        return null;
    },
    setItem() {},
    removeItem() {}
};
globalThis.cancelAnimationFrame = () => {};
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
const { StudentShell } = await import('../js/studentShellMethods.js');
const { StudentActivitySession } = await import('../js/student/studentActivitySession.js');
const { FlashcardsActivity } = await import('../js/activities/flashcards.js');
const { LazyStudentActivityLauncher } = await import('../js/student/lazyStudentActivityLauncher.js');

function createManager() {
    const manager = {
        authDisabled: true,
        currentUser: null,
        currentVocab: null,
        activities: {
            activityRouteTypes: ['flashcards', 'illustration'],
            availableVocabs: [],
            renderDashboard() {},
            vocabularyData: {
                async prepareClassData() { return { isCurrent: () => true }; },
                getVisibleVocabularyList() { return { vocabs: manager.activities.availableVocabs }; }
            }
        }
    };
    return manager;
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
    assert.deepEqual(routing.parseRoute(routing.buildRoute({view:'sparks',all:true})), {view:'sparks',all:true});
    const sparkLocation = {view:'sparks',trimester:'IIIT',month:'october',sparkId:'assignment with spaces'};
    assert.deepEqual(routing.parseRoute(routing.buildRoute(sparkLocation)),sparkLocation);
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

test('route lookup and activity validation use the prepared StudentActivities-owned catalog', async () => {
    const manager = createManager();
    manager.activities.availableVocabs = [{ id: 'unit-1', name: 'Unit One' }];
    const routing = new StudentRouting(manager);

    assert.equal(await routing.findVocabByRouteId('unit-1'), manager.activities.availableVocabs[0]);
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

    assert.deepEqual(events, ['synced', 'cleanup', 'vocab-selection-view', 'dashboard']);
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
            deferActivityMenu: true,
            activityType: 'flashcards'
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

test('session reset invalidates a pending lazy Arcade construction', async () => {
    const routing = new StudentRouting(createManager());
    let resolveModule;
    let constructions = 0;
    routing.loadGamesModule = () => new Promise(resolve => {
        resolveModule = resolve;
    });

    const pendingGames = routing.getGames();
    routing.resetSession();
    resolveModule({
        StudentGames: class {
            constructor() {
                constructions += 1;
            }
        }
    });

    assert.equal(await pendingGames, null);
    assert.equal(constructions, 0);
    assert.equal(routing.games, null);
    assert.equal(routing.gamesPromise, null);
});

test('arcade routing redirects blocked students to their oldest pending unit', async () => {
    const manager = createManager();
    const pendingVocab = { id: 'unit-1', name: 'Pending Unit' };
    const calls = [];
    manager.cleanupActivity = () => calls.push(['cleanup']);
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
        ['cleanup'],
        ['setRoute', { view: 'unit', unitId: 'unit-1' }, { replace: true }],
        ['loadVocabulary', pendingVocab, { fromRoute: true }]
    ]);
});

test('arcade routing sends required current Spark work to the Sparks view', async () => {
    const manager = createManager();
    const calls = [];
    manager.cleanupActivity = () => {};
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

test('denied Arcade navigation removes real Flashcards help and invalidates late activity work before showing the unit', async t => {
    t.mock.method(globalThis, 'cancelAnimationFrame', () => {});
    const manager = createManager();
    const session = new StudentActivitySession(manager.activities);
    manager.activities.session = session;
    const activity = Object.create(FlashcardsActivity.prototype);
    let helpConnected = true, idleDestroyed = false, spotlightClosed = false;
    activity.emberHelpButton = { remove() { helpConnected = false; } };
    activity.idleWatch = { destroy() { idleDestroyed = true; } };
    activity.closeSpotlight = () => { spotlightClosed = true; };
    session.activityInstance = activity;
    manager.activityInstance = activity;
    manager.currentActivityType = 'flashcards';
    const launchId = session.beginActivityLaunch();
    const signal = session.activityLaunchSignal;
    const shell = new StudentShell(manager);
    manager.cleanupActivity = () => shell.cleanupActivity();
    manager.activities.getPendingRequiredWork = () => ({ isBlocked: true, remainingActivities: 1,
        next: { vocab: { id: 'required' }, routeId: 'required' } });
    manager.activities.updateArcadeGateDisplay = () => {};
    let menuShown = false;
    manager.activities.loadVocabulary = async () => {
        assert.equal(helpConnected, false, 'old activity help must leave before menu help attaches');
        assert.equal(session.activityInstance, null);
        assert.equal(signal.aborted, true);
        assert.equal(session.isActivityLaunchCurrent(launchId), false);
        menuShown = true;
    };
    const routing = new StudentRouting(manager);
    routing.setRoute = () => {};
    assert.equal(await routing.showArcadeView(), false);
    assert.equal(menuShown, true);
    assert.equal(idleDestroyed, true);
    assert.equal(spotlightClosed, true);
    assert.equal(manager.currentActivityType, null);
});

test('denied Arcade cleanup cancels a held eager launcher import even when the required unit and route stay unchanged', async () => {
    const manager = createManager();
    manager.currentVocab = { id: 'required' };
    const session = new StudentActivitySession(manager.activities);
    manager.activities.session = session;
    manager.activities.sm = manager;
    let release, starts = 0;
    const launcher = new LazyStudentActivityLauncher(manager.activities, () => new Promise(resolve => { release = resolve; }));
    manager.activities.launcher = launcher;
    const shell = new StudentShell(manager);
    manager.cleanupActivity = () => shell.cleanupActivity();
    manager.activities.getPendingRequiredWork = () => ({ isBlocked: true, remainingActivities: 1,
        next: { vocab: manager.currentVocab, routeId: 'required' } });
    manager.activities.updateArcadeGateDisplay = () => {};
    manager.activities.loadVocabulary = async () => {};
    const routing = new StudentRouting(manager);
    routing.setRoute = () => {};
    const pending = launcher.startActivity('flashcards');
    await Promise.resolve();
    await routing.showArcadeView();
    release({ StudentActivityLauncher: class { startActivity() { starts++; } } });
    await pending;
    assert.equal(starts, 0, 'the old import must not restart Flashcards over the required-work menu');
    assert.equal(launcher.isStarting, false);
});

test('eligibility failure tears down existing Flashcards and its help', async () => {
 const manager=createManager();
 const session=new StudentActivitySession(manager.activities); manager.activities.session=session;
 const activity=Object.create(FlashcardsActivity.prototype); let removed=false;
 activity.emberHelpButton={remove(){removed=true;}}; activity.closeSpotlight=()=>{};
 session.activityInstance=activity; manager.activityInstance=activity; manager.currentActivityType='flashcards';
 const signal=(session.beginActivityLaunch(),session.activityLaunchSignal);
 const shell=new StudentShell(manager); manager.cleanupActivity=()=>shell.cleanupActivity();
 manager.activities.refreshCurrentSparkGate=async()=>{throw Error('offline');};
 manager.switchView=()=>{};
 const routing=new StudentRouting(manager);
 assert.equal(await routing.showArcadeView(),false);
 assert.equal(removed,true,'existing Flashcards help must be removed on error route');
 assert.equal(signal.aborted,true);
});
test('eligibility failure invalidates held eager activity import', async()=>{
 const manager=createManager(); manager.currentVocab={id:'unit'};
 const session=new StudentActivitySession(manager.activities); manager.activities.session=session; manager.activities.sm=manager;
 let release,starts=0;
 const launcher=new LazyStudentActivityLauncher(manager.activities,()=>new Promise(r=>release=r)); manager.activities.launcher=launcher;
 const shell=new StudentShell(manager); manager.cleanupActivity=()=>shell.cleanupActivity();
 manager.activities.refreshCurrentSparkGate=async()=>{throw Error('offline');}; manager.switchView=()=>{};
 const routing=new StudentRouting(manager);
 const pending=launcher.startActivity('flashcards'); await Promise.resolve();
 await routing.showArcadeView(); release({StudentActivityLauncher:class {startActivity(){starts++;}}}); await pending;
 assert.equal(starts,0,'held activity must not start over eligibility error');
});

test('cancelled data-only route lookup never redirects a newer Home intent to Units', async () => {
    const manager = createManager();
    let release;
    manager.activities.vocabularyData.prepareClassData = () => new Promise(resolve => { release = resolve; });
    const routing = new StudentRouting(manager);
    const redirects = [];
    routing.setRoute = route => redirects.push(route);
    routing.showUnitsView = () => redirects.push('Units');
    const reading = routing.applyRouteTarget({ view: 'unit', unitId: 'held' });
    await new Promise(resolve => setImmediate(resolve));
    release(null);
    await reading;
    assert.deepEqual(redirects, []);
});

test('held lookup remains cancelled across navigation away and back to the same unit hash', async () => {
    const manager = createManager(), routing = new StudentRouting(manager);
    let release, guard;
    manager.activities.vocabularyData.prepareClassData = options => new Promise(resolve => {
        guard = options.isCurrent;
        release = () => resolve({ isCurrent: guard });
    });
    const lookup = routing.findVocabByRouteId('unit-1');
    routing.arcadeReadController.abort(); routing.arcadeReadController = new AbortController();
    release();
    assert.equal(await lookup, undefined);
    assert.equal(guard(), false);
});
