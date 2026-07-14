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
const { StudentRouting } = await import('../js/studentRoutingMethods.js');

function createManager() {
    return {
        authDisabled: true,
        currentUser: null,
        currentVocab: null,
        activityRouteTypes: ['flashcards', 'illustration'],
        availableVocabs: []
    };
}

test('StudentRouting owns route and lazy-game state', () => {
    const manager = createManager();
    const first = new StudentRouting(manager);
    const second = new StudentRouting(manager);

    assert.equal(first.sm, manager);
    assert.equal(first.routeReady, false);
    assert.equal(first.isApplyingRoute, false);
    assert.equal(first.games, null);
    assert.equal(first.gamesPromise, null);

    first.routeReady = true;
    first.isApplyingRoute = true;
    first.games = {};

    assert.equal(second.routeReady, false);
    assert.equal(second.isApplyingRoute, false);
    assert.equal(second.games, null);
});

test('StudentManager declares the stable routing interface directly', () => {
    for (const method of [
        'slugifyRouteId',
        'getVocabRouteId',
        'getCurrentVocabRouteId',
        'getGames',
        'parseRoute',
        'buildRoute',
        'setRoute',
        'navigateTo',
        'restoreRouteOrDefault',
        'handleRouteChange',
        'findVocabByRouteId',
        'isKnownActivityType',
        'showUnitsView',
        'showArcadeView',
        'applyRoute',
        'resetRouteState'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentManager.prototype, method),
            true,
            `${method} must be declared by StudentManager`
        );
    }
});

test('route parsing and building preserve the public URL contract', () => {
    const routing = new StudentRouting(createManager());

    assert.deepEqual(routing.parseRoute('#/menu'), { view: 'menu' });
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
