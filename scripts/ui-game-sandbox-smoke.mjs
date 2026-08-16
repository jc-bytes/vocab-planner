import process from 'node:process';
import { chromium } from 'playwright';

import { ensureViteServer } from './lib/local-vite-server.mjs';
import { STUDENT_GAME_REGISTRY } from '../js/student/studentGameRegistry.js';

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

        const storageKey = `vocab-game-storage:${game.id}`;
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
