import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installStudentAssignedFlowFixture } from './lib/student-assigned-flow-fixture.mjs';

const port = Number(process.env.UI_STUDENT_HOME_SPARK_SCOPE_PORT || 19878);
const baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_STUDENT_HOME_SPARK_SCOPE_DIST === '1';
const failures = [];
let browser, server;
const sparkRow = subject => ({ id: `${subject}-spark`, subject_slug: subject,
    title: `${subject === 'science' ? 'Science' : 'Technology'} current Spark`,
    spark_text: `Read the ${subject} Spark.`, spark_type: 'cool_fact', check_mode: 'reading_only',
    questions: [], target_grades: ['9'], status: 'scheduled', scheduled_date: '2026-10-25' });
const state = page => page.evaluate(() => ({
    title: document.querySelector('.student-spark-host .student-spark-card h3')?.textContent || null,
    sparkId: studentApp.activities.home.spark.currentSpark?.id || null,
    tab: !!document.querySelector('#student-home-tab-spark'),
    subject: studentApp.selectedSubjectSlug,
    weekSelected: document.querySelector('#student-home-tab-week')?.getAttribute('aria-selected'),
    weekActive: document.querySelector('#student-home-panel-week')?.classList.contains('active') || false
}));
async function clearSparkCache(page) {
    // Exercise the real query client, SDK and REST path; do not replace app methods or seed a fake result.
    await page.evaluate(() => studentApp.activities.home.spark.queryService.clearAccount(studentApp.currentUser.uid || studentApp.currentUser.id));
}
async function loadCurrentHost(page) {
    await page.evaluate(() => studentApp.activities.loadAndRenderCurrentSpark(document.querySelector('.student-spark-host')));
}
try {
    server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    for (const scenario of ['current-and-cached', 'current-empty', 'stale-success', 'stale-empty', 'stale-error']) {
        const context = await browser.newContext({ serviceWorkers: 'block' });
        const page = await context.newPage();
        const fixture = await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
        const reads = [], mutations = [];
        let holdNext = false, releaseHeld, emptyCurrent = false, rejectOldSubject = false;
        let heldSeen;
        const held = new Promise(resolve => { heldSeen = resolve; });
        page.on('request', request => {
            if (request.url().startsWith('https://fixture.supabase.co/rest/v1/')
                && ['PATCH', 'PUT', 'DELETE'].includes(request.method())) mutations.push(new URL(request.url()).pathname);
        });
        await page.route('https://fixture.supabase.co/rest/v1/weekly_sparks?**', async route => {
            const request = route.request(), url = new URL(request.url());
            assert.equal(request.method(), 'GET', 'Spark fixture permits reads only');
            assert.equal(url.searchParams.get('school_id'), `eq.${fixture.ids.school}`, 'actual repository preserves school scope');
            const subject = url.searchParams.get('subject_slug')?.replace(/^eq\./, '') || 'technology';
            reads.push(subject);
            let outcome = rejectOldSubject && subject === 'technology' ? 'error' : emptyCurrent ? 'empty' : 'success';
            if (holdNext) {
                holdNext = false;
                assert.equal(subject, 'technology', 'only the old subject read is held');
                heldSeen();
                outcome = await new Promise(resolve => { releaseHeld = resolve; });
            }
            await route.fulfill({ status: outcome === 'error' ? 403 : 200,
                contentType: 'application/json',
                body: JSON.stringify(outcome === 'error' ? { code: '42501', message: 'Fixture read denied' }
                    : outcome === 'empty' ? [] : [sparkRow(subject)]) });
        });
        // A returning learner's real cloud snapshot avoids the unrelated first-login bonus write.
        await page.route(/https:\/\/fixture\.supabase\.co\/rest\/v1\/rpc\/get_own_student_progress(?:_summary)?_v2$/, route => route.fulfill({
            contentType: 'application/json', body: JSON.stringify({ user_id: fixture.ids.user, coins: 1,
                coinData: { balance: 1, giftCoins: 0, totalEarned: 1, totalSpent: 0, totalGifted: 0 }, coinHistory: [],
                studentProfile: { firstName: 'Fixture', lastName: 'Student', grade: '9', group: 'A' },
                units: { [`assignment:${fixture.ids.assignment}`]: { scores: Object.fromEntries(
                    ['flashcards', 'matching', 'fill-in-blank'].map(type => [type, { score: 100, isComplete: true, verified: true }])),
                    states: {}, images: {}, wordHunt: {} } } })
        }));
        await page.route('https://fixture.supabase.co/rest/v1/student_spark_responses?**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
        try {
            await page.goto(`${baseUrl}/student.html#/menu`);
            await page.waitForFunction(() => window.studentApp?.authInitialized && !studentApp.routing.isApplyingRoute);
            await page.locator('.student-spark-card h3').filter({ hasText: 'Technology current Spark' }).waitFor({ state: 'attached' });
            await page.waitForLoadState('networkidle');
            if (scenario === 'current-and-cached') {
                const count = reads.length;
                await loadCurrentHost(page);
                assert.equal(reads.length, count, 'ordinary current cached read makes no new request');
                await clearSparkCache(page);
                await loadCurrentHost(page);
                assert.equal(reads.length, count + 1, 'uncached current read reaches the actual REST boundary');
                await page.evaluate(() => studentApp.activities.renderStudentHome());
                await page.waitForFunction(() => document.querySelector('.student-spark-card h3')?.textContent === 'Technology current Spark');
                const result = await state(page);
                assert.equal(result.sparkId, 'technology-spark');
                assert.equal(result.tab, true);
            } else if (scenario === 'current-empty') {
                emptyCurrent = true;
                await clearSparkCache(page);
                await loadCurrentHost(page);
                const result = await state(page);
                assert.equal(result.sparkId, null);
                assert.equal(result.tab, false);
                assert.equal(result.weekSelected, 'true');
                assert.equal(result.weekActive, true);
            } else {
                await clearSparkCache(page);
                holdNext = true;
                await page.evaluate(() => {
                    window.__oldSparkHost = document.querySelector('.student-spark-host');
                    window.__oldSparkLoad = studentApp.activities.loadAndRenderCurrentSpark(window.__oldSparkHost);
                });
                let holdDeadline;
                try {
                    await Promise.race([held, new Promise((_, reject) => {
                        holdDeadline = setTimeout(() => reject(new Error('Actual old Spark REST read was not reached')), 10000);
                    })]);
                } finally { clearTimeout(holdDeadline); }
                await page.evaluate(() => studentApp.selectSubject('science'));
                await page.waitForFunction(() => document.querySelector('.student-spark-card h3')?.textContent === 'Science current Spark');
                assert.equal(await page.evaluate(() => window.__oldSparkHost.isConnected), false, 'public subject selection replaced the dashboard');
                assert.equal((await state(page)).sparkId, 'science-spark', 'new current query published before old completion');
                rejectOldSubject = scenario === 'stale-error';
                releaseHeld(scenario.replace('stale-', ''));
                await page.evaluate(() => window.__oldSparkLoad);
                const result = await state(page);
                console.log(JSON.stringify({ scenario, actual: result, reads }));
                assert.deepEqual({ title: result.title, sparkId: result.sparkId, tab: result.tab, subject: result.subject },
                    { title: 'Science current Spark', sparkId: 'science-spark', tab: true, subject: 'science' },
                    'an obsolete real REST response must not change the replacement Home snapshot or global Spark tab');
            }
            console.log(`PASS ${scenario} (${built ? 'built' : 'source'} actual app)`);
        } catch (error) {
            failures.push({ scenario, message: error.message });
            console.error(`FAIL ${scenario}: ${error.message}`);
        } finally {
            // Check these even when the ownership assertion is red; a regression must not hide fixture writes/errors.
            try {
                assert.deepEqual(mutations, [], 'no direct backend writes');
                assert.deepEqual(fixture.calls.filter(call => /^(submit|save|upsert|claim|report|spend|start|update|delete|create|accept)_/.test(call.name)), [], 'no mutation RPCs');
                assert.deepEqual(fixture.errors, []);
                assert.equal(await page.evaluate(() => studentApp.currentUser.uid || studentApp.currentUser.id), fixture.ids.user);
                console.log(`PASS ${scenario}: unchanged actor, no writes or uncaught page errors`);
            } catch (error) {
                failures.push({ scenario: `${scenario}: boundary`, message: error.message });
                console.error(`FAIL ${scenario} boundary: ${error.message}`);
            }
            releaseHeld?.('empty');
            await context.close();
        }
    }
} finally {
    await browser?.close();
    if (server) {
        const closed = new Promise(resolve => server.once('close', resolve));
        server.kill();
        await closed;
    }
}
assert.deepEqual(failures, [], 'all actual-app Home/Spark ownership controls must pass');
