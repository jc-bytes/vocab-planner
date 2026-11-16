import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installStudentAssignedFlowFixture } from './lib/student-assigned-flow-fixture.mjs';

const port = Number(process.env.UI_STUDENT_ACCESS_PORT || 8674);
const baseUrl = process.env.UI_STUDENT_FLOW_BASE_URL || `http://127.0.0.1:${port}`;
let server, browser;
try {
    if (!process.env.UI_STUDENT_FLOW_BASE_URL) server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port });
    browser = await chromium.launch();
    const page = await browser.newPage();
    const fixture = await installStudentAssignedFlowFixture(page);
    let unavailable = true;
    await page.route('https://fixture.supabase.co/rest/v1/rpc/my_school_access_v1', route => unavailable
        ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Temporary school access failure' }) })
        : route.fallback());
    await page.goto(`${baseUrl}/student.html#/units`);
    const recovery = page.locator('#loading-view:not(.hidden) [data-startup-recovery]');
    await recovery.getByText(/You are still signed in/).waitFor();
    assert.equal(await page.evaluate(() => studentApp.currentUser?.uid), fixture.ids.user);
    unavailable = false;
    await recovery.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('button').filter({ hasText: fixture.detail.title }).first().waitFor();
    await page.waitForFunction(() => studentApp.authInitialized);
    await page.clock.install();
    await page.evaluate(() => {
        window.originalRestoreRoute = studentApp.restoreRouteOrDefault;
        studentApp.restoreRouteOrDefault = () => {
            window.stalledRouteStarted = true;
            return new Promise(() => {});
        };
        void studentApp.auth.handleBackendSignIn(studentApp.currentUser, { force: true });
    });
    await page.waitForFunction(() => window.stalledRouteStarted);
    await page.clock.fastForward(45000);
    await recovery.getByText(/You are still signed in/).waitFor();
    assert.equal(await page.evaluate(() => studentApp.currentUser?.uid), fixture.ids.user);
    assert.equal(await page.evaluate(() => studentApp.authInitialized), false);
    await page.evaluate(() => { studentApp.restoreRouteOrDefault = window.originalRestoreRoute; });
    await recovery.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.waitForFunction(() => studentApp.authInitialized);
    await page.getByRole('button').filter({ hasText: fixture.detail.title }).first().waitFor();
    assert.equal(await page.locator('[data-startup-recovery]').count(), 0);
    assert.equal(await page.evaluate(() => studentApp.currentUser?.uid), fixture.ids.user);
    assert.deepEqual(fixture.errors, []);
    console.log('Student school-access failure and stalled startup both recover to Units without sign-out. Synthetic account only; no student work changed.');
} finally {
    await browser?.close();
    server?.kill();
}
