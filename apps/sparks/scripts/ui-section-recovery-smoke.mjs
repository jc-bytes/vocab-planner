import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { assertNoAccessibilityViolations } from './lib/accessibility-audit.mjs';
import { seedLocalAuditData, AUDIT_STUDENT_EMAIL, AUDIT_TEACHER_EMAIL, AUDIT_PASSWORD } from './lib/local-supabase-audit.mjs';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const port = Number(process.env.UI_SECTION_RECOVERY_PORT || 8760);
const baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.SECTION_RECOVERY_DIST === '1';
const roles = process.env.UI_SECTION_RECOVERY_ROLE ? [process.env.UI_SECTION_RECOVERY_ROLE] : ['student', 'teacher'];
assert.ok(roles.every(role => ['student', 'teacher'].includes(role)), 'Unknown section recovery role');
let server, browser;
try {
    const seeded = await seedLocalAuditData();
    const config = seeded.browserConfig;
    assert.ok(['127.0.0.1', 'localhost'].includes(new URL(config.url).hostname), 'Use a local backend only');
    server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    const output = await mkdtemp(join(tmpdir(), 'sparks-section-recovery-'));
    for (const role of roles) {
        const context = await browser.newContext({ serviceWorkers: 'block' });
        await context.grantPermissions(['local-network-access'], { origin: baseUrl });
        await context.addInitScript(value => { window.SUPABASE_CONFIG = value; }, config);
        await context.route(`${baseUrl}/*.html*`, async route => {
            const response = await route.fetch();
            const html = (await response.text()).replace("connect-src 'self'", `connect-src 'self' ${config.url} ${config.url.replace('http:', 'ws:')}`);
            await route.fulfill({ response, body: html });
        });
        let unavailable = false, failPath = null, failureStatus = 503, onReadStalled = () => {};
        const pageErrors = [];
        const endpoint = role === 'student' ? 'my_teaching_classes_v1' : 'list_teaching_classes_v1';
        let stall = false;
        const stalled = [];
        await context.route('**/rest/v1/**', async route => {
            const path = new URL(route.request().url()).pathname;
            if (stall && path.endsWith(`/rpc/${endpoint}`)) {
                onReadStalled();
                await new Promise(resolve => stalled.push(resolve));
                await route.continue().catch(() => {});
                return;
            }
            if (unavailable && path.endsWith(`/rpc/${endpoint}`) || failPath && path.endsWith(failPath)) {
                await route.fulfill({ status: failureStatus, json: { message: 'Controlled section outage' } });
            } else await route.continue();
        });
        let holdHomeModule = role === 'teacher';
        const heldHomeModules = [];
        await context.route(url => /\/teacherWorkspaceFeature(?:-[\w-]+)?\.js$/.test(url.pathname), async route => {
            if (holdHomeModule) await new Promise(resolve => heldHomeModules.push(resolve));
            await route.continue().catch(() => {});
        });
        const page = await context.newPage();
        await page.addLocatorHandler(page.getByRole('button', { name: 'Skip guide', exact: true }), async control => control.click());
        page.on('pageerror', error => pageErrors.push(error.message));
        await page.clock.setFixedTime(new Date('2026-08-24T15:00:00Z'));
        await page.goto(`${baseUrl}/${role}.html`, { waitUntil: 'domcontentloaded' });
        const student = role === 'student';
        await page.locator(student ? '#login-email' : '#teacher-email').fill(student ? AUDIT_STUDENT_EMAIL : AUDIT_TEACHER_EMAIL);
        await page.locator(student ? '#login-password' : '#teacher-password').fill(AUDIT_PASSWORD);
        await page.locator(student ? '#student-login-form button[type="submit"]' : '#teacher-login-form button[type="submit"]').click();
        await page.locator(student ? '#student-tab-shell:not(.hidden)' : '#teacher-tab-shell:not(.hidden)').waitFor();
        if (student) {
            await page.locator('#student-tab-vocabulary').click();
            await page.locator('#vocab-list .student-vocab-card, #vocab-list .student-vocab-unit-row').first().waitFor();
            unavailable = true;
            await page.evaluate(async () => {
                window.studentApp.activities.vocabularyData.classSelection.loadedAt = 0;
                await window.studentApp.activities.renderDashboard();
            });
            const recovery = page.locator('#vocab-list [data-section-recovery]');
            assert.equal(await recovery.count(), 1, 'Failed Units refresh must show section recovery');
            assert.ok(await page.locator('#vocab-list .student-vocab-card, #vocab-list .student-vocab-unit-row').count(), 'Failed refresh keeps loaded units');
            await assertNoAccessibilityViolations(page, `${role} section recovery`, {include:['[data-section-recovery]']});
            unavailable = false;
            await recovery.getByRole('button', {name:'Try again', exact:true}).click();
            await recovery.waitFor({state:'detached'});
            // The same Units recovery remains usable when the connection drops entirely.
            await context.setOffline(true);
            await page.evaluate(() => window.studentApp.activities.renderDashboard({forceRefresh:true}));
            await page.locator('#vocab-list [data-section-recovery]').waitFor();
            await context.setOffline(false);
            await page.locator('#vocab-list [data-section-recovery]').getByRole('button',{name:'Try again',exact:true}).click();
            await page.locator('#vocab-list [data-section-recovery]').waitFor({state:'detached'});
            stall = true;
            const hangingRead = page.evaluate(() => window.studentApp.activities.renderDashboard({forceRefresh:true}));
            const timeoutRecovery = page.locator('#vocab-list [data-section-recovery]');
            await timeoutRecovery.waitFor({timeout:15000});
            await hangingRead;
            stall = false;
            stalled.splice(0).forEach(resolve => resolve());
            await timeoutRecovery.getByRole('button',{name:'Try again',exact:true}).click();
            await timeoutRecovery.waitFor({state:'detached'});
            unavailable = true;
            await page.evaluate(() => { window.studentApp.activities.vocabularyData.classSelection.loadedAt = 0; });
            await page.locator('#student-tab-today').click();
            const homeRecovery = page.locator('#student-home-dashboard [data-section-recovery]');
            await homeRecovery.waitFor();
            unavailable = false;
            await homeRecovery.getByRole('button',{name:'Try again',exact:true}).click();
            await homeRecovery.waitFor({state:'detached'});
            await page.locator('#student-tab-sparks').click();
            await page.locator('#student-sparks-library .student-spark-library-grid, #student-sparks-library .student-spark-row-list').waitFor();
            failPath = '/class_assignments';
            await page.evaluate(() => window.studentApp.navigateTo(window.studentApp.parseRoute()));
            const sparkRecovery = page.locator('#student-sparks-library [data-section-recovery]');
            await sparkRecovery.waitFor();
            failPath = null;
            await sparkRecovery.getByRole('button',{name:'Try again',exact:true}).click();
            await sparkRecovery.waitFor({state:'detached'});
        } else {
            // Home now owns class navigation. Exercise the same bounded lazy-module
            // and fresh-read recovery through its current private workspace owner.
            const moduleRecovery = page.locator('#teacher-overview-view [data-section-recovery]');
            await moduleRecovery.waitFor({timeout:15000});
            holdHomeModule = false;
            heldHomeModules.splice(0).forEach(resolve => resolve());
            await moduleRecovery.getByRole('button',{name:'Try again',exact:true}).click();
            await moduleRecovery.waitFor({state:'detached'});
            await page.locator('#teacher-overview-view .teacher-class-card').first().waitFor();
            unavailable = true;
            await page.evaluate(() => window.teacherApp.loadTeacherOverview({forceRefresh:true}));
            const recovery = page.locator('#teacher-overview-view [data-section-recovery]');
            await recovery.waitFor();
            await assertNoAccessibilityViolations(page, `${role} section recovery`, {include:['[data-section-recovery]']});
            unavailable = false;
            await recovery.getByRole('button', {name:'Try again',exact:true}).click();
            await recovery.waitFor({state:'detached'});
            await page.locator('#teacher-overview-view .teacher-class-card').first().waitFor();
            failureStatus = 403; unavailable = true;
            await page.evaluate(() => window.teacherApp.loadTeacherOverview({forceRefresh:true}));
            await recovery.waitFor();
            assert.match(await recovery.innerText(), /access may have changed/);
            assert.equal(await page.locator('#teacher-overview-view .teacher-class-card').count(), 0, 'Access denial clears previous class data');
            unavailable = false; failureStatus = 503;
            await recovery.getByRole('button', {name:'Try again',exact:true}).click();
            await recovery.waitFor({state:'detached'});
            await page.locator('#teacher-overview-view .teacher-class-card').first().waitFor();
            const readEntered = new Promise(resolve => { onReadStalled = resolve; });
            stall = true;
            const departedHomeRead = page.evaluate(() => window.teacherApp.loadTeacherOverview({forceRefresh:true}));
            await readEntered;
            await page.locator('#tab-vocabulary').click();
            stall = false; stalled.splice(0).forEach(resolve => resolve());
            await departedHomeRead;
            assert.equal(await page.locator('#teacher-overview-view .teacher-class-card').count(), 0, 'A departed class Home cannot paint its late read');

            await page.locator('#library-list button').first().waitFor();
            failPath = '/rpc/list_vocabulary_metadata_school_v1';
            await page.evaluate(() => window.teacherApp.loadLibrary({forceRefresh:true}));
            const libraryRecovery = page.locator('#library-list [data-section-recovery]');
            await libraryRecovery.waitFor();
            assert.ok(await page.locator('#library-list button').count() > 1, 'Keep loaded vocabulary navigation');
            failPath = null;
            await libraryRecovery.getByRole('button',{name:'Try again',exact:true}).click();
            await libraryRecovery.waitFor({state:'detached'});
            // A second forced private catalogue failure must remain recoverable
            // after a healthy retry, without a full page reload.
            failPath = '/rpc/list_vocabulary_metadata_school_v1';
            await page.evaluate(() => window.teacherApp.loadLibrary({forceRefresh:true}));
            await libraryRecovery.waitFor();
            failPath = null;
            await libraryRecovery.getByRole('button',{name:'Try again',exact:true}).click();
            await libraryRecovery.waitFor({state:'detached'});
            failPath = '/weekly_sparks';
            await page.evaluate(() => window.teacherApp.showTeacherSection('sparks'));
            const sparkRecovery = page.locator('#spark-library-list [data-section-recovery]');
            await sparkRecovery.waitFor();
            failPath = null;
            await sparkRecovery.getByRole('button',{name:'Try again',exact:true}).click();
            await sparkRecovery.waitFor({state:'detached'});
            for (const section of ['classes','assignments','review']) {
                failPath = section === 'classes' ? '/rpc/list_teaching_classes_v1' : '/class_assignments';
                await page.evaluate(section => {
                    if (!teacherApp.getSelectedTeacherClassId()) teacherApp.selectTeacherClass(teacherApp.teacherClassOptions[0]?.id);
                    teacherApp.showTeacherSection(section);
                }, section);
                const sectionRecovery = page.locator(`#teacher-${section === 'review' ? 'assignments' : section}-view [data-section-recovery]`);
                await sectionRecovery.waitFor();
                await page.setViewportSize({width:390,height:844});
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
                await page.screenshot({path:join(output,`${role}-${section}-failure-phone.png`),fullPage:true});
                failPath = null;
                await sectionRecovery.getByRole('button',{name:'Try again',exact:true}).click();
                await sectionRecovery.waitFor({state:'detached'});
            }
        }
        await page.screenshot({path:join(output,`${role}-recovered.png`),fullPage:true});
        console.log(`${role}: section failure, preserved content and retry passed.`);
        assert.deepEqual(pageErrors, []);
        await context.close();
    }
    console.log(`Section recovery screenshots: ${output}`);
} finally {
    await browser?.close();
    server?.kill();
}
