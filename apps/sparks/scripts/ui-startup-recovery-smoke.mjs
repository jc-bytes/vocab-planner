import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { seedLocalAuditData, AUDIT_STUDENT_EMAIL, AUDIT_TEACHER_EMAIL, AUDIT_PASSWORD } from './lib/local-supabase-audit.mjs';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const port = Number(process.env.UI_STARTUP_RECOVERY_PORT || 8693);
const baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.STARTUP_RECOVERY_DIST === '1';
let server, browser;
try {
    const seeded = await seedLocalAuditData();
    const config = seeded.browserConfig;
    assert.ok(['127.0.0.1', 'localhost'].includes(new URL(config.url).hostname), 'Use a local backend only');
    server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    const output = await mkdtemp(join(tmpdir(), 'sparks-startup-recovery-'));
    for (const role of ['student', 'teacher']) {
        const context = await browser.newContext({ serviceWorkers: 'block' });
        await context.grantPermissions(['local-network-access'], { origin: baseUrl });
        await context.addInitScript(value => { window.SUPABASE_CONFIG = value; }, config);
        await context.route(`${baseUrl}/*.html*`, async route => {
            const response = await route.fetch();
            const html = (await response.text()).replace("connect-src 'self'", `connect-src 'self' ${config.url} ${config.url.replace('http:', 'ws:')}`);
            await route.fulfill({ response, body: html });
        });
        let unavailable = true, reads = 0, failureStatus = 503;
        await context.route('**/rest/v1/rpc/my_school_access_v1', route => {
            reads++;
            return unavailable ? route.fulfill({ status: failureStatus, json: { message: 'Temporary local test outage' } }) : route.continue();
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${baseUrl}/${role}.html`, { waitUntil: 'domcontentloaded' });
        const student = role === 'student';
        await page.locator(student ? '#login-email' : '#teacher-email').fill(student ? AUDIT_STUDENT_EMAIL : AUDIT_TEACHER_EMAIL);
        await page.locator(student ? '#login-password' : '#teacher-password').fill(AUDIT_PASSWORD);
        await page.locator(student ? '#student-login-form button[type="submit"]' : '#teacher-login-form button[type="submit"]').click();
        const recovery = page.locator('[data-startup-recovery]');
        await recovery.waitFor({ state: 'visible' });
        assert.ok(await recovery.getByText('You are still signed in.', { exact: false }).isVisible());
        await page.evaluate(role => {
            const app = role === 'student' ? window.studentApp : window.teacherApp;
            if (role === 'teacher') app.vocabSet.startupTestDraft = 'Keep this unsaved teacher draft';
        }, role);
        assert.equal(await page.evaluate(role => !!(role === 'student' ? window.studentApp : window.teacherApp).currentUser, role), true);
        assert.equal(await page.evaluate(role => role === 'student' ? !!window.studentApp.authInitialized : window.teacherApp.isAuthenticated, role), false);
        // Verify bounded retries stop instead of continuously hammering the API.
        await page.waitForTimeout(4600);
        assert.equal(reads, 3, `${role}: initial request plus two automatic retries`);
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: join(output, `${role}-recovery-phone.png`), fullPage: true });
        unavailable = false;
        await recovery.getByRole('button', { name: 'Try again', exact: true }).click();
        await page.waitForFunction(role => role === 'student' ? window.studentApp.authInitialized : window.teacherApp.isAuthenticated, role);
        await recovery.waitFor({ state: 'detached' });
        assert.equal(await page.evaluate(role => role === 'teacher' ? window.teacherApp.vocabSet.startupTestDraft : 'Keep this unsaved teacher draft', role), 'Keep this unsaved teacher draft');
        assert.equal(await page.evaluate(role => role === 'student' ? window.studentApp.studentProfile.grade : window.teacherApp.schoolAccess.getSchoolId(), role), student ? '6' : seeded.schoolId);
        if (student) await page.waitForFunction(() => window.studentApp.activities.vocabularyData.classSelection?.classes.length > 0);
        // A restored persisted session must also recover after losing connectivity.
        unavailable = true;
        await page.reload({ waitUntil: 'domcontentloaded' });
        await recovery.waitFor({ state: 'visible' });
        await context.setOffline(true);
        unavailable = false;
        await context.setOffline(false);
        await recovery.waitFor({ state: 'detached' });
        await page.waitForFunction(role => role === 'student' ? window.studentApp.authInitialized : window.teacherApp.isAuthenticated, role);
        // An explicit denial must not trigger automatic network retries.
        unavailable = true; failureStatus = 403;
        await page.reload({ waitUntil: 'domcontentloaded' });
        await recovery.waitFor({ state: 'visible' });
        const deniedReads = reads;
        await page.waitForTimeout(1500);
        assert.equal(reads, deniedReads, 'Permission denial does not retry automatically');
        // Explicit sign-out while setup is incomplete cancels future retries.
        await recovery.getByRole('button', { name: 'Sign out', exact: true }).click();
        await page.locator(student ? '#login-view:not(.hidden)' : '#teacher-login-view:not(.hidden)').waitFor();
        const atSignOut = reads;
        await page.waitForTimeout(1200);
        assert.equal(reads, atSignOut, 'Sign-out cancels retry timers');
        assert.equal(await page.evaluate(role => (role === 'student' ? window.studentApp : window.teacherApp).currentUser, role), null);
        assert.deepEqual(errors, []);
        console.log(`${role}: bounded retries, manual recovery, saved session reconnect, phone layout, and sign-out cancellation passed.`);
        await context.close();
    }
    console.log(`Local startup recovery screenshots: ${output}`);
} finally {
    await browser?.close();
    server?.kill();
}
