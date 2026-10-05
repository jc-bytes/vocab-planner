import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const manifest = JSON.parse(await readFile('dist-desktop/.vite/manifest.json', 'utf8'));
const host = '127.0.0.1';
const port = Number(process.env.UI_ARCADE_PORT || 8136);
const baseUrl = (process.env.UI_ARCADE_BASE_URL || `http://${host}:${port}`).replace(/\/$/, '');
const server = await ensureViteServer({
    baseUrl, probePath: '/student.html', host, port,
    external: Boolean(process.env.UI_ARCADE_BASE_URL),
    args: ['vite', 'preview', '--host', host, '--port', String(port), '--strictPort']
});
const browser = await chromium.launch();
const failures = [];
const spriteFiles = [
    ...['background-day', 'base', 'yellowbird-upflap', 'yellowbird-midflap', 'yellowbird-downflap', 'pipe-green', 'gameover']
        .map(name => `js/games/flappy-bird-sprites/${name}.png`),
    ...Array.from({ length: 45 }, (_, index) => `js/games/whack-a-mol-assets/tile${String(index).padStart(3, '0')}.png`)
];
async function check(name, callback) {
    try {
        await callback();
        console.log(`PASS ${name}`);
    } catch (error) {
        failures.push(`${name}: ${error.message}`);
        console.error(`FAIL ${name}: ${error.message}`);
    }
}
async function gamePage(moduleName, exportName, width = 800) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${baseUrl}/student.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async ({ moduleUrl, exportName, width }) => {
        document.body.innerHTML = `<canvas width="800" height="600" style="width:${width}px;height:${width * 0.75}px"></canvas>`;
        const module = await import(moduleUrl);
        window.arcadeTestGame = new module[exportName](document.querySelector('canvas'), () => {});
    }, { moduleUrl: `${baseUrl}/${manifest[`js/games/${moduleName}.js`].file}`, exportName, width });
    return { page, errors };
}

try {
    await check('all 52 canvas sprites are published as images', async () => {
        const missing = (await Promise.all(spriteFiles.map(async path => {
            const response = await fetch(`${baseUrl}/${path}`);
            return response.ok && response.headers.get('content-type')?.startsWith('image/') ? null : path;
        }))).filter(Boolean);
        assert.deepEqual(missing, [], `Missing sprite files: ${missing.join(', ')}`);
    });

    for (const missingSprites of [false, true]) {
        await check(`Flappy Bird animates with ${missingSprites ? 'failed' : 'loaded'} sprites`, async () => {
            const { page, errors } = await gamePage('flappyBird', 'FlappyBird');
            try {
                await page.waitForFunction(() => arcadeTestGame.spritesLoaded >= arcadeTestGame.totalSprites);
                if (missingSprites) {
                    // Force the real Image error path, independent of cache and load timing.
                    await page.route('**/flappy-bird-sprites/*.png', route => route.abort());
                    await page.evaluate(() => {
                        arcadeTestGame.spritesLoaded = 0;
                        arcadeTestGame.loadSprites();
                    });
                }
                await page.waitForFunction(() => arcadeTestGame.spritesLoaded >= arcadeTestGame.totalSprites);
                await page.evaluate(() => {
                    window.arcadeTestDraws = 0;
                    const draw = arcadeTestGame.draw.bind(arcadeTestGame);
                    arcadeTestGame.draw = () => { arcadeTestDraws++; draw(); };
                    arcadeTestGame.pipes = [{ x: 700, topHeight: 100, bottomY: 250 }];
                    arcadeTestGame.start();
                });
                await page.waitForTimeout(600);
                const state = await page.evaluate(() => ({ draws: arcadeTestDraws, running: arcadeTestGame.isRunning }));
                assert.deepEqual(errors, []);
                assert.ok(state.running && state.draws > 2, `Animation stopped: ${JSON.stringify(state)}`);
            } finally {
                await page.evaluate(() => arcadeTestGame.stop());
                await page.close();
            }
        });
    }

    for (const width of [800, 600, 400]) {
        await check(`Whack-a-Mole hits the visible mole at ${width}px`, async () => {
            const { page, errors } = await gamePage('whackAMole', 'WhackAMole', width);
            try {
                // Pin one ordinary mole at the last hole; no random spawning or timing.
                await page.evaluate(() => {
                    arcadeTestGame.isRunning = true;
                    arcadeTestGame.spawnMole('normal');
                    Object.assign(arcadeTestGame.moles[0], { holeIndex: 8, type: 'normal' });
                    arcadeTestGame.draw();
                });
                const point = await page.evaluate(() => {
                    const hole = arcadeTestGame.holes[8];
                    const rect = arcadeTestGame.canvas.getBoundingClientRect();
                    return {
                        x: rect.left + (hole.x + hole.size / 2) * rect.width / arcadeTestGame.canvas.width,
                        y: rect.top + (hole.y + hole.size / 2) * rect.height / arcadeTestGame.canvas.height
                    };
                });
                await page.mouse.click(point.x, point.y);
                assert.equal(await page.evaluate(() => arcadeTestGame.score), 10);
                assert.deepEqual(errors, []);
            } finally {
                await page.evaluate(() => arcadeTestGame.stop());
                await page.close();
            }
        });
    }
} finally {
    await browser.close();
    server?.kill();
}
if (failures.length) throw new Error(failures.join('\n'));
console.log('Built Arcade gameplay checks passed.');
