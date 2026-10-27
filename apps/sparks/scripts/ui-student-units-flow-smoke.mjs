import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installStudentAssignedFlowFixture } from './lib/student-assigned-flow-fixture.mjs';
const port = Number(process.env.UI_STUDENT_UNITS_FLOW_PORT || 8672);
const baseUrl = process.env.UI_STUDENT_FLOW_BASE_URL || `http://127.0.0.1:${port}`;
let server, browser;
try {
    if (!process.env.UI_STUDENT_FLOW_BASE_URL) server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port });
    browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Panama' });
    const fixture = await installStudentAssignedFlowFixture(page);
    await page.goto(`${baseUrl}/student.html#/units?trimester=IIIT&month=october`);

    await page.getByRole('button').filter({ hasText: fixture.detail.title }).first().waitFor({ timeout: 30000 });
    assert.ok(page.url().includes('#/units')); assert.equal(await page.getByText('No vocabularies found.', { exact: true }).count(), 0);
    const screenshots = process.env.UI_STUDENT_UNITS_SCREENSHOTS;
    if (screenshots) await mkdir(screenshots, { recursive: true });
    for (const width of [320, 360, 390, 430, 768, 1024, 1280]) {
        await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(350);
        const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1,
            clipped: [...document.querySelectorAll('#vocab-list button')].filter(element => element.getClientRects().length)
                .some(element => { const box = element.getBoundingClientRect(); return box.left < -1 || box.right > innerWidth + 1; }) }));
        assert.deepEqual(layout, { overflow: false, clipped: false }, `Assigned Units at ${width}px`);
        if (screenshots && [390, 1280].includes(width)) await page.screenshot({ path: `${screenshots}/units-${width}.png`, fullPage: false });
    }
    await page.getByRole('button').filter({ hasText: fixture.detail.title }).first().click();
    await page.locator('#activity-menu-view:not(.hidden)').waitFor({ timeout: 30000 });
    await page.locator('[data-activity="matching"]').first().click();
    await page.locator('#activity-view:not(.hidden)').waitFor({ timeout: 30000 });
    await page.waitForFunction(() => window.studentApp?.currentActivityType === 'matching' && window.studentApp.activityInstance?.container?.querySelector('.matching-shell'));
    const state = await page.evaluate(() => ({ assignment: studentApp.currentVocab.assignmentId, type: studentApp.currentActivityType,
        words: studentApp.currentVocab.words.length, unitKey: studentApp.activities.getUnitProgressKey(studentApp.currentVocab) }));
    assert.deepEqual(state, { assignment: fixture.ids.assignment, type: 'matching', words: 10, unitKey: `assignment:${fixture.ids.assignment}` });
    assert.ok(fixture.calls.some(call => call.name === 'start_student_activity_attempt_owned_v1'));
    assert.deepEqual(fixture.errors, []);
    const barePage = await browser.newPage(); const bare = await installStudentAssignedFlowFixture(barePage);
    await barePage.goto(`${baseUrl}/student.html#/units`);
    await barePage.getByRole('button').filter({ hasText: bare.detail.title }).first().waitFor({ timeout: 30000 });
    assert.ok(barePage.url().includes('#/units'));
    assert.equal(await barePage.locator('#vocab-selection-view').getAttribute('aria-busy'), 'false');
    assert.deepEqual(bare.errors, []);
    await barePage.close();
    // This navigation race needs a student eligible for Arcade; the ordinary
    // Units fixture above deliberately retains unfinished required activities.
    const racePage = await browser.newPage(); const delayed = await installStudentAssignedFlowFixture(racePage, { completeRequiredActivities: true });
    delayed.holdReads();
    await racePage.goto(`${baseUrl}/student.html#/units`);
    await racePage.waitForFunction(() => window.studentApp?.currentUser);
    for (let attempt = 0; attempt < 100 && !delayed.hasPendingRead(); attempt++) await racePage.waitForTimeout(20);
    assert.equal(delayed.hasPendingRead(), true);
    await racePage.evaluate(() => void studentApp.navigateTo({ view: 'arcade' }));
    delayed.releaseRead();
    await racePage.locator('#arcade-view:not(.hidden)').waitFor();
    await racePage.waitForTimeout(100);
    assert.ok(racePage.url().includes('#/arcade'), 'An old Units load must not replace newer navigation');
    assert.deepEqual(delayed.errors, []);
    await racePage.close();
    const todayPage = await browser.newPage(); const today = await installStudentAssignedFlowFixture(todayPage);
    await todayPage.goto(`${baseUrl}/student.html`);
    await todayPage.locator('#main-menu-view:not(.hidden) .student-continue-hero').filter({ hasText: today.detail.title }).waitFor({ timeout: 30000 });
    assert.ok(todayPage.url().includes('#/menu')); assert.equal(await todayPage.getByText('No vocabularies found.', { exact: true }).count(), 0);
    await todayPage.waitForTimeout(100); assert.deepEqual(today.errors, []);
    await todayPage.close();
    const joinPage = await browser.newPage(); const joined = await installStudentAssignedFlowFixture(joinPage, { startEnrolled: false });
    await joinPage.goto(`${baseUrl}/student.html`);
    await joinPage.waitForFunction(() => window.studentApp?.authInitialized && studentApp.activities.vocabularyData.classSelection?.classes.length === 0);
    await joinPage.evaluate(() => studentApp.navigateTo({ view: 'classes' }));
    await joinPage.getByRole('button', { name: 'Join class', exact: true }).click();
    await joinPage.getByRole('button').filter({ hasText: joined.detail.title }).first().waitFor();
    await joinPage.evaluate(() => studentApp.navigateTo({ view: 'units', trimester: 'IIIT', month: 'october' }));
    await joinPage.getByRole('button').filter({ hasText: joined.detail.title }).first().waitFor({ timeout: 5000 });
    await joinPage.getByRole('button').filter({ hasText: joined.detail.title }).first().click();
    await joinPage.locator('#activity-menu-view:not(.hidden)').waitFor();
    await joinPage.waitForFunction(id => studentApp.currentVocab?.assignmentId === id, joined.ids.assignment);
    assert.equal(await joinPage.evaluate(() => studentApp.currentVocab.assignmentId), joined.ids.assignment);
    await joinPage.locator('[data-activity="matching"]').first().click();
    await joinPage.waitForFunction(() => window.studentApp?.currentActivityType === 'matching' && window.studentApp.activityInstance?.container?.querySelector('.matching-shell'));
    assert.deepEqual(joined.errors, []); await joinPage.close();
    console.log('Actual student Units → published vocabulary → activity menu → Matching controller passed; no activity completed.');
} finally { await browser?.close(); server?.kill(); }
