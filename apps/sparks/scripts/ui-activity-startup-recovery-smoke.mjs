import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { seedLocalAuditData, AUDIT_STUDENT_EMAIL, AUDIT_PASSWORD } from './lib/local-supabase-audit.mjs';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { seedReturningStudentGuidePreferences } from './lib/student-guide-fixture.mjs';

const port = Number(process.env.UI_ACTIVITY_RECOVERY_PORT || 8696);
const baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_ACTIVITY_RECOVERY_DIST === '1';
const manifest = built ? JSON.parse(await readFile(new URL('../dist-desktop/.vite/manifest.json', import.meta.url), 'utf8')) : null;
let server, browser;
try {
    const seeded = await seedLocalAuditData();
    const config = seeded.browserConfig;
    assert.ok(['127.0.0.1', 'localhost'].includes(new URL(config.url).hostname));
    server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    for (const scenario of ['transient', 'denied', 'module', 'styles', 'launcher', 'write-module']) {
        const context = await browser.newContext({ serviceWorkers: 'block' });
        await context.grantPermissions(['local-network-access'], { origin: baseUrl });
        await context.addInitScript(value => { window.SUPABASE_CONFIG = value; }, config);
        await context.route(`${baseUrl}/*.html*`, async route => {
            const response = await route.fetch();
            const html = (await response.text()).replace("connect-src 'self'", `connect-src 'self' ${config.url} ${config.url.replace('http:', 'ws:')}`);
            await route.fulfill({ response, body: html });
        });
        let attempts = 0, deny = scenario === 'denied';
        await context.route('**/rest/v1/rpc/start_student_activity_attempt_owned_v1', route => {
            attempts++;
            if (deny) return route.fulfill({ status: 403, json: { code: '42501', message: 'Assignment is not accepting work.' } });
            if (scenario === 'transient' && attempts === 1) return route.fulfill({ status: 503, json: { code: 'PGRST000', message: 'Temporary test outage' } });
            return route.continue();
        });
        const blocked = { module: 'activities/flashcards.js', styles: 'student/studentFeatureStyles.js', launcher: 'student/studentActivityLauncherMethods.js', 'write-module': 'supabaseStudentWriteOperations.js' }[scenario];
        let injectedFaults = 0, confirmInjection;
        const injection = new Promise(resolve => { confirmInjection = resolve; });
        if (blocked) {
            const asset = manifest?.[`js/${blocked}`]?.file;
            if (built) assert.ok(asset, `${scenario}: emitted fault target must exist`);
            // Use the actual emitted file, including CSS-only dynamic entries.
            await context.route(built ? url => url.pathname === `/${asset}` : `**/js/${blocked}*`, route => {
                injectedFaults++;
                confirmInjection();
                return route.abort('failed');
            });
        }
        const page = await context.newPage();
        await seedReturningStudentGuidePreferences(page, seeded.users.student.id);
        await page.addInitScript(() => {
            window.activityFaultPreloads = [];
            addEventListener('vite:preloadError', () => window.activityFaultPreloads.push({
                starting: Boolean(window.studentApp?.activities?.launcher?.isStarting),
                type: window.studentApp?.currentActivityType || null
            }));
        });
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        await page.goto(`${baseUrl}/student.html`, { waitUntil: 'domcontentloaded' });
        await page.locator('#login-email').fill(AUDIT_STUDENT_EMAIL);
        await page.locator('#login-password').fill(AUDIT_PASSWORD);
        await page.locator('#student-login-form button[type="submit"]').click();
        await page.waitForFunction(() => window.studentApp?.authInitialized);
        await page.evaluate(id => studentApp.navigateTo({ view: 'unit', unitId: `assignment.${id}` }), seeded.vocabularyAssignmentId);
        await page.waitForFunction(id => studentApp.currentVocab?.assignmentId === id && document.querySelector('#activity-menu-view')?.getAttribute('aria-busy') === 'false', seeded.vocabularyAssignmentId);
        await page.locator('#activity-menu-view [data-activity="flashcards"]').click();
        if (blocked) {
            let timeout;
            try { await Promise.race([injection, new Promise((_, reject) => {
                timeout = setTimeout(() => reject(new Error(`${scenario}: fault target was never requested`)), 5000);
            })]); } finally { clearTimeout(timeout); }
            assert.ok(injectedFaults > 0, `${scenario}: a real asset request must be blocked`);
        }
        if (scenario === 'transient') {
            await page.waitForFunction(() => studentApp.currentActivityType === 'flashcards' && !!studentApp.activityInstance);
            assert.equal(attempts, 2);
        } else {
            const recovery = page.locator('#activity-container .activity-load-error');
            try { await recovery.waitFor(); }
            catch (error) {
                console.error(`${scenario}: fault state`, { injectedFaults, ...await page.evaluate(() => ({
                    preloads: window.activityFaultPreloads,
                    type: window.studentApp?.currentActivityType,
                    starting: window.studentApp?.activities?.launcher?.isStarting,
                    mounted: Boolean(window.studentApp?.activityInstance),
                    featureStyles: [...document.querySelectorAll('link[rel="stylesheet"]')]
                        .filter(link => link.href.includes('studentFeatureStyles')).map(link => ({ loaded: Boolean(link.sheet) }))
                })) });
                throw error;
            }
            const diagnostic = await page.evaluate(() => JSON.parse(sessionStorage.getItem('sparks:last-activity-startup-error')));
            assert.equal(diagnostic.stage, scenario === 'denied' ? 'verification' : scenario === 'write-module' ? 'module' : scenario);
            assert.deepEqual(Object.keys(diagnostic).sort(), ['code', 'stage', 'status']);
            if (scenario === 'write-module') {
                assert.equal(diagnostic.code, 'CLIENT_MODULE_LOAD_FAILED');
                assert.equal(attempts, 0, 'A missing request module must not dispatch verification RPCs');
            }
            if (scenario === 'denied') {
                assert.equal(attempts, 1);
                assert.match(await recovery.innerText(), /no longer accepting work/);
                deny = false;
                await recovery.getByRole('button', { name: 'Try again', exact: true }).click();
                await page.waitForFunction(() => studentApp.currentActivityType === 'flashcards' && !!studentApp.activityInstance);
            } else {
                assert.match(await recovery.innerText(), /activity files could not load/);
                await recovery.getByRole('button', { name: 'Back to unit', exact: true }).click();
                await page.locator('#activity-menu-view:not(.hidden)').waitFor();
            }
        }
        assert.deepEqual(pageErrors, [], `${scenario}: no unhandled browser errors`);
        console.log(`${scenario}: actual local assignment startup recovery passed`);
        await context.close();
    }
} finally { await browser?.close(); server?.kill(); }
