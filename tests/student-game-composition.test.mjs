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

const { StudentGames } = await import('../js/student/studentGames.js');
const { StudentManager } = await import('../js/student.js');
const { StudentGameHtmlLoader } = await import('../js/student/studentGameHtmlLoaderMethods.js');
const { StudentGameLeaderboard } = await import('../js/student/studentGameLeaderboardMethods.js');
const { StudentGameLifecycle } = await import('../js/student/studentGameLifecycleMethods.js');
const { StudentGameSettings } = await import('../js/student/studentGameSettingsMethods.js');

test('StudentGames owns explicit game components', () => {
    const manager = {};
    const games = new StudentGames(manager);

    assert.equal(games.sm, manager);
    assert.ok(games.settings instanceof StudentGameSettings);
    assert.ok(games.leaderboard instanceof StudentGameLeaderboard);
    assert.ok(games.htmlLoader instanceof StudentGameHtmlLoader);
    assert.ok(games.lifecycle instanceof StudentGameLifecycle);
    assert.equal(games.settings.games, games);
    assert.equal(games.lifecycle.games, games);
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

test('StudentManager declares the stable game compatibility interface directly', () => {
    for (const method of [
        'formatTime',
        'updateArcadeUI',
        'updateGameSelectionUI',
        'saveHighScore',
        'updateLeaderboardGame',
        'loadLeaderboard',
        'loadHTMLGame',
        'startGame',
        'stopCurrentGame',
        'pauseGame',
        'addGameTime',
        'updateGameTimer'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentManager.prototype, method),
            true,
            `${method} must be declared by StudentManager`
        );
    }
});

test('StudentManager game compatibility methods preserve lazy loading, arguments, and defaults', async () => {
    const manager = Object.create(StudentManager.prototype);
    const calls = [];
    const games = new Proxy({}, {
        get(_target, method) {
            if (method === 'then') return undefined;
            return (...args) => {
                calls.push([method, ...args]);
                return method;
            };
        }
    });
    let loadCount = 0;
    manager.getGames = async () => {
        loadCount += 1;
        return games;
    };
    const gameOver = () => {};
    const canvas = {};
    const stage = {};

    assert.equal(await manager.formatTime(125), 'formatTime');
    assert.equal(await manager.updateArcadeUI(), 'updateArcadeUI');
    assert.equal(await manager.updateGameSelectionUI(), 'updateGameSelectionUI');
    assert.equal(await manager.saveHighScore('snake', 25), 'saveHighScore');
    assert.equal(await manager.updateLeaderboardGame(), 'updateLeaderboardGame');
    assert.equal(await manager.loadLeaderboard('snake'), 'loadLeaderboard');
    assert.equal(
        await manager.loadHTMLGame('snake', 'snake.html', 'score', gameOver, canvas, stage),
        'loadHTMLGame'
    );
    assert.equal(await manager.startGame('snake'), 'startGame');
    assert.equal(await manager.stopCurrentGame(), 'stopCurrentGame');
    assert.equal(await manager.pauseGame(), 'pauseGame');
    assert.equal(await manager.addGameTime(), 'addGameTime');
    assert.equal(await manager.updateGameTimer(), 'updateGameTimer');

    assert.equal(loadCount, 12);
    assert.deepEqual(calls, [
        ['formatTime', 125],
        ['updateArcadeUI'],
        ['updateGameSelectionUI'],
        ['saveHighScore', 'snake', 25, null],
        ['updateLeaderboardGame'],
        ['loadLeaderboard', 'snake'],
        ['loadHTMLGame', 'snake', 'snake.html', 'score', gameOver, canvas, stage],
        ['startGame', 'snake'],
        ['stopCurrentGame'],
        ['pauseGame'],
        ['addGameTime', 60],
        ['updateGameTimer']
    ]);
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
