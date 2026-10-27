import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { seedLocalAuditData, runLocalAuditSql, AUDIT_STUDENT_EMAIL, AUDIT_PASSWORD } from './lib/local-supabase-audit.mjs';
import { prepareResponsiveArcadeFixture } from './lib/responsive-arcade-fixture.mjs';

const port = Number(process.env.UI_ARCADE_PURCHASE_PORT || 8698);
const baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_ARCADE_PURCHASE_DIST === '1';
let browser, server, seeded, summaryBefore, walletBefore, requiredWorkFixture;
const events = new Set();
try {
    seeded = await seedLocalAuditData();
    const config = seeded.browserConfig, ownerId = seeded.users.student.id;
    assert.ok(['127.0.0.1', 'localhost'].includes(new URL(config.url).hostname));
    runLocalAuditSql(`select private.ensure_student_progress_summary_v3('${ownerId}'); select private.ensure_arcade_time_wallet_v1('${ownerId}');`);
    summaryBefore = (await seeded.admin.from('student_progress_summary').select('*').eq('user_id', ownerId).single().throwOnError()).data;
    walletBefore = (await seeded.admin.from('student_arcade_time').select('*').eq('user_id', ownerId).single().throwOnError()).data;
    const currentPublication = await seeded.admin.from('class_assignments').select('id')
        .eq('school_id', seeded.schoolId).eq('class_id', seeded.classroom.id).eq('owner_id', seeded.users.teacher.id)
        .eq('publication_key', '6b47ab0a-2026-4000-8000-000000000004').eq('kind', 'vocabulary')
        .eq('withdrawn', false).lte('release_at', new Date().toISOString()).maybeSingle().throwOnError();
    requiredWorkFixture = await prepareResponsiveArcadeFixture({ studentId: ownerId,
        assignmentId: currentPublication.data?.id || seeded.vocabularyAssignmentId, classId: seeded.classroom.id,
        fixture: currentPublication.data ? 'current' : 'august' });
    await requiredWorkFixture.complete();
    const globalSettings = (await seeded.admin.from('app_settings').select('value').eq('key', 'gamification').maybeSingle().throwOnError()).data;
    const coinCost = Math.min(10000, Math.max(1, Math.floor(Number(globalSettings?.value?.exchangeRate) || 10)));
    server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    const manifest = built ? JSON.parse(await readFile('dist-desktop/.vite/manifest.json', 'utf8')) : null;
    const gamesModule = built ? `/${manifest['js/student/studentGames.js'].file}` : '/js/student/studentGames.js';
    browser = await chromium.launch();
    for (const scenario of ['lost-response-reload', 'stop-concurrent', 'sign-out', 'quota']) {
        // Only disposable audit-user balances change; global pricing stays untouched.
        runLocalAuditSql(`update public.student_progress_summary set coins=${coinCost},coin_data=jsonb_build_object('balance',${coinCost},'giftCoins',0,'totalEarned',${coinCost},'totalSpent',0,'totalGifted',0),version=version+1 where user_id='${ownerId}';
            update public.student_arcade_time set available_seconds=60 where user_id='${ownerId}';`);
        const context = await browser.newContext({ serviceWorkers: 'block' });
        await context.grantPermissions(['local-network-access'], { origin: baseUrl });
        await context.addInitScript(value => { window.SUPABASE_CONFIG = value; }, config);
        await context.route(`${baseUrl}/*.html*`, async route => {
            const response = await route.fetch();
            await route.fulfill({ response, body: (await response.text()).replace("connect-src 'self'", `connect-src 'self' ${config.url} ${config.url.replace('http:', 'ws:')}`) });
        });
        const page = await context.newPage(), pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        async function login(target = page) {
            await target.goto(`${baseUrl}/student.html`);
            if (await target.locator('#login-email').isVisible()) {
                await target.locator('#login-email').fill(AUDIT_STUDENT_EMAIL);
                await target.locator('#login-password').fill(AUDIT_PASSWORD);
                await target.locator('#student-login-form button[type=submit]').click();
            }
            await target.waitForFunction(() => window.studentApp?.authInitialized);
        }
        async function purchaseController(target = page, clientId = `fault-${scenario}`) {
            await target.evaluate(async ({ gamesModule, clientId, unitKey, assignmentId, classId, coinCost }) => {
                const { StudentGames } = await import(gamesModule);
                // The dedicated local student's normalized required work is
                // temporarily complete. Readiness and coursework gates stay real.
                const app = studentApp;
                await app.activities.vocabularyData.loadClassSelection();
                if (app.activities.vocabularyData.classSelection.selectedId !== classId) {
                    app.activities.vocabularyData.classSelection.select(classId);
                    await app.activities.vocabularyData.loadClassSelection();
                }
                await app.activities.refreshCurrentSparkGate({ updateDisplay: false });
                const access = app.activities.getPendingRequiredWork();
                if (app.activities.getUnitProgressKey({ assignmentId }) !== unitKey
                    || !app.activities.vocabularyData.classSelection?.ready
                    || !app.progressData.units[unitKey]?.scores.flashcards?.isComplete
                    || access.isBlocked) {
                    const pending = access.units.map(unit => ({ assignmentId: unit.vocab.assignmentId,
                        key: app.activities.getUnitProgressKey(unit.vocab), required: unit.completion.flow.required }));
                    throw new Error(`Local Arcade fixture is not ready: ${JSON.stringify({ assignmentId, unitKey,
                        selectedClass: app.activities.vocabularyData.classSelection.selectedId, pending })}`);
                }
                const manager = {
                    get currentUser() { return app.currentUser; }, get authDisabled() { return app.authDisabled; },
                    get coins() { return app.coins; }, progress: { clientId, cloud: app.progress.cloud },
                    activities: app.activities, routing: app.routing,
                    navigateTo: route => app.navigateTo(route)
                };
                window.arcadeFault = new StudentGames(manager);
                window.arcadeLaunches = 0;
                arcadeFault.lifecycle.launchGame = () => { arcadeLaunches++; return true; };
                await arcadeFault.loadGlobalSettings();
                if (arcadeFault.getExchangeRate() !== coinCost) throw new Error('The fault fixture must use current server pricing.');
            }, { gamesModule, clientId, unitKey: requiredWorkFixture.unitKey, assignmentId: requiredWorkFixture.assignmentId, classId: seeded.classroom.id, coinCost });
            await target.waitForFunction(() => !studentApp.routing.isApplyingRoute);
        }
        await login(); await purchaseController();
        let stale;
        if (scenario === 'lost-response-reload') {
            stale = await context.newPage(); await login(stale); await purchaseController(stale, 'stale-tab-client');
        }
        const calls = [], recoveries = [];
        await context.route('**/rest/v1/rpc/recover_student_arcade_minute_owned_v1', async route => {
            const payload = route.request().postDataJSON();
            assert.equal(payload.p_expected_user_id, ownerId);
            recoveries.push(payload);
            const response = await route.fetch();
            assert.equal(response.status(), 200);
            return route.fulfill({ response });
        });
        await context.route('**/rest/v1/rpc/start_student_arcade_minute_owned_v1', async route => {
            const payload = route.request().postDataJSON();
            assert.match(payload.p_event_id, /^[A-Za-z0-9:_-]{8,240}$/);
            calls.push(payload); events.add(payload.p_event_id);
            const response = await route.fetch();
            assert.equal(response.status(), 200);
            if (calls.length === 1 && scenario === 'lost-response-reload') {
                await stale.evaluate(async () => { arcadeFault.updateGameTimer(); while (arcadeFault.lifecycle.clockWritePending) await new Promise(resolve => setTimeout(resolve, 0)); });
                assert.equal(await stale.evaluate(owner => !!JSON.parse(localStorage.getItem(`student_arcade_session_v2:${owner}`)).pendingPurchase, ownerId), true);
                return route.abort('failed');
            }
            if (calls.length === 1 && scenario === 'stop-concurrent') {
                const locked = await page.evaluate(async () => {
                    const result = [await arcadeFault.startGame('pong'), await arcadeFault.requestAdditionalTime()];
                    arcadeFault.stopCurrentGame(); return result;
                });
                assert.deepEqual(locked, [false, false]);
            }
            if (calls.length === 1 && scenario === 'sign-out') {
                await page.locator('#sign-out-btn').evaluate(button => button.click());
                await page.waitForFunction(() => studentApp.currentUser === null);
            }
            return route.fulfill({ response });
        });
        if (scenario === 'quota') await page.evaluate(() => {
            window.originalArcadeSetItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (key.startsWith('student_arcade_session_v2:') && JSON.parse(value).pendingPurchase) throw new DOMException('Test quota', 'QuotaExceededError');
                return originalArcadeSetItem.call(this, key, value);
            };
        });
        const started = await page.evaluate(() => arcadeFault.startGame('snake'));
        assert.equal(started, false);
        assert.equal(await page.evaluate(() => arcadeFault.isStartingGame), false);
        if (scenario === 'quota') {
            assert.equal(calls.length, 0);
        } else if (scenario === 'stop-concurrent') {
            assert.equal(await page.evaluate(() => arcadeFault.gameTimeRemaining), 60);
            assert.equal(await page.evaluate(() => arcadeLaunches), 0);
            assert.equal(await page.evaluate(() => arcadeFault.startGame('pong')), true);
            assert.equal(calls.length, 1);
        } else {
            const pending = await page.evaluate(owner => JSON.parse(localStorage.getItem(`student_arcade_session_v2:${owner}`)).pendingPurchase, ownerId);
            assert.equal(pending.eventId, calls[0].p_event_id);
            assert.equal(await page.evaluate(() => arcadeFault.gameTimeRemaining), 0);
            await login(); await purchaseController(page, 'changed-client-after-reload');
            assert.equal(await page.evaluate(() => arcadeFault.startGame('snake')), true);
            assert.equal(await page.evaluate(() => arcadeFault.gameTimeRemaining), 60);
            assert.equal(calls.length, 1, 'Paid recovery must not dispatch another spend');
            assert.equal(recoveries.length, 1);
            assert.deepEqual(recoveries[0], calls[0], 'Read-only recovery keeps original owner, event, game and client');
            const ledger = await seeded.admin.from('student_coin_ledger').select('id', { count: 'exact', head: true })
                .eq('user_id', ownerId).eq('event_key', `arcade:${pending.eventId}`).throwOnError();
            assert.equal(ledger.count, 1);
            if (stale) {
                await stale.evaluate(async () => { arcadeFault.updateGameTimer(); while (arcadeFault.lifecycle.clockWritePending) await new Promise(resolve => setTimeout(resolve, 0)); });
                assert.equal(await stale.evaluate(() => arcadeFault.gameTimeRemaining), 60);
            }
        }
        assert.deepEqual(pageErrors, []);
        await context.close();
        console.log(`${scenario}: real local Arcade receipt recovery passed`);
    }
} finally {
    try {
        await browser?.close(); server?.kill();
        if (seeded && summaryBefore && walletBefore) {
            const ownerId = seeded.users.student.id;
            if (events.size) {
                const ids = [...events].map(event => `'${event}'`).join(',');
                const keys = [...events].map(event => `'arcade:${event}'`).join(',');
                runLocalAuditSql(`delete from private.student_progress_event_receipts where user_id='${ownerId}' and event_id in (${ids});
                    delete from public.student_coin_ledger where user_id='${ownerId}' and event_key in (${keys});
                    delete from public.student_arcade_time_ledger where user_id='${ownerId}' and event_key in (${keys});`);
            }
            await seeded.admin.from('student_progress_summary').upsert(summaryBefore).throwOnError();
            await seeded.admin.from('student_arcade_time').upsert(walletBefore).throwOnError();
        }
    } finally { await requiredWorkFixture?.restore(); }
}
