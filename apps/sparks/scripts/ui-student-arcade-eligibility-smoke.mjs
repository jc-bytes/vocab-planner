import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installStudentAssignedFlowFixture } from './lib/student-assigned-flow-fixture.mjs';

const port = Number(process.env.UI_ARCADE_ELIGIBILITY_PORT || 19859);
const baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_ARCADE_ELIGIBILITY_DIST === '1';
let server, browser;
const settled = page => page.waitForFunction(() => window.studentApp?.authInitialized && !studentApp.routing.isApplyingRoute);
const arcadeVisible = page => page.evaluate(() => document.querySelector('#arcade-view')?.classList.contains('active'));
async function heldRead(fixture) {
    await assert.doesNotReject(async () => {
        const deadline = Date.now() + 10000;
        while (!fixture.hasPendingRead() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
        assert.equal(fixture.hasPendingRead(), true);
    });
}
try {
    server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    for (const scenario of ['incomplete', 'eligible', 'held-incomplete', 'held-eligible', 'failed-retry', 'cancel-held', 'empty', 'held-resume', 'held-launch', 'held-restart', 'held-purchase']) {
        const page = await browser.newPage();
        const complete = ['eligible', 'held-eligible', 'cancel-held', 'failed-retry'].includes(scenario);
        const fixture = await installStudentAssignedFlowFixture(page, { completeRequiredActivities: complete, startEnrolled: scenario !== 'empty' });
        const held = scenario.startsWith('held-') || scenario === 'cancel-held';
        if (held) fixture.holdReads();
        let fail = scenario === 'failed-retry';
        if (fail) await page.route('https://fixture.supabase.co/rest/v1/rpc/read_class_assignment_v1', route => fail
            ? route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
                body: JSON.stringify({ code: 'FIXTURE_UNAVAILABLE', message: 'Controlled assignment read unavailable' }) }) : route.fallback());
        await page.goto(`${baseUrl}/student.html#/arcade`);
        if (held) {
            await heldRead(fixture);
            assert.equal(await arcadeVisible(page), false, 'Unknown assignment state cannot open Arcade');
            assert.equal(await page.evaluate(() => !!studentApp.routing.games), false);
            if (['held-resume', 'held-launch', 'held-restart', 'held-purchase'].includes(scenario)) {
                await page.evaluate(async scenario => { const g = await studentApp.getGames(); g.gameTimeRemaining = 60; window.arcadeAccessAttempt = scenario === 'held-resume' ? g.startGame('galactic-breaker') : scenario === 'held-launch' ? g.launchGame('galactic-breaker') : scenario === 'held-restart' ? g.lifecycle.restartCurrentGame('galactic-breaker') : g.requestAdditionalTime(); }, scenario);
                assert.equal(await page.locator('#game-stage').evaluate(el => el.classList.contains('hidden')), true);
                assert.equal(fixture.calls.filter(call => call.name === 'start_student_arcade_minute_owned_v1').length, 0);
            }
            if (scenario === 'cancel-held') {
                await page.evaluate(() => studentApp.navigateTo({ view: 'menu' }));
                await settled(page);
                assert.equal(await page.locator('#main-menu-view').evaluate(el => el.classList.contains('active')), true);
            }
            fixture.releaseRead();
        }
        await settled(page);
        if (scenario === 'failed-retry') {
            assert.equal(await arcadeVisible(page), false);
            assert.equal(await page.evaluate(() => !!studentApp.routing.games), false);
            await page.getByRole('heading', { name: 'Arcade could not load' }).waitFor();
            fail = false;
            await page.getByRole('button', { name: 'Try again', exact: true }).click();
            await page.locator('#arcade-view.active').waitFor();
            await settled(page);
        } else if (scenario === 'cancel-held') {
            await page.waitForFunction(() => studentApp.activities.vocabularyData.classSelection?.ready);
            assert.equal(new URL(page.url()).hash, '#/menu');
            assert.equal(await arcadeVisible(page), false);
        } else if (complete || scenario === 'empty') {
            assert.equal(await arcadeVisible(page), true);
            await page.locator('#game-selection:not(.hidden) #play-current-game-btn').waitFor();
        } else {
            assert.equal(await arcadeVisible(page), false);
            await page.locator('#activity-menu-view.active').waitFor();
            assert.equal(await page.evaluate(() => studentApp.activities.getPendingRequiredWork().isBlocked), true);
        }
        if (scenario.startsWith('held-') && !['held-incomplete', 'held-eligible'].includes(scenario)) {
            assert.equal(await page.evaluate(() => window.arcadeAccessAttempt), false);
            assert.equal(fixture.calls.filter(call => call.name === 'start_student_arcade_minute_owned_v1').length, 0);
        }
        assert.deepEqual(fixture.errors, []);
        console.log(`${scenario}: real Arcade readiness and route ownership passed`);
        await page.close();
    }

    for (const scenario of ['paid-blocked', 'missing-blocked', 'invalid-lookup']) {
        const page = await browser.newPage();
        const fixture = await installStudentAssignedFlowFixture(page);
        const lookups = [];
        await page.route('https://fixture.supabase.co/rest/v1/rpc/recover_student_arcade_minute_owned_v1', route => {
            lookups.push(route.request().postDataJSON());
            const data = scenario === 'paid-blocked' ? { receiptFound: true, purchase: { minuteSeconds: 60, coinCost: 10,
                coinWallet: { userId: fixture.ids.user, coins: 0 }, arcadeTime: { userId: fixture.ids.user, availableSeconds: 0 } } }
                : scenario === 'missing-blocked' ? { receiptFound: false } : null;
            return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(data) });
        });
        await page.goto(`${baseUrl}/student.html#/unit/assignment.${fixture.ids.assignment}`);
        await settled(page);
        await page.waitForFunction(() => studentApp.activities.vocabularyData.classSelection?.ready);
        assert.equal(await page.evaluate(() => studentApp.activities.getPendingRequiredWork().isBlocked), true);
        await page.evaluate(owner => localStorage.setItem(`student_arcade_session_v2:${owner}`, JSON.stringify({
            remainingSeconds: 0, gameId: 'snake', lastAppliedEventId: '', pendingPurchase: {
                eventId: 'arcade-minute:browser-unknown', gameId: 'snake', clientId: 'receipt-client'
            }
        })), fixture.ids.user);
        const result = await page.evaluate(async owner => {
            const games = await studentApp.getGames();
            let error;
            try { await games.loadArcadeTime({ force: true }); } catch (failure) { error = failure.code; }
            return { error, seconds: games.gameTimeRemaining, saved: JSON.parse(localStorage.getItem(`student_arcade_session_v2:${owner}`)) };
        }, fixture.ids.user);
        assert.equal(lookups.length, 1);
        assert.equal(lookups[0].p_expected_user_id, fixture.ids.user);
        assert.equal(lookups[0].p_client_id, 'receipt-client');
        assert.equal(lookups[0].p_event_id, 'arcade-minute:browser-unknown');
        assert.equal(fixture.calls.filter(call => call.name === 'start_student_arcade_minute_owned_v1').length, 0);
        if (scenario === 'paid-blocked') {
            assert.equal(result.error, undefined);
            assert.equal(result.seconds, 60);
            assert.equal(result.saved.pendingPurchase, null);
            assert.equal(result.saved.lastAppliedEventId, 'arcade-minute:browser-unknown');
            assert.equal(await page.evaluate(async () => { const games = await studentApp.getGames(); await games.loadArcadeTime({ force: true }); return games.gameTimeRemaining; }), 60);
        } else {
            assert.equal(result.seconds, 0);
            assert.equal(result.error, scenario === 'missing-blocked' ? 'ARCADE_REQUIRED_WORK' : 'INVALID_ARCADE_RECOVERY_RESPONSE');
            assert.equal(result.saved.pendingPurchase.eventId, 'arcade-minute:browser-unknown');
        }
        assert.deepEqual(fixture.errors, []);
        console.log(`${scenario}: real replay-only lookup cannot turn recovery into a new debit`);
        await page.close();
    }
} finally { await browser?.close(); server?.kill(); }

