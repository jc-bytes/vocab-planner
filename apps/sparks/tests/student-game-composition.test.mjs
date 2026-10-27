import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

// This suite covers the supported single-tab fallback. Purchase recovery tests
// separately exercise native Web Locks and cross-tab receipt serialization.
Object.defineProperty(globalThis.navigator, 'locks', { configurable: true, value: undefined });

globalThis.localStorage = {
    getItem() {
        return null;
    },
    setItem() {},
    removeItem() {}
};
globalThis.sessionStorage = {
    getItem() {
        return null;
    },
    setItem() {}
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
            dataset: {},
            append() {},
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
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout
};

const { StudentGames } = await import('../js/student/studentGames.js');
const { schoolContext } = await import('../js/services/schoolContext.js');
// Composition fixtures declare successful class readiness explicitly; the
// eligibility suite separately exercises missing, failed and delayed reads.
function readyArcadeManager(sm) {
    sm.authDisabled ??= !sm.currentUser;
    sm.activities ||= {};
    sm.activities.getPendingRequiredWork ||= () => ({ isBlocked: false });
    sm.activities.vocabularyData ||= { async loadClassSelection() {}, classSelection: {
        ready: true, owner: sm.currentUser?.uid || sm.currentUser?.id, generation: 1,
        readySchoolGeneration: schoolContext.getGeneration()
    } };
    return sm;
}

const { StudentManager } = await import('../js/student.js');
const { StudentGameHtmlLoader } = await import('../js/student/studentGameHtmlLoaderMethods.js');
const { StudentGameLeaderboard } = await import('../js/student/studentGameLeaderboardMethods.js');
const { StudentGameLifecycle } = await import('../js/student/studentGameLifecycleMethods.js');
const { GAME_HOST_EVENT, parseGameHostMessage } = await import('../js/student/studentGameProtocol.js');
const {
    ARCADE_MINUTE_SECONDS,
    FORMATIVE_PASS_SECONDS,
    MAX_QUEUED_ARCADE_SECONDS
} = await import('../js/student/studentArcadePolicy.js');
const { StudentGameSettings } = await import('../js/student/studentGameSettingsMethods.js');
const { StudentGameAccess } = await import('../js/student/studentGameAccessMethods.js');
const { createServerStateQuery } = await import('../js/services/serverStateQuery.js');
const { leaderboardRepository } = await import('../js/services/leaderboardRepository.js');
const { settingsRepository } = await import('../js/services/settingsRepository.js');
const { notifications } = await import('../js/notifications.js');
const { readLocalArcadeSession, writeLocalArcadeSession } = await import('../js/student/studentArcadeSessionStorage.js');
const { writeLocalArcadeTime } = await import('../js/student/studentArcadeTimeStorage.js');
const { refreshLocalFormativeWindow } = await import('../js/student/studentArcadeTimeStorage.js');
const { supabaseService } = await import('../js/supabaseService.js');
const legacyScoreBridgeSource = await readFile(
    new URL('../js/games/legacy-score-bridge.js', import.meta.url), 'utf8'
);

test('StudentGames owns explicit game components', () => {
    const manager = {};
    const games = new StudentGames(readyArcadeManager(manager));

    assert.equal(games.sm, manager);
    assert.ok(games.settings instanceof StudentGameSettings);
    assert.ok(games.access instanceof StudentGameAccess);
    assert.ok(games.leaderboard instanceof StudentGameLeaderboard);
    assert.ok(games.htmlLoader instanceof StudentGameHtmlLoader);
    assert.equal('scoreMonitor' in games.htmlLoader, false);
    assert.ok(games.lifecycle instanceof StudentGameLifecycle);
    assert.equal(games.settings.games, games);
    assert.equal(games.access.games, games);
    assert.equal(games.lifecycle.games, games);
    assert.equal(games.currentGame, null);
    assert.equal(games.gameTimeRemaining, 0);
    assert.equal(games.savedGameId, '');
    assert.equal(games.gameTimerInterval, null);
    assert.equal(games.isHandlingGameMinute, false);
    assert.equal(games.isAddingGameTime, false);
    assert.equal(games.currentGameIndex, 0);
    assert.ok(games.gamesList.length > 0);
    assert.equal(games.currentGameScore, 0);
    assert.equal(games.currentGameMetadata, null);
    assert.equal(games.lastSavedScore, 0);
    assert.equal(games.isGamePaused, false);
    for (const state of [
        'currentGame',
        'gameTimeRemaining',
        'savedGameId',
        'gameTimerInterval',
        'isHandlingGameMinute',
        'isAddingGameTime',
        'gamesList',
        'currentGameIndex',
        'currentGameScore',
        'currentGameMetadata',
        'lastSavedScore',
        'isGamePaused'
    ]) {
        assert.equal(state in manager, false, `${state} must not be stored on StudentManager`);
    }
});

test('Galactic Breaker launch adapter updates the owning Arcade state', async () => {
    const originalQuerySelector = globalThis.document.querySelector;
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    const classList = { add() {}, remove() {} };
    const stageStyle = { removeProperty() {} };
    const gradient = { addColorStop() {} };
    const context = new Proxy({}, {
        get(target, property) {
            if (property === 'createLinearGradient' || property === 'createRadialGradient') {
                return () => gradient;
            }
            return target[property] || (() => {});
        },
        set(target, property, value) {
            target[property] = value;
            return true;
        }
    });
    const canvas = {
        width: 800,
        height: 600,
        style: {},
        addEventListener() {},
        removeEventListener() {},
        getBoundingClientRect: () => ({ left: 0, right: 800, top: 0, bottom: 600, width: 800, height: 600 }),
        getContext: () => context
    };
    const elements = new Map([
        ['#game-selection', { classList }],
        ['#game-stage', { classList, style: stageStyle }],
        ['#game-canvas', canvas],
        ['#game-score', { style: {}, textContent: '' }]
    ]);

    globalThis.document.querySelector = selector => elements.get(selector) || null;
    globalThis.requestAnimationFrame = () => 1;
    globalThis.cancelAnimationFrame = () => {};

    const games = new StudentGames(readyArcadeManager({
        activities: { getPendingRequiredWork: () => ({ isBlocked: false }) }
    }));
    games.gameTimeRemaining = 9;
    games.lifecycle.updateGameTimer = () => {};
    games.lifecycle.startGameTimer = () => {};

    try {
        assert.equal(await games.launchGame('galactic-breaker'), true);
        await new Promise(resolve => setImmediate(resolve));

        assert.ok(games.currentGame, 'The registered Galactic Breaker module should launch.');
        assert.equal(games.currentGame.getRemainingSeconds(), 9);
        games.currentGame.onScoreChange(42);
        assert.equal(games.currentGameScore, 42);
        assert.equal(Object.hasOwn(games.lifecycle, 'currentGameScore'), false);
    } finally {
        games.cleanupCurrentGame({ saveScore: false });
        globalThis.document.querySelector = originalQuerySelector;
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
        globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    }
});

test('destroyed Arcade ignores a canvas module that resolves after teardown', async () => {
    const originalQuerySelector = globalThis.document.querySelector;
    const classList = { add() {}, remove() {} };
    const elements = new Map([
        ['#game-selection', { classList }],
        ['#game-stage', { classList, style: { removeProperty() {} } }],
        ['#game-canvas', { style: {} }],
        ['#game-score', { style: {} }]
    ]);
    globalThis.document.querySelector = selector => elements.get(selector) || null;
    const games = new StudentGames(readyArcadeManager({
        activities: { getPendingRequiredWork: () => ({ isBlocked: false }) }
    }));
    games.lifecycle.startGameTimer = () => {};

    try {
        assert.equal(await games.launchGame('snake'), true);
        games.destroy();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(games.currentGame, null);
    } finally {
        games.destroy();
        globalThis.document.querySelector = originalQuerySelector;
    }
});

test('student game settings use the shared account-scoped server cache', async () => {
    const originalGet = settingsRepository.get;
    const queryService = createServerStateQuery();
    const calls = [];
    settingsRepository.get = async (key, options) => {
        calls.push({ key, signal: options.signal });
        return { exchangeRate: 17 };
    };
    const manager = { authDisabled: false, currentUser: { uid: 'student-settings-1' } };
    const first = new StudentGameSettings({ sm: manager, sessionOwnerId: 'student-settings-1', queryService });
    const second = new StudentGameSettings({ sm: manager, sessionOwnerId: 'student-settings-1', queryService });

    try {
        assert.equal((await first.loadGlobalSettings()).exchangeRate, 17);
        assert.equal((await second.loadGlobalSettings()).exchangeRate, 17);
    } finally {
        settingsRepository.get = originalGet;
        queryService.clear();
    }

    assert.equal(calls.length, 1);
    assert.equal(calls[0].key, 'gamification');
    assert.ok(calls[0].signal instanceof AbortSignal);
});

test('local game settings remain local offline state', async () => {
    const values = new Map([[
        'dev_gamification_settings',
        JSON.stringify({ exchangeRate: 23 })
    ]]);
    const originalGetItem = globalThis.localStorage.getItem;
    globalThis.localStorage.getItem = key => values.get(key) ?? null;
    let queryCount = 0;
    const settings = new StudentGameSettings({
        sm: { authDisabled: true },
        sessionOwnerId: 'local-dev',
        queryService: { ensure: async () => { queryCount += 1; } }
    });

    try {
        assert.equal((await settings.loadGlobalSettings()).exchangeRate, 23);
    } finally {
        globalThis.localStorage.getItem = originalGetItem;
    }

    assert.equal(queryCount, 0);
});

test('Arcade selection displays the authoritative earned-time balance', async () => {
    const games = new StudentGames(readyArcadeManager({ currentUser: { uid: 'student-1' } }));
    const elements = new Map([
        ['#galactic-breaker-cost', { textContent: '' }],
        ['#add-time-btn', { textContent: '' }],
        ['#arcade-time-balance', { textContent: '' }]
    ]);
    const originalQuerySelector = globalThis.document.querySelector;
    globalThis.document.querySelector = selector => elements.get(selector) || null;
    games.settings.loadGlobalSettings = async () => ({ exchangeRate: 10 });
    games.loadArcadeTime = async () => {
        games.access.arcadeTime = { availableSeconds: FORMATIVE_PASS_SECONDS };
        return games.access.arcadeTime;
    };

    try {
        await games.updateArcadeUI();
        assert.equal(
            elements.get('#arcade-time-balance').textContent,
            '10m 0s of earned Arcade time available. Complete a formative activity after every 10 minutes of Arcade play.'
        );

        games.loadArcadeTime = async () => {
            games.access.arcadeTime = { availableSeconds: 0 };
            return games.access.arcadeTime;
        };
        await games.updateArcadeUI();
        assert.equal(
            elements.get('#arcade-time-balance').textContent,
            'No earned Arcade time available. Complete a formative activity after every 10 minutes of Arcade play.'
        );
    } finally {
        globalThis.document.querySelector = originalQuerySelector;
    }
});

test('legacy game score discovery caches the first matching global', () => {
    assert.match(legacyScoreBridgeSource, /let cachedGame = null/);
    assert.match(legacyScoreBridgeSource, /if \(cachedGame\?\.levelStats\) return cachedGame/);
    assert.match(legacyScoreBridgeSource, /if \(!cachedGame \|\| cachedGame\.score === undefined\)/);
});

test('SpacePi bridge reports only successfully completed level scores', () => {
    const messages = [];
    const game = {
        level: 0,
        levelPlaying: false,
        menuMode: true,
        levelEndStatus: [false, false],
        levelStats: { score: 0 }
    };
    let poll = null;
    const window = {
        sp: game,
        parent: { postMessage: payload => messages.push(payload) },
        setInterval(callback) {
            poll = callback;
            return 1;
        },
        clearInterval() {},
        addEventListener() {}
    };

    runInNewContext(legacyScoreBridgeSource, {
        document: {
            currentScript: {
                dataset: { gameId: 'spacepi', messageType: 'spacepi-score' }
            }
        },
        window,
        Object,
        Number,
        Math,
        Boolean
    });

    assert.equal(typeof poll, 'function');
    poll();

    game.menuMode = false;
    game.levelPlaying = true;
    game.levelStats.score = 100;
    poll();
    assert.deepEqual(messages, [], 'An in-progress value must not become a lower-is-better score.');

    game.menuMode = true;
    game.levelPlaying = false;
    game.levelEndStatus = [true, false];
    game.levelStats.score = 500;
    poll();
    assert.deepEqual(messages, [], 'SpacePi marks failed-level scores as not applied.');

    game.level = 1;
    game.menuMode = false;
    game.levelPlaying = true;
    game.levelEndStatus = [false, false];
    game.levelStats.score = 0;
    poll();

    game.menuMode = true;
    game.levelPlaying = false;
    game.levelEndStatus = [true, true];
    game.levelStats.score = 700;
    poll();

    assert.deepEqual(JSON.parse(JSON.stringify(messages)), [{
        type: 'spacepi-score',
        score: 700,
        level: 2,
        gameOver: false
    }]);
});

test('HTML game messages use one normalized score and game-over protocol', () => {
    assert.deepEqual(
        parseGameHostMessage({
            type: 'trapdoor-score',
            score: 250,
            level: 4,
            deaths: 2,
            completed: true,
            gameOver: true
        }, 'trapdoor-score'),
        {
            event: GAME_HOST_EVENT.GAME_OVER,
            score: 250,
            metadata: {
                level: 4,
                deaths: 2,
                completed: true
            }
        }
    );
    assert.deepEqual(
        parseGameHostMessage({
            type: 'platformer-score', score: 900, attempts: 3, time: 18, gameOver: false
        }, 'platformer-score'),
        {
            event: GAME_HOST_EVENT.SCORE,
            score: 900,
            metadata: { time: 18, attempts: 3 }
        }
    );
    assert.equal(parseGameHostMessage({ type: 'other', score: 10 }, 'expected'), null);
    assert.equal(parseGameHostMessage(null, 'expected'), null);
    for (const score of [NaN, Infinity, -1, 100_000_001, '10', null, true]) {
        assert.equal(parseGameHostMessage({ type: 'expected', score, gameOver: false }, 'expected'), null);
    }
    assert.equal(parseGameHostMessage({ type: 'expected', score: 10, gameOver: 'true' }, 'expected'), null);
    assert.deepEqual(
        parseGameHostMessage({
            type: 'expected', score: 10, level: '4', deaths: null, time: false, gameOver: false
        }, 'expected'),
        { event: GAME_HOST_EVENT.SCORE, score: 10, metadata: {} }
    );
});

test('StudentGames runtime state is isolated per instance', () => {
    const first = new StudentGames(readyArcadeManager({}));
    const second = new StudentGames(readyArcadeManager({}));

    first.currentGame = { gameType: 'snake' };
    first.gameTimeRemaining = 45;
    first.currentGameIndex = 3;
    first.currentGameScore = 120;
    first.isHandlingGameMinute = true;

    assert.equal(second.currentGame, null);
    assert.equal(second.gameTimeRemaining, 0);
    assert.equal(second.currentGameIndex, 0);
    assert.equal(second.currentGameScore, 0);
    assert.equal(second.isHandlingGameMinute, false);
    assert.equal(first.gamesList, second.gamesList);
});

test('StudentGames declares its stable public interface directly', () => {
    for (const method of [
        'formatTime',
        'loadGlobalSettings',
        'getExchangeRate',
        'loadArcadeTime',
        'getAvailableArcadeSeconds',
        'startArcadeMinute',
        'updateArcadeUI',
        'updateGameSelectionUI',
        'saveHighScore',
        'updateLeaderboardGame',
        'showLeaderboardModal',
        'hideLeaderboardModal',
        'loadLeaderboard',
        'loadHTMLGame',
        'exitToGameSelection',
        'selectAdjacentGame',
        'requestAdditionalTime',
        'startGame',
        'stopCurrentGame',
        'pauseGame',
        'addGameTime',
        'updateGameTimer',
        'destroy'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentGames.prototype, method),
            true,
            `${method} must be declared by StudentGames`
        );
    }
});

test('StudentGames omits owner-only loader and lifecycle helpers', () => {
    for (const method of [
        'getScoreMonitoringScript',
        'restartCurrentGame',
        'clearGameTimer',
        'startGameTimer'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentGames.prototype, method),
            false,
            `${method} belongs to the HTML loader or lifecycle owner`
        );
    }
});

test('destroy stops Arcade without saving and aborts in-flight score work', async () => {
    const originalSubmit = supabaseService.submitStudentGameScore;
    let resolveSubmission;
    let submittedOptions = null;
    supabaseService.submitStudentGameScore = (_payload, options) => {
        submittedOptions = options;
        return new Promise(resolve => {
            resolveSubmission = resolve;
        });
    };
    const games = new StudentGames(readyArcadeManager({
        authDisabled: false,
        currentUser: { uid: 'student-destroy' },
        studentProfile: { grade: '7' }
    }));
    let stopped = 0;
    games.currentGame = { gameType: 'snake', stop: () => { stopped += 1; } };
    games.currentGameScore = 25;

    try {
        const pendingSave = games.saveHighScore('snake', 25);
        games.destroy();
        assert.equal(stopped, 1);
        assert.equal(submittedOptions.signal.aborted, true);
        assert.equal(submittedOptions.ownerUserId, 'student-destroy');
        assert.equal(games.currentGame, null);
        resolveSubmission({ score: 25 });
        await pendingSave;
    } finally {
        supabaseService.submitStudentGameScore = originalSubmit;
    }
});

test('session destruction cancels delayed scores and rejects replacement-account work', async () => {
    const originalSubmit = supabaseService.submitStudentGameScore;
    const submitted = [];
    supabaseService.submitStudentGameScore = async payload => {
        submitted.push(payload.score);
        return { score: payload.score };
    };
    const manager = {
        authDisabled: false,
        currentUser: { uid: 'student-original' },
        studentProfile: { grade: '7' }
    };
    const games = new StudentGames(readyArcadeManager(manager));

    try {
        await games.saveHighScore('snake', 10);
        await games.saveHighScore('snake', 20);
        const state = games.leaderboard.scoreSyncStates.get('snake');
        assert.ok(state.timer, 'The improved checkpoint should be delayed.');
        assert.equal(state.pending.score, 20);

        games.destroy();
        assert.equal(state.timer, null);
        assert.equal(state.pending, null);
        manager.currentUser = { uid: 'student-replacement' };
        await games.saveHighScore('snake', 30, null, { immediate: true });
        assert.deepEqual(submitted, [10]);
    } finally {
        supabaseService.submitStudentGameScore = originalSubmit;
        games.destroy();
    }
});

test('session destruction invalidates an Arcade start waiting on old account work', async () => {
    let releaseGate;
    const calls = [];
    const manager = {
        activities: {
            refreshCurrentSparkGate: () => new Promise(resolve => { releaseGate = resolve; }),
            getPendingRequiredWork: () => ({ isBlocked: false })
        }
    };
    const games = new StudentGames(readyArcadeManager(manager));
    games.loadGlobalSettings = async () => calls.push('settings');
    games.loadArcadeTime = async () => calls.push('time');

    const pendingStart = games.startGame('snake');
    await new Promise(resolve => setImmediate(resolve));
    games.destroy();
    releaseGate();

    assert.equal(await pendingStart, false);
    assert.deepEqual(calls, []);
    assert.equal(games.currentGame, null);
});

test('normal Arcade exit still saves the eligible final score', () => {
    const games = new StudentGames(readyArcadeManager({}));
    const calls = [];
    games.currentGame = { gameType: 'snake', stop: () => calls.push('stop') };
    games.currentGameScore = 30;
    games.saveHighScore = (...args) => calls.push(['save', ...args]);

    games.stopCurrentGame();

    assert.deepEqual(calls, [
        'stop',
        ['save', 'snake', 30, null, { immediate: true }]
    ]);
});

test('exiting an Arcade game owns cleanup before restoring selection', () => {
    const games = new StudentGames(readyArcadeManager({}));
    const calls = [];
    games.lifecycle.stopCurrentGame = () => calls.push('stop');
    games.lifecycle.showGameSelection = () => calls.push('selection');

    games.exitToGameSelection();

    assert.deepEqual(calls, ['stop', 'selection']);
});

test('additional Arcade time owns concurrency, cap, access, refresh, and failure feedback', async () => {
    const games = new StudentGames(readyArcadeManager({}));
    const originalWarning = notifications.warning;
    const warnings = [];
    notifications.warning = message => warnings.push(message);

    try {
        games.gameTimeRemaining = MAX_QUEUED_ARCADE_SECONDS;
        let timerUpdates = 0;
        games.lifecycle.updateGameTimer = () => { timerUpdates += 1; };
        assert.equal(await games.requestAdditionalTime(), false);
        assert.equal(timerUpdates, 1);
        assert.match(warnings.pop(), /maximum/);

        let releaseRequest;
        let requestCount = 0;
        games.gameTimeRemaining = 0;
        games.startArcadeMinute = () => {
            requestCount += 1;
            return new Promise(resolve => { releaseRequest = resolve; });
        };
        const pendingRequest = games.requestAdditionalTime();
        await Promise.resolve();
        assert.equal(games.isAddingGameTime, true);
        assert.equal(await games.requestAdditionalTime(), false);
        assert.equal(requestCount, 1);
        releaseRequest(null);
        assert.equal(await pendingRequest, false);
        assert.match(warnings.pop(), /formative activity/);

        const events = [];
        games.gameTimeRemaining = 0;
        games.currentGame = { gameType: 'snake' };
        games.lifecycle.updateGameTimer = () => events.push(['timer', games.isAddingGameTime]);
        games.startArcadeMinute = async gameId => {
            events.push(['start', gameId]);
            return { minuteSeconds: 75 };
        };
        games.lifecycle.addGameTime = seconds => events.push(['add', seconds]);
        games.updateArcadeUI = async options => events.push(['ui', options]);
        assert.equal(await games.requestAdditionalTime(), true);
        assert.equal(games.isAddingGameTime, false);
        assert.deepEqual(events, [
            ['timer', true],
            ['start', 'snake'],
            ['add', 75],
            ['ui', { force: false }],
            ['timer', false]
        ]);

        games.startArcadeMinute = async () => null;
        assert.equal(await games.requestAdditionalTime(), false);
        assert.match(warnings.pop(), /formative activity/);

        games.startArcadeMinute = async () => { throw new Error('Arcade unavailable'); };
        assert.equal(await games.requestAdditionalTime(), false);
        assert.equal(warnings.pop(), 'Arcade unavailable');
        assert.equal(games.isAddingGameTime, false);
    } finally {
        notifications.warning = originalWarning;
    }
});

test('game selection navigation owns index wrapping and coordinated refresh', () => {
    const calls = [];
    const games = new StudentGames(readyArcadeManager({}));
    games.gamesList = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
    games.currentGameIndex = 0;
    games.updateGameSelectionUI = () => calls.push('selection');
    games.updateLeaderboardGame = () => calls.push('leaderboard');

    assert.equal(games.selectAdjacentGame(-1), true);
    assert.equal(games.currentGameIndex, 2);
    assert.deepEqual(calls, ['selection', 'leaderboard']);

    calls.length = 0;
    assert.equal(games.selectAdjacentGame(1), true);
    assert.equal(games.currentGameIndex, 0);
    assert.deepEqual(calls, ['selection', 'leaderboard']);

    games.gamesList = [];
    calls.length = 0;
    assert.equal(games.selectAdjacentGame(1), false);
    assert.deepEqual(calls, []);
});

test('StudentGames delegates to the owning component', async () => {
    const games = new StudentGames(readyArcadeManager({}));
    const calls = [];
    games.lifecycle.startGame = async type => calls.push(['startGame', type]);
    games.leaderboard.saveHighScore = async (...args) => calls.push(['saveHighScore', ...args]);

    await games.startGame('snake');
    await games.saveHighScore('snake', 25, { level: 2 });

    assert.deepEqual(calls, [
        ['startGame', 'snake'],
        ['saveHighScore', 'snake', 25, { level: 2 }, {}]
    ]);
});

test('leaderboard persistence coalesces intermediate scores and avoids preflight reads', async () => {
    const originalSubmit = supabaseService.submitStudentGameScore;
    const submitted = [];
    supabaseService.submitStudentGameScore = async payload => {
        submitted.push(payload);
        return { score: payload.score };
    };
    const games = new StudentGames(readyArcadeManager({
        authDisabled: false,
        currentUser: { uid: 'student-1' },
        studentProfile: { grade: '7' }
    }));
    games.currentGameIndex = games.gamesList.findIndex(game => game.id === 'snake');
    games.leaderboard.loadLeaderboard = async () => {};

    try {
        await games.saveHighScore('snake', 10);
        await games.saveHighScore('snake', 20);
        await games.saveHighScore('snake', 30);
        await games.saveHighScore('snake', 40, null, { immediate: true });
    } finally {
        supabaseService.submitStudentGameScore = originalSubmit;
    }

    assert.deepEqual(submitted.map(item => item.score), [10, 40]);
});

test('lower-is-better leaderboard scores keep only improvements', async () => {
    const originalSubmit = supabaseService.submitStudentGameScore;
    const submitted = [];
    supabaseService.submitStudentGameScore = async payload => {
        submitted.push(payload.score);
        return { score: payload.score };
    };
    const games = new StudentGames(readyArcadeManager({
        authDisabled: false,
        currentUser: { uid: 'student-2' },
        studentProfile: { grade: '7' }
    }));
    games.currentGameIndex = games.gamesList.findIndex(game => game.id === 'spacepi');
    games.leaderboard.loadLeaderboard = async () => {};

    try {
        await games.saveHighScore('spacepi', 10);
        await games.saveHighScore('spacepi', 12, null, { immediate: true });
        await games.saveHighScore('spacepi', 8, null, { immediate: true });
    } finally {
        supabaseService.submitStudentGameScore = originalSubmit;
    }

    assert.deepEqual(submitted, [10, 8]);
});

test('leaderboard ignores stale account, game, and closed-modal reads', async () => {
    const originalQuerySelector = globalThis.document.querySelector;
    const originalListTop = leaderboardRepository.listTop;
    const requests = [];
    const modalClasses = new Set();
    const modal = {
        classList: {
            add: value => modalClasses.add(value),
            remove: value => modalClasses.delete(value),
            contains: value => modalClasses.has(value)
        }
    };
    const container = {
        children: [],
        _innerHTML: '',
        get innerHTML() { return this._innerHTML; },
        set innerHTML(value) {
            this._innerHTML = String(value);
            if (value === '') this.children = [];
        },
        appendChild(child) { this.children.push(child); }
    };
    const deferred = () => {
        let resolve;
        let reject;
        const promise = new Promise((resolvePromise, rejectPromise) => {
            resolve = resolvePromise;
            reject = rejectPromise;
        });
        return { promise, resolve, reject };
    };

    globalThis.document.querySelector = selector => ({
        '#leaderboard-modal': modal,
        '#leaderboard-list': container
    })[selector] || null;
    leaderboardRepository.listTop = options => {
        const request = { ...deferred(), options };
        requests.push(request);
        return request.promise;
    };

    const manager = {
        authDisabled: false,
        currentUser: { uid: 'student-one' },
        studentProfile: { grade: '7' }
    };
    const games = new StudentGames(readyArcadeManager(manager));
    games.currentGameIndex = games.gamesList.findIndex(game => game.id === 'snake');

    try {
        const staleAccountLoad = games.loadLeaderboard('snake');
        manager.currentUser = { uid: 'student-two' };
        const currentAccountLoad = games.loadLeaderboard('snake');
        requests[1].resolve([{ score: 200, name: 'Current Student', userId: 'student-two' }]);
        await currentAccountLoad;
        assert.match(container.children[0].innerHTML, /Current Student/);
        requests[0].resolve([{ score: 100, name: 'Stale Student', userId: 'student-one' }]);
        await staleAccountLoad;
        assert.match(container.children[0].innerHTML, /Current Student/);

        const staleGameLoad = games.loadLeaderboard('snake');
        games.currentGameIndex = games.gamesList.findIndex(game => game.id === 'pong');
        const currentGameLoad = games.loadLeaderboard('pong');
        requests[3].resolve([{ score: 300, name: 'Pong Student', userId: 'student-two' }]);
        await currentGameLoad;
        requests[2].resolve([{ score: 400, name: 'Old Snake Student', userId: 'student-two' }]);
        await staleGameLoad;
        assert.match(container.children[0].innerHTML, /Pong Student/);

        const closedModalLoad = games.loadLeaderboard('pong');
        games.hideLeaderboardModal();
        requests[4].resolve([{ score: 500, name: 'After Close', userId: 'student-two' }]);
        await closedModalLoad;
        assert.match(container.children[0].innerHTML, /Pong Student/);

        modal.classList.remove('hidden');
        const staleErrorLoad = games.loadLeaderboard('pong');
        const stableLoad = games.loadLeaderboard('pong');
        requests[6].resolve([{ score: 600, name: 'Stable Student', userId: 'student-two' }]);
        await stableLoad;
        requests[5].reject(new Error('stale request failed'));
        await staleErrorLoad;
        assert.match(container.children[0].innerHTML, /Stable Student/);
    } finally {
        leaderboardRepository.listTop = originalListTop;
        globalThis.document.querySelector = originalQuerySelector;
    }
});

test('blocked game starts redirect before settings load or coin deduction', async () => {
    const calls = [];
    const access = { isBlocked: true, remainingActivities: 2 };
    const manager = {
        activities: {
            getPendingRequiredWork: () => access,
            updateArcadeGateDisplay: value => calls.push(['gate', value])
        },
        progress: {
            deductCoins: async () => {
                calls.push(['deductCoins']);
                return true;
            }
        },
        navigateTo: async route => calls.push(['navigateTo', route])
    };
    const games = new StudentGames(readyArcadeManager(manager));
    games.loadGlobalSettings = async () => calls.push(['loadGlobalSettings']);
    games.loadArcadeTime = async () => calls.push(['loadArcadeTime']);

    const started = await games.startGame('snake');

    assert.equal(started, false);
    assert.deepEqual(calls, [
        ['gate', access],
        ['navigateTo', { view: 'arcade' }]
    ]);
});

test('direct game launch is rejected while required work is pending', async () => {
    const access = { isBlocked: true, remainingActivities: 1 };
    const manager = {
        activities: {
            getPendingRequiredWork: () => access,
            updateArcadeGateDisplay() {}
        }
    };
    const games = new StudentGames(readyArcadeManager(manager));

    assert.equal(await games.launchGame('snake'), false);
    assert.equal(games.currentGame, null);
    assert.equal(games.gameTimerInterval, null);
});

test('local Arcade minutes require and consume both coins and formative-earned time', async () => {
    const values = new Map();
    globalThis.localStorage.getItem = key => values.get(key) ?? null;
    globalThis.localStorage.setItem = (key, value) => values.set(key, value);
    writeLocalArcadeTime({
        availableSeconds: FORMATIVE_PASS_SECONDS,
        lifetimeEarnedSeconds: FORMATIVE_PASS_SECONDS
    });

    let coinCharges = 0;
    const manager = {
        authDisabled: true,
        progress: {
            async deductCoins(amount) {
                coinCharges += amount;
                return true;
            }
        }
    };
    const games = new StudentGames(readyArcadeManager(manager));
    games.settings.globalSettings = { exchangeRate: 10 };
    await games.loadArcadeTime({ force: true });

    const minute = await games.startArcadeMinute('snake');

    assert.equal(coinCharges, 10);
    assert.equal(minute.minuteSeconds, ARCADE_MINUTE_SECONDS);
    assert.equal(games.getAvailableArcadeSeconds(), FORMATIVE_PASS_SECONDS - ARCADE_MINUTE_SECONDS);
});

test('no coins are charged when a student has no formative-earned Arcade time', async () => {
    const values = new Map();
    globalThis.localStorage.getItem = key => values.get(key) ?? null;
    globalThis.localStorage.setItem = (key, value) => values.set(key, value);
    writeLocalArcadeTime({ availableSeconds: 0 });

    let charged = false;
    const games = new StudentGames(readyArcadeManager({
        authDisabled: true,
        progress: { async deductCoins() { charged = true; return true; } }
    }));
    games.settings.globalSettings = { exchangeRate: 10 };
    await games.loadArcadeTime({ force: true });

    assert.equal(await games.startArcadeMinute('snake'), null);
    assert.equal(charged, false);
});

test('formative completions refresh the window instead of stacking extra Arcade time', () => {
    const values = new Map();
    globalThis.localStorage.getItem = key => values.get(key) ?? null;
    globalThis.localStorage.setItem = (key, value) => values.set(key, value);
    writeLocalArcadeTime({
        availableSeconds: FORMATIVE_PASS_SECONDS - (3 * ARCADE_MINUTE_SECONDS),
        lifetimeEarnedSeconds: FORMATIVE_PASS_SECONDS
    });

    const refreshed = refreshLocalFormativeWindow();
    const repeated = refreshLocalFormativeWindow();

    assert.equal(refreshed.availableSeconds, FORMATIVE_PASS_SECONDS);
    assert.equal(refreshed.lifetimeEarnedSeconds, FORMATIVE_PASS_SECONDS + (3 * ARCADE_MINUTE_SECONDS));
    assert.equal(repeated.availableSeconds, FORMATIVE_PASS_SECONDS);
    assert.equal(repeated.lifetimeEarnedSeconds, FORMATIVE_PASS_SECONDS + (3 * ARCADE_MINUTE_SECONDS));
});

test('manual time additions cannot queue more than ten minutes', () => {
    const games = new StudentGames(readyArcadeManager({}));
    games.gameTimeRemaining = MAX_QUEUED_ARCADE_SECONDS - 30;

    games.addGameTime(ARCADE_MINUTE_SECONDS);

    assert.equal(games.gameTimeRemaining, MAX_QUEUED_ARCADE_SECONDS);
});

test('queued Arcade time survives recreation without another charge', () => {
    const values = new Map();
    globalThis.localStorage.getItem = key => values.get(key) ?? null;
    globalThis.localStorage.setItem = (key, value) => values.set(key, value);
    globalThis.localStorage.removeItem = key => values.delete(key);
    writeLocalArcadeSession('student-1', { remainingSeconds: 347, gameId: 'snake' });

    const restored = new StudentGames(readyArcadeManager({ currentUser: { uid: 'student-1' } }));

    assert.equal(restored.gameTimeRemaining, 347);
    assert.equal(restored.savedGameId, 'snake');
    assert.equal(readLocalArcadeSession('student-1').remainingSeconds, 347);
});

test('a restored Arcade session resumes without buying another minute', async () => {
    const values = new Map();
    globalThis.localStorage.getItem = key => values.get(key) ?? null;
    globalThis.localStorage.setItem = (key, value) => values.set(key, value);
    globalThis.localStorage.removeItem = key => values.delete(key);
    writeLocalArcadeSession('student-2', { remainingSeconds: 180, gameId: 'snake' });

    const games = new StudentGames(readyArcadeManager({
        currentUser: { uid: 'student-2' },
        coins: 0,
        activities: {
            async refreshCurrentSparkGate() {},
            getPendingRequiredWork: () => ({ isBlocked: false })
        }
    }));
    games.loadGlobalSettings = async () => ({ exchangeRate: 10 });
    games.loadArcadeTime = async () => ({ availableSeconds: 0 });
    games.startArcadeMinute = async () => { throw new Error('must not charge'); };
    let launched = null;
    games.lifecycle.launchGame = (gameId, options) => { launched = { gameId, options }; return true; };

    assert.equal(await games.startGame('snake'), true);
    assert.deepEqual(launched, { gameId: 'snake', options: { resetTimer: false } });
    assert.equal(games.gameTimeRemaining, 180);
});

function arcadeRequest() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function arcadeOwnerFixture() {
    localStorage.removeItem('student_arcade_session_v2:student-a');
    const applied = [];
    const progress = { clientId: 'client-a', cloud: { cloudGeneration: 1, applyRemoteCoinProgress: value => applied.push(value) } };
    const sm = { currentUser: { uid: 'student-a' }, authDisabled: false, progress };
    const games = new StudentGames(readyArcadeManager(sm));
    return { games, sm, progress, applied };
}

test('Arcade reads and purchases reject stale owner, progress, generation, destroyed and auth-mode results', async (t) => {
    const originalQuery = document.querySelector;
    const header = { textContent: 'replacement header' };
    document.querySelector = selector => selector === '[data-student-arcade-time]' ? header : null;
    t.after(() => { document.querySelector = originalQuery; });
    const replacements = [
        ({ sm }) => { sm.currentUser = { uid: 'student-b' }; },
        ({ sm }) => { sm.progress = { cloud: { cloudGeneration: 1, applyRemoteCoinProgress: () => assert.fail('Mutated replacement progress') } }; },
        ({ progress }) => { progress.cloud.cloudGeneration++; },
        ({ games }) => { games.destroyed = true; },
        ({ sm }) => { sm.authDisabled = true; }
    ];
    for (const replace of replacements) {
        for (const purchase of [false, true]) {
            localStorage.removeItem('student_arcade_session_v2:student-a');
            const fixture = arcadeOwnerFixture();
            const request = arcadeRequest();
            let dispatched = 0;
            t.mock.method(supabaseService, purchase ? 'startStudentArcadeMinute' : 'getOwnArcadeTime', () => { dispatched++; return request.promise; });
            const pending = purchase ? fixture.games.access.startMinute('snake') : fixture.games.access.loadArcadeTime();
            while (!dispatched) await new Promise(resolve => setImmediate(resolve));
            assert.equal(dispatched, 1);
            replace(fixture);
            request.resolve(purchase ? { coinWallet: { coins: 99 }, arcadeTime: { availableSeconds: 600 } } : { availableSeconds: 600 });
            assert.equal(await pending, null);
            assert.deepEqual(fixture.applied, []);
            assert.equal(fixture.games.access.arcadeTime, null);
            assert.equal(header.textContent, 'replacement header');
            fixture.games.destroyed = true;
            assert.equal(await fixture.games.access.startMinute('snake'), null);
            assert.equal(await fixture.games.access.loadArcadeTime(), null);
            assert.equal(dispatched, 1, 'Destroyed sessions never dispatch another request');
        }
    }
});

test('current Arcade purchase applies its captured wallet and earned-time balance', async (t) => {
    const { games, applied } = arcadeOwnerFixture();
    const result = { coinWallet: { coins: 21 }, arcadeTime: { availableSeconds: 540 }, minuteSeconds: 60 };
    t.mock.method(supabaseService, 'startStudentArcadeMinute', async () => result);
    assert.deepEqual(await games.access.startMinute('snake'), { ...result, localCreditApplied: true });
    assert.equal(games.gameTimeRemaining, 60);
    assert.deepEqual(applied, [result.coinWallet]);
    assert.equal(games.getAvailableArcadeSeconds(), 540);
    t.mock.method(supabaseService, 'getOwnArcadeTime', async () => ({ availableSeconds: 480 }));
    await games.loadArcadeTime({ force: true });
    assert.equal(games.getAvailableArcadeSeconds(), 480);
});

test('local Arcade deduction cannot consume time after teardown and valid demo purchases still work', async (t) => {
    const storage = new Map();
    t.mock.method(localStorage, 'getItem', key => storage.get(key) ?? null);
    t.mock.method(localStorage, 'setItem', (key, value) => storage.set(key, value));
    writeLocalArcadeTime({ availableSeconds: 120 });
    const deduction = arcadeRequest();
    const sm = { authDisabled: true, progress: { deductCoins: () => deduction.promise } };
    const games = new StudentGames(readyArcadeManager(sm));
    await games.loadArcadeTime();
    const pending = games.access.startMinute('snake');
    games.destroyed = true;
    deduction.resolve(true);
    assert.equal(await pending, null);
    const next = new StudentGames(readyArcadeManager({ authDisabled: true, progress: { deductCoins: async () => true } }));
    assert.equal((await next.loadArcadeTime()).availableSeconds, 120);
    assert.equal((await next.access.startMinute('snake')).arcadeTime.availableSeconds, 60);
});

test('settings awaits cannot overwrite replacement Arcade UI or stale settings cache', async (t) => {
    const elements = new Map(['#arcade-time-balance', '#arcade-game-total', '#current-game-card', '#add-time-btn', '#galactic-breaker-cost'].map(key => [key, { textContent: 'B', innerHTML: 'B' }]));
    t.mock.method(document, 'querySelector', key => elements.get(key) || null);
    for (const method of ['updateArcadeUI', 'updateGameSelectionUI']) {
        const { games, sm } = arcadeOwnerFixture();
        const request = arcadeRequest();
        games.settings.loadGlobalSettings = () => request.promise;
        games.loadArcadeTime = async () => {};
        const pending = games.settings[method]();
        games.destroyed = true;
        sm.currentUser = { uid: 'student-b' };
        request.resolve({ exchangeRate: 88 });
        await pending;
        for (const element of elements.values()) {
            assert.equal(element.textContent, 'B');
            assert.equal(element.innerHTML, 'B');
        }
    }
    for (const fails of [false, true]) {
        const { games, progress } = arcadeOwnerFixture();
        const request = arcadeRequest();
        games.settings.queryService = { ensure: () => request.promise.then(() => { if (fails) throw new Error('Old session failure'); return { exchangeRate: 88 }; }) };
        const pending = games.settings.loadGlobalSettings();
        progress.cloud.cloudGeneration++;
        request.resolve();
        assert.equal(await pending, null);
        assert.equal(games.settings.globalSettings, null, 'Neither stale success nor fallback replaces settings');
    }
});

function startFixture() {
    const calls = { purchases: 0, launches: [] };
    const manager = { currentUser: { uid: 'start-operation-student' }, coins: 100,
        activities: { refreshCurrentSparkGate: async () => {}, getPendingRequiredWork: () => ({ isBlocked: false }) } };
    const games = new StudentGames(readyArcadeManager(manager)); games.gameTimeRemaining = 0;
    games.loadGlobalSettings = async () => {}; games.loadArcadeTime = async () => {};
    games.getExchangeRate = () => 10; games.getAvailableArcadeSeconds = () => 300;
    games.startArcadeMinute = async () => { calls.purchases++; return { minuteSeconds: 60 }; };
    games.updateArcadeUI = async () => {};
    games.lifecycle.launchGame = (gameId, options) => { calls.launches.push({ gameId, options }); return true; };
    return { games, manager, calls };
}
const startDeferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('concurrent Play calls acquire one start before gate work and purchase only one minute', async () => {
    const { games, manager, calls } = startFixture(); const gate = startDeferred();
    manager.activities.refreshCurrentSparkGate = () => gate.promise;
    const originalQuery = document.querySelector;
    const play = { disabled: false, setAttribute() {} };
    document.querySelector = selector => selector === '#play-current-game-btn' ? play : originalQuery(selector);
    try {
        const first = games.startGame('snake'); assert.equal(games.isStartingGame, true); assert.equal(play.disabled, true);
        assert.equal(await games.startGame('pong'), false); gate.resolve(); assert.equal(await first, true);
        assert.equal(calls.purchases, 1); assert.equal(games.gameTimeRemaining, 60);
        assert.deepEqual(calls.launches.map(call => call.gameId), ['snake']); assert.equal(play.disabled, false);
    } finally { document.querySelector = originalQuery; games.destroy(); }
});

test('gate, settings, purchase and post-purchase failures release the start lock for retry', async () => {
    const warning = notifications.warning; notifications.warning = () => {};
    try {
        for (const phase of ['gate', 'settings', 'purchase', 'refresh']) {
            const { games, manager, calls } = startFixture(); const fail = async () => { throw new Error(`${phase} failed`); };
            const owner = phase === 'gate' ? manager.activities : games;
            const method = { gate: 'refreshCurrentSparkGate', settings: 'loadGlobalSettings', purchase: 'startArcadeMinute', refresh: 'updateArcadeUI' }[phase];
            const original = owner[method]; owner[method] = fail;
            assert.equal(await games.startGame('snake'), false); assert.equal(games.isStartingGame, false);
            owner[method] = original; assert.equal(await games.startGame('snake'), true);
            assert.equal(calls.purchases, 1, `${phase} retry must keep an already purchased minute`); games.destroy();
        }
    } finally { notifications.warning = warning; }
});

test('Stop before purchase prevents late launch and keeps duplicate Play locked until gate settles', async () => {
    const { games, manager, calls } = startFixture(); const gate = startDeferred();
    manager.activities.refreshCurrentSparkGate = () => gate.promise;
    const pending = games.startGame('snake'); games.stopCurrentGame();
    assert.equal(await games.startGame('pong'), false); gate.resolve(); assert.equal(await pending, false);
    assert.equal(calls.purchases, 0); assert.deepEqual(calls.launches, []); assert.equal(games.isStartingGame, false);
    manager.activities.refreshCurrentSparkGate = async () => {}; assert.equal(await games.startGame('pong'), true); games.destroy();
});

test('Stop during purchase retains paid time for resume without a second charge', async () => {
    const { games, calls } = startFixture(); const purchase = startDeferred(); let dispatched = false;
    games.startArcadeMinute = () => { dispatched = true; calls.purchases++; return purchase.promise; };
    const pending = games.startGame('snake'); while (!dispatched) await Promise.resolve();
    games.stopCurrentGame(); assert.equal(await games.startGame('pong'), false);
    purchase.resolve({ minuteSeconds: 60 }); assert.equal(await pending, false);
    assert.equal(games.gameTimeRemaining, 60); assert.deepEqual(calls.launches, []);
    assert.equal(readLocalArcadeSession(games.sessionOwnerId).remainingSeconds, 60);
    assert.equal(await games.startGame('pong'), true); assert.equal(calls.purchases, 1);
    assert.deepEqual(calls.launches, [{ gameId: 'pong', options: { resetTimer: false } }]); games.destroy();
});

test('destroyed start completion cannot credit old time or unlock a replacement start button', async () => {
    const old = startFixture(), purchase = startDeferred(); let dispatched = false;
    old.games.startArcadeMinute = () => { dispatched = true; return purchase.promise; };
    const originalQuery = document.querySelector; const play = { disabled: false, setAttribute() {} };
    document.querySelector = selector => selector === '#play-current-game-btn' ? play : originalQuery(selector);
    try {
        const pending = old.games.startGame('snake'); while (!dispatched) await Promise.resolve(); old.games.destroy();
        const replacement = startFixture(), gate = startDeferred(); replacement.manager.activities.refreshCurrentSparkGate = () => gate.promise;
        const next = replacement.games.startGame('pong'); purchase.resolve({ minuteSeconds: 60 });
        assert.equal(await pending, false); assert.equal(old.games.gameTimeRemaining, 0);
        assert.equal(replacement.games.isStartingGame, true); assert.equal(play.disabled, true);
        gate.resolve(); assert.equal(await next, true); replacement.games.destroy();
    } finally { document.querySelector = originalQuery; }
});

test('existing queued time supports successive game selections without another purchase', async () => {
    const { games, calls } = startFixture(); games.gameTimeRemaining = 45;
    assert.equal(await games.startGame('snake'), true); games.stopCurrentGame();
    assert.equal(await games.startGame('pong'), true); assert.equal(calls.purchases, 0); assert.equal(games.gameTimeRemaining, 45);
    assert.deepEqual(calls.launches.map(call => call.gameId), ['snake', 'pong']); games.destroy();
});

function extensionFixture() {
    const fixture = startFixture();
    const events = [];
    const game = { gameType: 'snake', completeMinute: () => events.push('complete'), pause: () => events.push('pause'), stop: () => events.push('stop') };
    fixture.games.currentGame = game;
    fixture.games.lifecycle.showGameSelection = () => events.push('selection');
    fixture.manager.navigateTo = async route => events.push(route.view);
    return { ...fixture, events, game };
}

test('obsolete automatic extension failures cannot stop a replacement or touch an empty stage', async (t) => {
    t.mock.method(notifications, 'warning', () => assert.fail('Obsolete failure must stay silent'));
    for (const replacement of [null, { gameType: 'pong', pause: () => assert.fail('Replacement paused') }]) {
        for (const rejects of [false, true]) {
            const { games, events } = extensionFixture();
            const request = startDeferred();
            games.startArcadeMinute = () => request.promise.then(() => { if (rejects) throw new Error('Old request'); return null; });
            const pending = games.pauseGame(); games.stopCurrentGame(); games.currentGame = replacement;
            request.resolve(); await pending;
            assert.equal(games.currentGame, replacement); assert.deepEqual(events, ['complete', 'stop']);
            assert.equal(games.isHandlingGameMinute, false); games.destroy();
        }
    }
});

test('automatic and manual extension purchases serialize with Play and retain paid time after Stop', async () => {
    for (const method of ['pauseGame', 'requestAdditionalTime']) {
        const { games, calls } = extensionFixture(); const request = startDeferred();
        games.startArcadeMinute = () => { calls.purchases++; return request.promise; };
        const pending = games[method]();
        assert.equal(await games.startGame('pong'), false);
        assert.equal(await games.requestAdditionalTime(), false);
        await games.pauseGame(); assert.equal(calls.purchases, 1);
        games.stopCurrentGame();
        assert.equal(await games.startGame('pong'), false, 'Stop keeps purchase locked until it settles');
        request.resolve({ minuteSeconds: 60 }); await pending;
        assert.equal(games.gameTimeRemaining, 60); assert.equal(games.currentGame, null);
        assert.equal(games.isHandlingGameMinute, false); assert.equal(games.isAddingGameTime, false);
        assert.equal(await games.startGame('pong'), true); assert.equal(calls.purchases, 1);
        games.destroy();
    }
});

test('pending Play prevents both extension paths from purchasing concurrently', async () => {
    const { games, manager, calls } = extensionFixture(); const gate = startDeferred();
    manager.activities.refreshCurrentSparkGate = () => gate.promise;
    const pending = games.startGame('snake');
    assert.equal(await games.requestAdditionalTime(), false); await games.pauseGame();
    assert.equal(calls.purchases, 0); gate.resolve(); await pending;
    assert.equal(calls.purchases, 1); games.destroy();
});

test('stale extension success and finally cannot credit a new account or unlock its pending Play', async () => {
    const { games, manager } = extensionFixture(); const request = startDeferred();
    games.startArcadeMinute = () => request.promise;
    const pending = games.pauseGame(); manager.currentUser = { uid: 'replacement' };
    request.resolve({ minuteSeconds: 60 }); await pending;
    assert.equal(games.gameTimeRemaining, 0); games.destroy();

    const old = extensionFixture(), next = startFixture(), oldRequest = startDeferred(), gate = startDeferred();
    const originalQuery = document.querySelector; const button = { disabled: false, setAttribute() {} };
    document.querySelector = selector => selector === '#play-current-game-btn' ? button : null;
    try {
        old.games.startArcadeMinute = () => oldRequest.promise;
        const oldPending = old.games.requestAdditionalTime(); old.games.destroy();
        next.manager.activities.refreshCurrentSparkGate = () => gate.promise;
        const nextPending = next.games.startGame('pong'); assert.equal(button.disabled, true);
        oldRequest.resolve({ minuteSeconds: 60 }); await oldPending;
        assert.equal(button.disabled, true); assert.equal(old.games.gameTimeRemaining, 0);
        gate.resolve(); await nextPending;
    } finally { document.querySelector = originalQuery; next.games.destroy(); }
});

test('automatic extension delayed timer feedback cannot overwrite a new game timer', async (t) => {
    const { games } = extensionFixture(); const callbacks = [];
    const timer = { style: { color: 'white' }, textContent: '' };
    t.mock.method(document, 'querySelector', selector => selector === '#game-timer' ? timer : null);
    t.mock.method(globalThis, 'setTimeout', callback => { callbacks.push(callback); return 1; });
    await games.pauseGame(); assert.equal(games.gameTimeRemaining, 60);
    games.stopCurrentGame(); games.currentGame = { gameType: 'pong' };
    timer.style.color = 'purple'; timer.textContent = 'Replacement timer';
    callbacks.forEach(callback => callback());
    assert.equal(timer.style.color, 'purple'); assert.equal(timer.textContent, 'Replacement timer');
    games.destroy();
});

test('current automatic extension and failures preserve valid continuation and selection behavior', async (t) => {
    t.mock.method(notifications, 'warning', () => {});
    const { games, events } = extensionFixture();
    games.startArcadeMinute = async () => null;
    await games.pauseGame(); assert.deepEqual(events, ['complete', 'pause', 'stop', 'selection']);
    assert.equal(games.currentGame, null); assert.equal(games.isHandlingGameMinute, false);
    games.destroy();
});

test('Stop from minute completion prevents extension dispatch and UI await cannot remove replacement game', async (t) => {
    t.mock.method(notifications, 'warning', () => assert.fail('Obsolete extension must stay silent'));
    const early = extensionFixture();
    early.games.currentGame.completeMinute = () => early.games.stopCurrentGame();
    await early.games.pauseGame(); assert.equal(early.calls.purchases, 0); early.games.destroy();
    for (const method of ['pauseGame', 'requestAdditionalTime']) {
        const { games } = extensionFixture(); const ui = startDeferred(); let refreshing = false;
        games.updateArcadeUI = () => { refreshing = true; return ui.promise; };
        const pending = games[method](); while (!refreshing) await Promise.resolve();
        games.stopCurrentGame(); const replacement = { gameType: 'pong' }; games.currentGame = replacement;
        ui.resolve(); await pending;
        assert.equal(games.currentGame, replacement); assert.equal(games.gameTimeRemaining, 60);
        games.destroy();
    }
});

const { Snake } = await import('../js/games/snake.js');
test('late actual canvas module cannot start after same-owner school scope changes',async t=>{
 const elements=new Map([['#game-selection',{classList:{add(){},remove(){}}}],['#game-stage',{classList:{add(){},remove(){}},style:{removeProperty(){}}}],['#game-canvas',{width:400,height:400,style:{},getContext:()=>({}),addEventListener(){}}]]);
 t.mock.method(document,'querySelector',s=>elements.get(s)||null);
 let starts=0;t.mock.method(Snake.prototype,'start',()=>{starts++;});
 const sm={authDisabled:false,currentUser:{uid:'student'},activities:{getPendingRequiredWork:()=>({isBlocked:false}),vocabularyData:{async loadClassSelection(){},classSelection:{ready:true,owner:'student',generation:1,readySchoolGeneration:schoolContext.getGeneration()}}}};
 const games=new StudentGames(sm);games.lifecycle.startGameTimer=()=>{};
 try{
  assert.equal(await games.launchGame('snake'),true);
  schoolContext.clear();
  await new Promise(r=>setImmediate(r));
  assert.equal(starts,0,'late module must honor invalidated eligibility school scope');
 }finally{games.cleanupCurrentGame({saveScore:false});}
});
