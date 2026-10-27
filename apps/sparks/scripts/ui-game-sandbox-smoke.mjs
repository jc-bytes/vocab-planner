import process from 'node:process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

import { ensureViteServer } from './lib/local-vite-server.mjs';
import { STUDENT_GAME_REGISTRY } from '../js/student/studentGameRegistry.js';
import { getStudentStorageKey } from '../js/student/persistence/studentStorage.js';

const host = process.env.UI_GAME_SANDBOX_HOST || '127.0.0.1';
const port = Number(process.env.UI_GAME_SANDBOX_PORT || 8124);
const baseUrl = (process.env.UI_GAME_SANDBOX_BASE_URL || `http://${host}:${port}`).replace(/\/$/, '');
const htmlGames = STUDENT_GAME_REGISTRY.filter(game => game.launch.mode === 'html');
const server = await ensureViteServer({
    baseUrl,
    probePath: '/student.html',
    host,
    port,
    external: Boolean(process.env.UI_GAME_SANDBOX_BASE_URL)
});

let browser = null;
try {
    browser = await chromium.launch();
    const startPage = await browser.newPage();
    await startPage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    const starts = await startPage.evaluate(async () => {
        const { StudentGames } = await import('/js/student/studentGames.js');
        const { StudentClassSelection } = await import('/js/student/studentClassSelection.js');
        const { schoolContext } = await import('/js/services/schoolContext.js');
        const waitFor = async (condition, label) => {
            const deadline = performance.now() + 3000;
            while (!condition()) {
                if (performance.now() >= deadline) throw new Error(`Sandbox start fixture did not reach ${label}.`);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        };
        document.body.innerHTML = '<main><div id="current-game-card"></div><div id="game-selection"></div><div id="game-stage"><canvas id="game-canvas"></canvas></div><div id="game-timer"></div><button id="add-time-btn"></button></main>';
        let gate, releasePurchase, purchases = 0; const launches = [];
        const manager = { currentUser: { uid: 'arcade-start-smoke' }, authDisabled: false, coins: 100,
            progress: { cloud: { cloudGeneration: 1 } }, routing: { arcadeReadController: new AbortController() },
            activities: { refreshCurrentSparkGate: () => new Promise(resolve => { gate = resolve; }), getPendingRequiredWork: () => ({ isBlocked: false }) },
            addListener: (selector, event, listener) => document.querySelector(selector).addEventListener(event, listener) };
        // Exercise real confirmed-empty class readiness, not an unloaded list.
        // Only the repository boundary is synthetic; the eligibility gate stays real.
        let classReads = 0;
        const selection = new StudentClassSelection(manager, { async listMyClasses() { classReads++; return []; } });
        manager.activities.vocabularyData = { classSelection: selection, loadClassSelection: options => selection.load(options) };
        const games = new StudentGames(manager); games.gameTimeRemaining = 0;
        games.settings.loadGlobalSettings = async () => { games.settings.globalSettings = { exchangeRate: 10 }; };
        games.loadArcadeTime = async () => {}; games.getAvailableArcadeSeconds = () => 300;
        games.startArcadeMinute = async () => { purchases++; return { minuteSeconds: 60 }; };
        games.updateArcadeUI = async () => {};
        games.lifecycle.launchGame = (type, options) => { launches.push({ type, options }); return true; };
        await games.updateGameSelectionUI(); document.querySelector('#play-current-game-btn').click();
        const disabledOnClick = document.querySelector('#play-current-game-btn').disabled;
        const duplicateRejected = await games.startGame('snake') === false;
        await games.updateGameSelectionUI(); const disabledAfterRerender = document.querySelector('#play-current-game-btn').disabled;
        await waitFor(() => typeof gate === 'function', 'the held Spark gate after class readiness');
        if (!selection.ready || selection.owner !== manager.currentUser.uid
            || selection.readySchoolGeneration !== schoolContext.getGeneration() || classReads !== 1) {
            throw new Error('Sandbox start fixture did not confirm the current owner/school class read.');
        }
        gate(); await waitFor(() => !games.isStartingGame, 'the first purchase and launch');
        const onePurchase = purchases === 1 && launches.length === 1 && games.gameTimeRemaining === 60;
        const unlocked = !document.querySelector('#play-current-game-btn').disabled;
        games.gameTimeRemaining = 0; manager.activities.refreshCurrentSparkGate = async () => {};
        games.startArcadeMinute = () => { purchases++; return new Promise(resolve => { releasePurchase = resolve; }); };
        const pending = games.startGame('snake'); await waitFor(() => typeof releasePurchase === 'function', 'the held purchase');
        games.stopCurrentGame(); const stoppedDuplicateRejected = await games.startGame('pong') === false;
        releasePurchase({ minuteSeconds: 60 }); const stopped = await pending === false && launches.length === 1 && games.gameTimeRemaining === 60;
        const paidResumeLabel = document.querySelector('#play-current-game-btn').textContent.includes('Resume (1m 0s)');
        const resumed = await games.startGame('pong') === true && purchases === 2 && launches.at(-1).options.resetTimer === false;
        let releaseExtension;
        games.currentGame = { gameType: 'snake', pause() { throw new Error('Obsolete game paused'); }, stop() {} };
        games.gameTimeRemaining = 0;
        games.startArcadeMinute = () => new Promise(resolve => { releaseExtension = resolve; });
        const extension = games.pauseGame();
        const extensionPlayLocked = document.querySelector('#play-current-game-btn').disabled && await games.startGame('pong') === false;
        const manualExtensionLocked = await games.requestAdditionalTime() === false;
        await games.updateGameSelectionUI();
        const extensionRerenderLocked = document.querySelector('#play-current-game-btn').disabled;
        games.stopCurrentGame(); const replacement = { gameType: 'pong', pause() { throw new Error('Replacement paused'); }, stop() {} };
        games.currentGame = replacement; releaseExtension(null); await extension;
        const replacementSurvives = games.currentGame === replacement && !games.isHandlingGameMinute;
        games.currentGame = { gameType: 'snake', stop() {} };
        const paidExtension = games.pauseGame(); games.stopCurrentGame();
        releaseExtension({ minuteSeconds: 60 }); await paidExtension;
        const extensionPaidResume = games.gameTimeRemaining === 60 && games.currentGame === null
            && document.querySelector('#play-current-game-btn').textContent.includes('Resume (1m 0s)');
        games.destroy();
        return { disabledOnClick, duplicateRejected, disabledAfterRerender, onePurchase, unlocked, stoppedDuplicateRejected, stopped, paidResumeLabel, resumed, extensionPlayLocked, manualExtensionLocked, extensionRerenderLocked, replacementSurvives, extensionPaidResume };
    });
    assert.deepEqual(starts, { disabledOnClick: true, duplicateRejected: true, disabledAfterRerender: true,
        onePurchase: true, unlocked: true, stoppedDuplicateRejected: true, stopped: true, paidResumeLabel: true, resumed: true, extensionPlayLocked: true, manualExtensionLocked: true, extensionRerenderLocked: true, replacementSurvives: true, extensionPaidResume: true });
    await startPage.close();
    for (const game of htmlGames) {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => {
            document.body.innerHTML = '<main id="game-stage"><canvas id="game-canvas"></canvas></main>';
        });
        await page.evaluate(async ({ id, path, scoreMessageType }) => {
            const { StudentGameHtmlLoader } = await import('/js/student/studentGameHtmlLoaderMethods.js');
            const games = {
                sm: {},
                currentGame: null,
                currentGameMetadata: null,
                currentGameScore: 0,
                lastSavedScore: 0,
                saveHighScore: async () => {}
            };
            const loader = new StudentGameHtmlLoader(games);
            await loader.loadHTMLGame(
                id,
                path,
                scoreMessageType,
                () => {},
                document.querySelector('#game-canvas'),
                document.querySelector('#game-stage')
            );
        }, {
            id: game.id,
            path: game.launch.path,
            scoreMessageType: game.launch.scoreMessageType
        });

        const iframe = page.locator(`#${game.id}-iframe`);
        await iframe.waitFor({ state: 'attached', timeout: 10000 });
        const expectedPath = game.launch.path;
        await page.waitForFunction(path => Array.from(document.querySelectorAll('iframe'))
            .some(element => decodeURI(element.src).includes(path)), expectedPath);
        let frame = null;
        const frameDeadline = Date.now() + 10000;
        while (!frame && Date.now() < frameDeadline) {
            frame = page.frames().find(candidate => decodeURI(candidate.url()).includes(expectedPath)) || null;
            if (!frame) await page.waitForTimeout(50);
        }
        if (!frame) throw new Error(`${game.id} did not create a navigated game frame.`);
        await frame.waitForTimeout(900);

        const storageKey = getStudentStorageKey(`game-storage:${game.id}`, 'local-dev');
        await frame.evaluate(() => localStorage.setItem('sandbox-smoke', 'saved'));
        await page.waitForFunction(key => localStorage.getItem(key)?.includes('sandbox-smoke'), storageKey);
        const isolation = await iframe.evaluate(element => ({
            sandbox: element.getAttribute('sandbox'),
            parentCannotReadDocument: element.contentDocument === null
        }));
        if (isolation.sandbox?.includes('allow-same-origin') || !isolation.parentCannotReadDocument) {
            throw new Error(`${game.id} is not isolated from the parent application origin.`);
        }
        if (errors.length) {
            throw new Error(`${game.id} emitted browser errors:\n${errors.join('\n')}`);
        }
        await page.close();
    }
    console.log(`Sandbox smoke passed for ${htmlGames.length} HTML games.`);
} finally {
    await browser?.close().catch(() => {});
    server?.kill();
}
