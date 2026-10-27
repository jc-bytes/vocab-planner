import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installStudentAssignedFlowFixture } from './lib/student-assigned-flow-fixture.mjs';

const port = Number(process.env.UI_ARCADE_LAYOUT_PORT || 19860);
const baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_ARCADE_LAYOUT_DIST === '1';
let server, browser;

async function selectedCard(page) {
    return page.evaluate(() => {
        const card = document.getElementById('current-game-card');
        const bounds = card.getBoundingClientRect();
        const inside = rect => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1
            && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1;
        const content = [...card.querySelectorAll('h3, p, .game-cost span, .game-cost strong, #play-current-game-btn, .game-icon, .game-art, .game-counter')];
        return {
            gameId: studentApp.routing.games.gamesList[studentApp.routing.games.currentGameIndex].id,
            title: card.querySelector('h3').textContent,
            overflow: card.scrollWidth - card.clientWidth,
            content: content.map(element => {
                const range = document.createRange();
                range.selectNodeContents(element);
                return { text: element.textContent.trim(), fits: inside(element.getBoundingClientRect())
                    && [...range.getClientRects()].every(inside) };
            }),
            controls: [...document.querySelectorAll('.game-select-nav-btn, #play-current-game-btn')].map(element => {
                const rect = element.getBoundingClientRect();
                return { id: element.id, width: rect.width, height: rect.height,
                    onScreen: rect.left >= 0 && rect.right <= innerWidth };
            })
        };
    });
}

async function assertSelectedCard(page, width) {
    // A completed click can leave the 0.99 press transform transitioning back.
    // Measure resting layout after actual finite feedback animations settle.
    await page.evaluate(async () => {
        const animations = [...document.querySelectorAll('.game-select-nav-btn, #current-game-card')]
            .flatMap(element => element.getAnimations({ subtree: true }))
            .filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime));
        let deadline;
        try {
            await Promise.race([
                Promise.all(animations.map(animation => animation.finished.catch(() => {}))),
                new Promise((_, reject) => {
                    deadline = setTimeout(() => reject(new Error('Arcade layout feedback did not settle')), 2000);
                })
            ]);
        } finally { clearTimeout(deadline); }
    });
    const state = await selectedCard(page);
    // Grid tracks can extend into padding without clipping actual content.
    // Check every visible box/text line instead of treating scrollWidth as proof.
    assert.ok(state.content.every(item => item.fits), `${width}px ${state.title}: selected text, artwork, counter and controls must fit in two dimensions`);
    assert.ok(state.controls.every(control => control.width >= 44 && control.height >= 44 && control.onScreen),
        `${width}px ${state.title}: Play and both carousel arrows must remain usable touch targets: ${JSON.stringify(state.controls)}`);
    return state;
}

async function assertReachable(page, selector) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    assert.equal(await page.locator(selector).evaluate(element => {
        const rect = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }), true, `${selector} must remain reachable after scrolling`);
}

async function assertTextVisible(page, width, title) {
    const parts = page.locator('#current-game-card h3, #current-game-card p, #current-game-card .game-cost span, #current-game-card .game-cost strong');
    for (const part of await parts.all()) {
        await part.scrollIntoViewIfNeeded();
        assert.equal(await part.evaluate(element => {
            const range = document.createRange();
            range.selectNodeContents(element);
            return [...range.getClientRects()].filter(rect => rect.width && rect.height).every(rect => {
                const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
                return x >= 0 && x < innerWidth && y >= 0 && y < innerHeight
                    && element.contains(document.elementFromPoint(x, y));
            });
        }), true, `${width}px ${title}: each text line must remain visible through clipping ancestors after scrolling`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
}

try {
    server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    for (const width of [320, 360, 390, 430, 760, 761, 768, 820, 1024, 1280]) {
        const page = await browser.newPage({ viewport: { width, height: 480 } });
        const fixture = await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
        await page.goto(`${baseUrl}/student.html#/arcade`);
        await page.waitForFunction(() => window.studentApp?.authInitialized && !studentApp.routing.isApplyingRoute
            && document.querySelector('#play-current-game-btn'));
        await page.evaluate(() => document.fonts.ready);
        const count = await page.evaluate(() => studentApp.routing.games.gamesList.length);
        assert.equal(count, 20, 'Exercise every registered game, rather than a convenient sample');
        const visited = new Set();
        for (let index = 0; index < count; index++) {
            const state = await assertSelectedCard(page, width);
            visited.add(state.gameId);
            await assertTextVisible(page, width, state.title);
            await assertReachable(page, '#play-current-game-btn');
            await page.locator('#next-game-select-btn').click();
            await page.waitForFunction(previous => document.querySelector('#current-game-card h3').textContent !== previous, state.title);
        }
        assert.equal(visited.size, count, 'Traversal must visit every distinct registered game');
        await page.evaluate(async () => {
            const games = studentApp.routing.games;
            games.gameTimeRemaining = 60;
            await games.updateGameSelectionUI();
        });
        assert.match(await page.locator('#play-current-game-btn').innerText(), /Resume/);
        await assertSelectedCard(page, width);
        await assertTextVisible(page, width, 'Resume');
        for (const selector of ['#prev-game-select-btn', '#next-game-select-btn', '#play-current-game-btn']) {
            await assertReachable(page, selector);
        }
        await page.locator('#prev-game-select-btn').click();
        await page.waitForFunction(() => studentApp.routing.games.currentGameIndex === 19);
        await page.locator('#next-game-select-btn').click();
        await page.waitForFunction(() => studentApp.routing.games.currentGameIndex === 0);
        await assertSelectedCard(page, width);
        assert.deepEqual(fixture.errors, []);
        console.log(`${width}px: all ${count} games and Resume fit; Play text, touch targets and both carousel directions remain reachable`);
        await page.close();
    }
} finally { await browser?.close(); server?.kill(); }
