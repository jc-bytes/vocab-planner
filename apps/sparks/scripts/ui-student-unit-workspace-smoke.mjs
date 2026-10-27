import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installStudentAssignedFlowFixture } from './lib/student-assigned-flow-fixture.mjs';
import { installTeacherFeatureFixture } from './lib/teacher-feature-fixture.mjs';
import { collectStaticDeliveryFiles } from './lib/deliverySizeBudgets.mjs';

const port = Number(process.env.UI_STUDENT_UNIT_WORKSPACE_PORT || 19880), baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_STUDENT_UNIT_WORKSPACE_DIST === '1';
const manifest = built ? JSON.parse(await readFile(new URL('../dist-desktop/.vite/manifest.json', import.meta.url), 'utf8')) : null;
const workspacePath = manifest ? `/${manifest['js/student/studentUnitWorkspace.js'].file}` : '/js/student/studentUnitWorkspace.js';
const stylePaths = manifest ? manifest['js/student/studentUnitMenuStyles.js'].css.map(path => `/${path}`)
    : ['/js/student/studentUnitMenuStyles.js', '/css/student-unit-menu.css', '/css/floating-action-menu.css'];
const optionalPaths = new Set([workspacePath, ...stylePaths, ...(!built ? ['/js/student/studentActivityCards.js', '/js/student/studentUnitMenuGate.js', '/js/ui/floatingActionMenu.js'] : [])]);
const settled = page => page.waitForFunction(() => window.studentApp?.authInitialized && !studentApp.routing.isApplyingRoute);
let browser, server;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    for (const route of ['menu', 'units', 'sparks', 'arcade', 'flashcards', 'unit']) {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        const fixture = await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
        const requests = [];
        page.on('request', request => { const path = new URL(request.url()).pathname; if (optionalPaths.has(path)) requests.push(path); });
        const unit = `assignment.${fixture.ids.assignment}`;
        const hash = route === 'flashcards' ? `#/unit/${unit}/activity/flashcards` : route === 'unit' ? `#/unit/${unit}` : `#/${route}`;
        await page.goto(`${baseUrl}/student.html${hash}`); await settled(page);
        if (route === 'flashcards') await page.waitForFunction(() => !!studentApp.activityInstance);
        assert.equal(await page.evaluate(() => !!studentApp.activities.menu.workspace), route === 'unit', `${route}: workspace ownership`);
        assert.equal(requests.includes(workspacePath), route === 'unit', `${route}: cold code request`);
        for (const path of stylePaths) assert.equal(requests.includes(path), route === 'unit', `${route}: cold style ${path}`);
        if (route !== 'unit') {
            await page.evaluate(async () => {
                await studentApp.activities.flushPendingActivityProgress();
                if (!studentApp.currentActivityType) studentApp.activities.progressPersistence.applyActivityProgressResult({ totalXp: 0 });
            });
            assert.equal(requests.length, 0, 'Background acknowledgement and flush cannot demand Menu');
        }
        await page.evaluate(unitId => studentApp.navigateTo({ view: 'unit', unitId }), unit);
        await settled(page);
        await page.locator('#activity-menu-view.active .activity-card[data-activity="flashcards"]').waitFor();
        assert.equal(requests.filter(path => path === workspacePath).length, 1);
        const guide = page.locator('dialog.ember-spotlight[open]');
        if (await guide.count()) await guide.getByRole('button', { name: 'Skip guide', exact: true }).click();
        await page.getByRole('button', { name: 'Export options', exact: true }).click();
        await page.locator('#student-vocab-export-menu .floating-action-menu:popover-open').waitFor();
        await page.keyboard.press('Escape');
        await page.locator('#activity-menu-view [data-activity="flashcards"]').click();
        await page.waitForFunction(() => !!studentApp.activityInstance && studentApp.currentActivityType === 'flashcards');
        if (await guide.count()) await guide.getByRole('button', { name: 'Skip guide', exact: true }).click();
        await page.locator('#back-to-menu-btn').click(); await settled(page);
        await page.locator('#activity-menu-view.active .activity-card').first().waitFor();
        assert.equal(requests.filter(path => path === workspacePath).length, 1, 'Warm Back reuses one workspace');
        assert.deepEqual(fixture.errors, []);
        console.log(`${route}: cold ownership, export, activity and warm Back passed.`);
        await context.close();
    }
    {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        const fixture = await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
        let release, reached;
        const entered = new Promise(resolve => { reached = resolve; });
        await page.route(`**${workspacePath}`, async route => { reached(); await new Promise(resolve => { release = resolve; }); await route.continue(); });
        await page.goto(`${baseUrl}/student.html#/unit/assignment.${fixture.ids.assignment}`, { waitUntil: 'domcontentloaded' });
        await Promise.race([entered, new Promise((_, reject) => setTimeout(() => reject(new Error('Menu import did not begin')), 10000))]);
        await page.evaluate(() => { void studentApp.navigateTo({ view: 'menu' }); });
        release(); await settled(page);
        assert.equal(await page.evaluate(() => studentApp.activities.menu.workspace), null);
        assert.equal(new URL(page.url()).hash, '#/menu');
        await page.locator('#main-menu-view.active').waitFor();
        console.log('Held workspace released immediately after Home intent never constructs or paints stale Menu.');
        await context.close();
    }
    for (const destination of ['home', 'same-unit']) {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        const fixture = await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
        let workspaceRequests = 0;
        page.on('request', request => { if (new URL(request.url()).pathname === workspacePath) workspaceRequests++; });
        await page.goto(`${baseUrl}/student.html#/menu`); await settled(page);
        await page.waitForFunction(() => studentApp.activities.vocabularyData.classSelection?.ready);
        fixture.holdReads();
        const unitId = `assignment.${fixture.ids.assignment}`;
        await page.evaluate(unitId => { void studentApp.navigateTo({ view: 'unit', unitId }); }, unitId);
        for (let attempt = 0; attempt < 100 && !fixture.hasPendingRead(); attempt++) await page.waitForTimeout(20);
        assert.ok(fixture.hasPendingRead(), 'Actual assignment read entered before navigation');
        await page.evaluate(({ destination, unitId }) => {
            void studentApp.navigateTo({ view: 'menu' });
            if (destination === 'same-unit') void studentApp.navigateTo({ view: 'unit', unitId });
        }, { destination, unitId });
        fixture.releaseRead(); await settled(page);
        if (destination === 'home') {
            await page.locator('#main-menu-view.active').waitFor();
            assert.equal(new URL(page.url()).hash, '#/menu');
            assert.equal(workspaceRequests, 0, 'Old assignment read cannot acquire Menu under the newer Home signal');
            assert.equal(await page.evaluate(() => studentApp.currentVocab), null);
        } else {
            await page.locator('#activity-menu-view.active .activity-card').first().waitFor();
            assert.equal(workspaceRequests, 1, 'Only the fresh same-hash route acquires Menu');
            assert.equal(new URL(page.url()).hash, `#/unit/${unitId}`);
        }
        assert.deepEqual(fixture.errors, []);
        console.log(`Held actual assignment read → ${destination} preserves parent navigation ownership.`);
        await context.close();
    }
    for (const failure of ['code', 'styles']) {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        const fixture = await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
        let mainNavigations = 0;
        page.on('framenavigated', frame => { if (frame === page.mainFrame()) mainNavigations++; });
        await page.addInitScript(() => {
            window.unitPreloadFaults = 0;
            addEventListener('vite:preloadError', () => unitPreloadFaults++);
        });
        let requests = 0;
        const path = failure === 'code' ? workspacePath : stylePaths[0];
        await page.route(`**${path}`, route => { requests++; return route.fulfill({ status: 503, contentType: failure === 'code' ? 'text/javascript' : 'text/css', body: 'Controlled unavailable unit feature' }); });
        await page.goto(`${baseUrl}/student.html#/unit/assignment.${fixture.ids.assignment}`); await settled(page);
        await page.getByRole('heading', { name: 'Unit did not load' }).waitFor();
        assert.equal(await page.evaluate(() => studentApp.activities.menu.workspace), null);
        await page.getByRole('button', { name: 'Try again', exact: true }).click();
        await page.getByRole('heading', { name: 'Unit did not load' }).waitFor();
        if (failure === 'styles') assert.equal(requests, 1, 'Failed CSS is retained, never a false successful retry');
        assert.equal(mainNavigations, 1, 'Menu owns failure recovery without an automatic document reload');
        if (built) assert.ok(await page.evaluate(() => unitPreloadFaults) > 0, 'Actual Vite preload error reached the Menu-owned recovery boundary');
        await page.evaluate(() => studentApp.navigateTo({ view: 'menu' }));
        await page.locator('#main-menu-view.active').waitFor();
        console.log(`${failure} failure retains honest retry/reload guidance and reachable Home.`);
        await context.close();
    }
    for (const initialActivity of [null, 'quiz']) {
        const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
        await installTeacherFeatureFixture(page);
        const requested = new Set();
        page.on('request', request => { if (request.frame().parentFrame()) requested.add(new URL(request.url()).pathname); });
        await page.goto(`${baseUrl}/teacher.html#/teacher/vocabulary`);
        await page.waitForFunction(() => window.teacherApp?.isAuthenticated && teacherApp.routeReady && !teacherApp.isApplyingRoute);
        await page.evaluate(async ({ path, css, initialActivity }) => {
            await Promise.all(css.map(href => new Promise((resolve, reject) => {
                if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === new URL(href, location.href).href && link.sheet)) return resolve();
                const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href;
                const timer = setTimeout(() => reject(new Error('Preview CSS did not settle')), 10000);
                link.onload = () => { clearTimeout(timer); resolve(); }; link.onerror = () => { clearTimeout(timer); reject(new Error('Preview CSS failed')); };
                document.head.append(link);
            })));
            const { previewTeacherUnit } = await import(path);
            await previewTeacherUnit(await teacherApp.getTeacherLibrary(), { id: 'workspace-preview', name: 'Workspace preview', grade: '6',
                words: ['Browser', 'Network', 'Packet', 'Server', 'Client'].map(word => ({ word, definition: `${word} definition` })) }, 'local', () => true,
                initialActivity ? { initialActivity } : {});
        }, { path: manifest ? `/${manifest['js/teacherStudentPreview.js'].file}` : '/js/teacherStudentPreview.js', initialActivity,
            css: manifest ? [...collectStaticDeliveryFiles(manifest, 'js/teacherStudentPreview.js')].filter(path => path.endsWith('.css')).map(path => `/${path}`) : [] });
        const frame = page.frameLocator('.teacher-unit-preview-frame');
        await page.addLocatorHandler(frame.getByRole('button', { name: 'Skip guide', exact: true }), async locator => locator.click());
        if (initialActivity) {
            await frame.locator('#activity-view:not(.hidden) .quiz-container').waitFor();
            assert.equal(requested.has(workspacePath), false, 'Direct teacher Quiz skips Menu implementation');
            for (const path of stylePaths) assert.equal(requested.has(path), false, 'Direct teacher Quiz skips Menu styles');
        } else {
            await frame.locator('#activity-menu-view:not(.hidden) [data-activity="flashcards"]').click();
            await frame.locator('#activity-view:not(.hidden) .flashcard').first().waitFor();
            await frame.locator('#back-to-menu-btn').click();
            await frame.locator('#activity-menu-view:not(.hidden) .activity-card').first().waitFor();
            assert.equal(requested.has(workspacePath), true, 'Normal preview owns and retains Menu');
        }
        console.log(`Teacher preview ${initialActivity || 'Menu/Flashcards/Back'} preserves explicit workspace ownership.`);
        await context.close();
    }
} finally { await browser?.close(); server?.kill(); }
