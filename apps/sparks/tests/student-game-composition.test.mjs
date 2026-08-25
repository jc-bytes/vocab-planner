import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
const { StudentManager } = await import('../js/student.js');
const { StudentGameHtmlLoader } = await import('../js/student/studentGameHtmlLoaderMethods.js');
const { StudentGameLeaderboard } = await import('../js/student/studentGameLeaderboardMethods.js');
const { StudentGameLifecycle } = await import('../js/student/studentGameLifecycleMethods.js');
const {
    ARCADE_MINUTE_SECONDS,
    FORMATIVE_PASS_SECONDS,
    MAX_QUEUED_ARCADE_SECONDS
} = await import('../js/student/studentArcadePolicy.js');
const { StudentGameScoreMonitor } = await import('../js/student/studentGameScoreMonitor.js');
const { StudentGameSettings } = await import('../js/student/studentGameSettingsMethods.js');
const { StudentGameAccess } = await import('../js/student/studentGameAccessMethods.js');
const { readLocalArcadeSession, writeLocalArcadeSession, writeLocalArcadeTime } = await import('../js/student/studentArcadeTimeStorage.js');
const { refreshLocalFormativeWindow } = await import('../js/student/studentArcadeTimeStorage.js');
const { supabaseService } = await import('../js/supabaseService.js');
const legacyScoreBridgeSource = await readFile(
    new URL('../js/games/legacy-score-bridge.js', import.meta.url), 'utf8'
);

test('StudentGames owns explicit game components', () => {
    const manager = {};
    const games = new StudentGames(manager);

    assert.equal(games.sm, manager);
    assert.ok(games.settings instanceof StudentGameSettings);
    assert.ok(games.access instanceof StudentGameAccess);
    assert.ok(games.leaderboard instanceof StudentGameLeaderboard);
    assert.ok(games.htmlLoader instanceof StudentGameHtmlLoader);
    assert.ok(games.htmlLoader.scoreMonitor instanceof StudentGameScoreMonitor);
    assert.ok(games.lifecycle instanceof StudentGameLifecycle);
    assert.equal(games.settings.games, games);
    assert.equal(games.access.games, games);
    assert.equal(games.lifecycle.games, games);
    assert.equal(games.htmlLoader.scoreMonitor.htmlLoader, games.htmlLoader);
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

test('legacy game score discovery caches the first matching global', () => {
    assert.match(legacyScoreBridgeSource, /let cachedGame = null/);
    assert.match(legacyScoreBridgeSource, /if \(cachedGame\?\.levelStats\) return cachedGame/);
    assert.match(legacyScoreBridgeSource, /if \(!cachedGame \|\| cachedGame\.score === undefined\)/);
});

test('StudentGames runtime state is isolated per instance', () => {
    const first = new StudentGames({});
    const second = new StudentGames({});

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
        'selectAdjacentGame',
        'startGame',
        'stopCurrentGame',
        'pauseGame',
        'addGameTime',
        'updateGameTimer'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentGames.prototype, method),
            true,
            `${method} must be declared by StudentGames`
        );
    }
});

test('game selection navigation owns index wrapping and coordinated refresh', () => {
    const calls = [];
    const games = new StudentGames({});
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
    const games = new StudentGames({});
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
    const games = new StudentGames({
        authDisabled: false,
        currentUser: { uid: 'student-1' },
        studentProfile: { grade: '7' }
    });
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
    const games = new StudentGames({
        authDisabled: false,
        currentUser: { uid: 'student-2' },
        studentProfile: { grade: '7' }
    });
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
    const games = new StudentGames(manager);
    games.loadGlobalSettings = async () => calls.push(['loadGlobalSettings']);
    games.loadArcadeTime = async () => calls.push(['loadArcadeTime']);

    const started = await games.startGame('snake');

    assert.equal(started, false);
    assert.deepEqual(calls, [
        ['gate', access],
        ['navigateTo', { view: 'arcade' }]
    ]);
});

test('direct game launch is rejected while required work is pending', () => {
    const access = { isBlocked: true, remainingActivities: 1 };
    const manager = {
        activities: {
            getPendingRequiredWork: () => access,
            updateArcadeGateDisplay() {}
        }
    };
    const games = new StudentGames(manager);

    assert.equal(games.launchGame('snake'), false);
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
    const games = new StudentGames(manager);
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
    const games = new StudentGames({
        authDisabled: true,
        progress: { async deductCoins() { charged = true; return true; } }
    });
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
    const games = new StudentGames({});
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

    const restored = new StudentGames({ currentUser: { uid: 'student-1' } });

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

    const games = new StudentGames({
        currentUser: { uid: 'student-2' },
        coins: 0,
        activities: {
            async refreshCurrentSparkGate() {},
            getPendingRequiredWork: () => ({ isBlocked: false })
        }
    });
    games.loadGlobalSettings = async () => ({ exchangeRate: 10 });
    games.loadArcadeTime = async () => ({ availableSeconds: 0 });
    games.startArcadeMinute = async () => { throw new Error('must not charge'); };
    let launched = null;
    games.lifecycle.launchGame = (gameId, options) => { launched = { gameId, options }; return true; };

    assert.equal(await games.startGame('snake'), true);
    assert.deepEqual(launched, { gameId: 'snake', options: { resetTimer: false } });
    assert.equal(games.gameTimeRemaining, 180);
});
