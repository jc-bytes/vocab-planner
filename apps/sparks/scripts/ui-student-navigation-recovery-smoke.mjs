import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installStudentAssignedFlowFixture } from './lib/student-assigned-flow-fixture.mjs';

const port = Number(process.env.UI_STUDENT_NAVIGATION_PORT || 19856);
const baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_STUDENT_NAVIGATION_DIST === '1';
let server, browser;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    const page = await browser.newPage();
    const fixture = await installStudentAssignedFlowFixture(page);
    await page.addInitScript(() => {
        window.navigationRecoveryTrace = [];
        const replace = history.replaceState;
        history.replaceState = function(state, title, url) {
            navigationRecoveryTrace.push({
                route: String(url || '').split('#')[1]?.replace(/[0-9a-f-]{36}/gi, '<assignment>'),
                stack: new Error().stack.split('\n').slice(1, 8).join('\n')
            });
            return replace.apply(this, arguments);
        };
    });
    const activityHash = `#/unit/assignment.${fixture.ids.assignment}/activity/flashcards`;
    await page.goto(`${baseUrl}/student.html${activityHash}`);
    await page.waitForFunction(() => window.studentApp?.authInitialized && !studentApp.routing.isApplyingRoute && !!studentApp.activityInstance);
    try { assert.equal(new URL(page.url()).hash, activityHash); }
    catch (error) { console.error('Safe route-only history trace:', JSON.stringify(await page.evaluate(() => navigationRecoveryTrace))); throw error; }
    await page.reload();
    await page.waitForFunction(() => window.studentApp?.authInitialized && !studentApp.routing.isApplyingRoute && !!studentApp.activityInstance);
    assert.equal(new URL(page.url()).hash, activityHash);
    assert.deepEqual(fixture.errors, []);
    await page.close();

    const race = await browser.newPage();
    const delayed = await installStudentAssignedFlowFixture(race, { completeRequiredActivities: true });
    delayed.holdReads();
    await race.goto(`${baseUrl}/student.html#/units`);
    await race.waitForFunction(() => window.studentApp?.currentUser);
    for (let attempt = 0; attempt < 100 && !delayed.hasPendingRead(); attempt++) await race.waitForTimeout(20);
    assert.ok(delayed.hasPendingRead());
    await race.evaluate(() => void studentApp.navigateTo({ view: 'arcade' }));
    delayed.releaseRead();
    await race.locator('#arcade-view:not(.hidden)').waitFor();
    await race.waitForFunction(() => studentApp.authInitialized && !studentApp.routing.isApplyingRoute);
    assert.equal(new URL(race.url()).hash, '#/arcade');
    assert.deepEqual(delayed.errors, []);
    await race.close();
    console.log('Real navigation controllers passed cold activity deep link, reload, and delayed Units→Arcade intent preservation.');
} finally { await browser?.close(); server?.kill(); }
