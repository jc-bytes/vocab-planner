import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installStudentAssignedFlowFixture } from './lib/student-assigned-flow-fixture.mjs';

const port = Number(process.env.UI_STUDENT_HOME_PRESENTATION_PORT || 19879), baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_STUDENT_HOME_PRESENTATION_DIST === '1';
const manifest = built ? JSON.parse(await readFile(new URL('../dist-desktop/.vite/manifest.json', import.meta.url), 'utf8')) : null;
const renderer = manifest ? `/${manifest['js/student/studentHomeRenderer.js'].file}` : '/js/student/studentHomeRenderer.js';
const styles = manifest ? (() => { const entry = manifest['js/student/studentHomeStyles.js']; return entry.css?.map(path => `/${path}`) || [`/${entry.file}`]; })()
    : ['/js/student/studentHomeStyles.js', '/css/student-home.css'];
const optional = new Set([renderer, ...styles, ...(!built ? ['/js/student/studentHomePresentation.js'] : [])]);
const settled = page => page.waitForFunction(() => window.studentApp?.authInitialized && !studentApp.routing.isApplyingRoute);
const homeReady = page => page.waitForFunction(() => document.querySelector('#main-menu-view.active[aria-busy="false"] .student-continue-hero'));
let browser, server;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    for (const route of ['units', 'sparks', 'arcade', 'flashcards', 'unit', 'home']) {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        const fixture = await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
        let releaseClassRead;
        if (route === 'unit') {
            const released = new Promise(resolve => { releaseClassRead = resolve; });
            await page.route('**/rest/v1/rpc/my_teaching_classes_v1', async route => { await released; await route.fallback(); });
        }
        const requests = [];
        page.on('request', request => { const path = new URL(request.url()).pathname; if (optional.has(path)) requests.push(path); });
        const unit = `assignment.${fixture.ids.assignment}`;
        const hash = route === 'flashcards' ? `#/unit/${unit}/activity/flashcards` : route === 'unit' ? `#/unit/${unit}` : route === 'home' ? '#/menu' : `#/${route}`;
        await page.goto(`${baseUrl}/student.html${hash}`); await settled(page);
        if (route === 'home') await homeReady(page);
        if (route === 'flashcards') await page.waitForFunction(() => !!studentApp.activityInstance);
        if (route === 'unit') {
            await page.locator('#activity-menu-view.active[aria-busy="false"] .activity-card[data-activity="flashcards"]').waitFor();
            assert.equal(await page.evaluate(() => !!studentApp.activities.vocabularyData.classSelection?.ready), false,
                'Unit Menu can finish before its background class snapshot');
            releaseClassRead();
        }
        // Authentication/route readiness does not include the asynchronous shared class selector.
        await page.waitForFunction(() => {
            const selection = studentApp.activities.vocabularyData.classSelection;
            const option = document.querySelector('#student-subject-picker .student-subject-option[aria-selected="true"]');
            return selection?.ready && !selection.pending && selection.owner === studentApp.currentUser?.uid
                && option?.dataset.subjectSlug === selection.selectedId;
        });
        assert.equal(requests.includes(renderer), route === 'home', `${route}: cold Home implementation`);
        for (const path of styles) assert.equal(requests.includes(path), route === 'home', `${route}: cold Home styles`);
        if (route !== 'home') {
            await page.evaluate(async () => {
                await studentApp.activities.refreshCurrentSparkGate({ updateDisplay: false });
                await studentApp.activities.flushPendingActivityProgress();
            });
            assert.equal(requests.length, 0, 'Headless required-work/flush paths do not request Home presentation');
        }
        await page.evaluate(() => studentApp.navigateTo({ view: 'menu' })); await homeReady(page);
        assert.equal(requests.filter(path => path === renderer).length, 1);
        await page.evaluate(() => studentApp.navigateTo({ view: 'units' })); await settled(page);
        await page.evaluate(() => studentApp.navigateTo({ view: 'menu' })); await homeReady(page);
        assert.equal(requests.filter(path => path === renderer).length, 1, 'Warm Home retains implementation/styles');
        assert.deepEqual(fixture.errors, []);
        console.log(`${route}: cold Home ownership, headless gate independence and warm return passed.`);
        await context.close();
    }
    {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
        let enter, release;
        const entered = new Promise(resolve => { enter = resolve; });
        await page.route(`**${renderer}`, async route => { enter(); await new Promise(resolve => { release = resolve; }); await route.continue(); });
        await page.goto(`${baseUrl}/student.html#/units`); await settled(page);
        await page.evaluate(() => { void studentApp.navigateTo({ view: 'menu' }); });
        let timer;
        try { await Promise.race([entered, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Home import did not begin')), 10000); })]); }
        finally { clearTimeout(timer); }
        await page.evaluate(() => { void studentApp.navigateTo({ view: 'arcade' }); });
        release(); await settled(page); await page.locator('#arcade-view.active').waitFor();
        assert.equal(new URL(page.url()).hash, '#/arcade');
        assert.equal(await page.locator('#student-home-dashboard .student-continue-hero').count(), 0);
        console.log('Held Home import released immediately after Arcade intent cannot paint obsolete Home.');
        await context.close();
    }
    for (const fault of ['code', 'styles']) {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
        let failures = 0, mainNavigations = 0;
        page.on('framenavigated', frame => { if (frame === page.mainFrame()) mainNavigations++; });
        await page.addInitScript(() => { window.homePreloadFaults = 0; addEventListener('vite:preloadError', () => homePreloadFaults++); });
        await page.route(`**${fault === 'code' ? renderer : styles[0]}`, route => { failures++; return route.fulfill({ status: 503, contentType: fault === 'code' ? 'text/javascript' : 'text/css', body: 'Controlled Home feature failure' }); });
        await page.goto(`${baseUrl}/student.html#/menu`); await settled(page);
        await page.getByText('Could not load Home. Open Units or try again. If retrying does not help, reload the page.', { exact: false }).waitFor();
        await page.getByRole('button', { name: 'Try again', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('#main-menu-view')?.getAttribute('aria-busy') === 'false');
        assert.equal(await page.locator('#student-home-dashboard .student-continue-hero').count(), 0, 'A failed retained CSS import never permits an unstyled retry');
        if (fault === 'styles') assert.equal(failures, 1);
        if (built) assert.ok(await page.evaluate(() => homePreloadFaults) > 0, 'Real Vite preload failure is exercised');
        assert.equal(new URL(page.url()).hash, '#/menu');
        assert.equal(mainNavigations, 1, 'Actual Home recovery is not preempted by automatic reload');
        await page.evaluate(() => studentApp.navigateTo({ view: 'units' })); await settled(page);
        await page.locator('#vocab-selection-view.active').waitFor();
        console.log(`${fault}: bounded honest Home recovery and reachable Units passed.`);
        await context.close();
    }
    for (const order of ['home-first', 'activity-first']) {
        const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 900 }, timezoneId: 'America/Panama' });
        const page = await context.newPage();
        const fixture = await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
        fixture.detail.vocabularyPlacement = { ...fixture.detail.vocabularyPlacement, assignedDate: '2026-10-22', week: 4 };
        await page.clock.setFixedTime(new Date('2026-10-25T15:00:00Z'));
        const unitId = `assignment.${fixture.ids.assignment}`;
        await page.goto(`${baseUrl}/student.html${order === 'home-first' ? '#/menu' : `#/unit/${unitId}/activity/flashcards`}`);
        await settled(page);
        if (order === 'home-first') {
            await homeReady(page);
            await page.evaluate(unitId => studentApp.navigateTo({ view: 'activity', unitId, activityType: 'flashcards' }), unitId);
        }
        await page.waitForFunction(() => studentApp.currentActivityType === 'flashcards' && !!studentApp.activityInstance);
        await page.evaluate(() => studentApp.navigateTo({ view: 'menu' })); await homeReady(page);
        await page.locator('.student-home-unit').first().waitFor();
        const runtimeCSS = manifest?.['js/student/studentFeatureStyles.js']?.file;
        const actual = await page.evaluate(({ homeCSS, runtimeCSS }) => {
            const css = selector => getComputedStyle(document.querySelector(selector));
            const count = (source, path) => [...document.styleSheets].filter(sheet => {
                const owner = sheet.ownerNode;
                return path ? owner?.href?.endsWith(`/${path}`) : owner?.dataset?.viteDevId?.endsWith(source);
            }).length;
            return {
                unit: { padding: css('.student-home-unit').padding, minHeight: css('.student-home-unit').minHeight, gap: css('.student-home-unit').gap },
                icon: css('.student-home-unit-icon').width, panel: css('.student-home-panel').padding,
                tab: css('.student-home-tab').padding,
                title: { fontSize: css('.student-home-unit-copy strong').fontSize, lineHeight: css('.student-home-unit-copy strong').lineHeight },
                homeSheets: count('/css/student-home.css', homeCSS), runtimeSheets: count('/css/student-features.css', runtimeCSS)
            };
        }, { homeCSS: built ? styles.find(path => path.endsWith('.css'))?.slice(1) : null, runtimeCSS });
        assert.deepEqual(actual, {
            unit: { padding: '12px 0px', minHeight: '64px', gap: '8.8px' }, icon: '34px', panel: '0px', tab: '7.2px 5.6px',
            title: { fontSize: '13.76px', lineHeight: '15.824px' }, homeSheets: 1, runtimeSheets: 1
        }, 'Both real load orders preserve the accepted warm mobile layout and apply each stylesheet once');
        assert.deepEqual(fixture.errors, []);
        console.log(`${order}: preserved warm Home cascade and one applied copy of each stylesheet.`);
        await context.close();
    }
} finally { await browser?.close(); server?.kill(); }
