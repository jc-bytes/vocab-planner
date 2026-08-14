import assert from 'node:assert/strict';
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
    removeEventListener() {}
};

const { StudentGames } = await import('../js/student/studentGames.js');
const { StudentManager } = await import('../js/student.js');
const { StudentGameHtmlLoader } = await import('../js/student/studentGameHtmlLoaderMethods.js');
const { StudentGameLeaderboard } = await import('../js/student/studentGameLeaderboardMethods.js');
const { StudentGameLifecycle } = await import('../js/student/studentGameLifecycleMethods.js');
const { StudentGameScoreMonitor } = await import('../js/student/studentGameScoreMonitor.js');
const { StudentGameSettings } = await import('../js/student/studentGameSettingsMethods.js');

test('StudentGames owns explicit game components', () => {
    const manager = {};
    const games = new StudentGames(manager);

    assert.equal(games.sm, manager);
    assert.ok(games.settings instanceof StudentGameSettings);
    assert.ok(games.leaderboard instanceof StudentGameLeaderboard);
    assert.ok(games.htmlLoader instanceof StudentGameHtmlLoader);
    assert.ok(games.htmlLoader.scoreMonitor instanceof StudentGameScoreMonitor);
    assert.ok(games.lifecycle instanceof StudentGameLifecycle);
    assert.equal(games.settings.games, games);
    assert.equal(games.lifecycle.games, games);
    assert.equal(games.htmlLoader.scoreMonitor.htmlLoader, games.htmlLoader);
    assert.equal(games.currentGame, null);
    assert.equal(games.gameTimeRemaining, 0);
    assert.equal(games.gameTimerInterval, null);
    assert.equal(games.isHandlingGameMinute, false);
    assert.equal(games.currentGameIndex, 0);
    assert.ok(games.gamesList.length > 0);
    assert.equal(games.currentGameScore, 0);
    assert.equal(games.currentGameMetadata, null);
    assert.equal(games.lastSavedScore, 0);
    assert.equal(games.isGamePaused, false);
    for (const state of [
        'currentGame',
        'gameTimeRemaining',
        'gameTimerInterval',
        'isHandlingGameMinute',
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
        'updateArcadeUI',
        'updateGameSelectionUI',
        'saveHighScore',
        'updateLeaderboardGame',
        'showLeaderboardModal',
        'hideLeaderboardModal',
        'loadLeaderboard',
        'loadHTMLGame',
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

test('StudentGames delegates to the owning component', async () => {
    const games = new StudentGames({});
    const calls = [];
    games.lifecycle.startGame = async type => calls.push(['startGame', type]);
    games.leaderboard.saveHighScore = async (...args) => calls.push(['saveHighScore', ...args]);

    await games.startGame('snake');
    await games.saveHighScore('snake', 25, { level: 2 });

    assert.deepEqual(calls, [
        ['startGame', 'snake'],
        ['saveHighScore', 'snake', 25, { level: 2 }]
    ]);
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
