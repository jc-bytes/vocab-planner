import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installStudentAssignedFlowFixture } from './lib/student-assigned-flow-fixture.mjs';
import { installTeacherFeatureFixture } from './lib/teacher-feature-fixture.mjs';
import { collectStaticDeliveryFiles } from './lib/deliverySizeBudgets.mjs';

const port = Number(process.env.UI_STUDENT_LIBRARY_STYLES_PORT || 19881), baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_STUDENT_LIBRARY_STYLES_DIST === '1';
const manifest = built ? JSON.parse(await readFile(new URL('../dist-desktop/.vite/manifest.json', import.meta.url), 'utf8')) : null;
const cssFiles = entry => { const item = manifest[entry]; return item.css?.map(path => `/${path}`) || [`/${item.file}`]; };
const shared = built ? cssFiles('js/student/studentLibraryStyles.js') : ['/css/student-library.css', '/css/learning-library-appearance.css'];
const specialized = built ? cssFiles('js/student/studentClassSparkStyles.js') : ['/css/student-class-spark.css'];
const settled = page => page.waitForFunction(() => window.studentApp?.authInitialized && !studentApp.routing.isApplyingRoute);
const unitRoute = '#/units?trimester=IIIT&month=october', sparkRoute = '#/sparks?trimester=IIIT&month=october';
const sparkId = '77777777-7777-4777-8777-777777777778';
let browser, server;
async function fixture(page) {
    const f = await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
    f.detail.vocabularyPlacement = { ...f.detail.vocabularyPlacement, assignedDate: '2026-10-22', week: 4 };
    const spark = { id: sparkId, class_id: f.ids.class, kind: 'spark', title: 'Reliable library source', release_at: '2026-10-22T12:00:00Z' };
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-expose-headers': 'content-range' };
    await page.route(url => url.hostname === 'fixture.supabase.co' && url.pathname === '/rest/v1/class_assignments', route => route.fulfill({
        headers: { ...headers, 'content-range': '0-1/2' }, json: [spark, { id: f.ids.assignment, class_id: f.ids.class, kind: 'vocabulary', title: f.detail.title, release_at: '2026-10-22T12:00:00Z' }] }));
    await page.route(url => url.hostname === 'fixture.supabase.co' && url.pathname === '/rest/v1/rpc/read_class_assignment_v1', route => route.fulfill({ headers,
        json: route.request().postDataJSON()?.p_assignment_id === sparkId ? { ...spark, content: { sparkText: 'A reliable source supports its claim with evidence.', whyItMatters: 'Check the source.', question: 'What supports a claim?', checkMode: 'reading_only' } } : f.detail }));
    await page.clock.setFixedTime(new Date('2026-10-25T15:00:00Z'));
    return f;
}
async function gotoLibrary(page, view) {
    await page.evaluate(route => studentApp.navigateTo(route), { view, trimester: 'IIIT', month: 'october' });
    await settled(page);
    await page.locator(view === 'units' ? '#vocab-list .student-vocab-card' : '#student-sparks-library .student-spark-card').first().waitFor();
}
try {
    server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    for (const view of ['menu', 'arcade', 'flashcards', 'unit']) {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        const f = await fixture(page), requested = [];
        page.on('request', request => { const path = new URL(request.url()).pathname; if ([...shared, ...specialized].includes(path)) requested.push(path); });
        const hash = view === 'flashcards' ? `#/unit/assignment.${f.ids.assignment}/activity/flashcards` : view === 'unit' ? `#/unit/assignment.${f.ids.assignment}` : `#/${view}`;
        await page.goto(`${baseUrl}/student.html${hash}`); await settled(page);
        if (view === 'flashcards') await page.waitForFunction(() => !!studentApp.activityInstance);
        await page.waitForFunction(() => studentApp.activities.vocabularyData.classSelection?.ready);
        await page.evaluate(async () => { await studentApp.activities.refreshCurrentSparkGate({ updateDisplay: false }); await studentApp.activities.flushPendingActivityProgress(); });
        assert.deepEqual(requested, [], 'Unrelated view and headless reads never acquire library CSS');
        assert.deepEqual(f.errors, []); console.log(`${view}: cold library CSS stays deferred.`);
        await context.close();
    }
    for (const first of ['units', 'sparks']) {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        const f = await fixture(page), requested = [];
        page.on('request', request => { const path = new URL(request.url()).pathname; if ([...shared, ...specialized].includes(path)) requested.push(path); });
        await page.goto(`${baseUrl}/student.html${first === 'units' ? unitRoute : sparkRoute}`); await settled(page);
        for (const view of [first, first === 'units' ? 'sparks' : 'units', first]) {
            await gotoLibrary(page, view);
            await page.locator(view === 'units' ? '#vocab-view-toggle [data-vocab-view-mode="rows"]' : '#spark-view-toggle [aria-label="Show rows"]').click();
            await page.locator(view === 'units' ? '#vocab-list .student-vocab-row:not(.student-vocab-row-header)' : '#student-sparks-library .student-vocab-row:not(.student-vocab-row-header)').first().waitFor();
            await page.locator(view === 'units' ? '#vocab-view-toggle [data-vocab-view-mode="cards"]' : '#spark-view-toggle [aria-label="Show cards"]').click();
            const card = page.locator(view === 'units' ? '#vocab-list .student-vocab-card' : '#student-sparks-library .student-spark-card').first();
            await card.waitFor();
            assert.equal(await card.evaluate(node => getComputedStyle(node).gridTemplateColumns),
                built ? 'auto minmax(0px, 1fr)' : 'minmax(0px, 1fr)',
                'Preserve the accepted source/build priority of the eager option-card primitive');
        }
        for (const path of [...shared, ...specialized]) assert.equal(requested.filter(value => value === path).length, 1, `${path} applied once in either renderer order`);
        const lastShared = Math.max(...shared.map(path => requested.indexOf(path)));
        assert.ok(specialized.every(path => requested.indexOf(path) > lastShared), 'Shared appearance precedes specialized Spark CSS');
        assert.deepEqual(f.errors, []); console.log(`${first} first: both libraries/cards/rows and retained style order pass.`);
        await context.close();
    }
    for (const view of ['units', 'sparks']) {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        await fixture(page); let release, enter;
        const entered = new Promise(resolve => { enter = resolve; });
        await page.route(`**${shared[0]}`, async route => { enter(); await new Promise(resolve => { release = resolve; }); await route.continue(); });
        await page.goto(`${baseUrl}/student.html#/menu`); await settled(page);
        await page.evaluate(view => { void studentApp.navigateTo({ view, trimester: 'IIIT', month: 'october' }); }, view);
        let timer;
        try { await Promise.race([entered, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Library CSS did not start')), 10000); })]); }
        finally { clearTimeout(timer); }
        await page.evaluate(() => { void studentApp.navigateTo({ view: 'menu' }); });
        await page.locator('#main-menu-view.active').waitFor({ timeout: 2000 });
        await settled(page); release(); await page.waitForLoadState('networkidle');
        assert.equal(new URL(page.url()).hash, '#/menu');
        assert.equal(await page.locator('.view.active').getAttribute('id'), 'main-menu-view');
        console.log(`${view}: Home settles while old CSS remains held; late style completion never paints stale library.`);
        await context.close();
    }
    for (const first of ['units', 'sparks']) {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        await fixture(page); let requests = 0, navigations = 0;
        page.on('request', request => { if (request.isNavigationRequest() && request.resourceType() === 'document' && request.frame() === page.mainFrame()) navigations++; });
        await page.addInitScript(() => { window.libraryPreloadFaults = 0; addEventListener('vite:preloadError', () => libraryPreloadFaults++); });
        await page.route(`**${shared[0]}`, route => { requests++; return route.fulfill({ status: 503, contentType: 'text/css', body: 'Controlled unavailable shared library CSS' }); });
        await page.goto(`${baseUrl}/student.html${first === 'units' ? unitRoute : `#/sparks?spark=${sparkId}`}`); await settled(page);
        await page.locator('.view.active .student-library-load-error').waitFor();
        await page.getByRole('button', { name: 'Try again', exact: true }).click(); await settled(page);
        await page.locator('.view.active .student-library-load-error').waitFor();
        await page.evaluate(view => studentApp.navigateTo({ view, trimester: 'IIIT', month: 'october' }), first === 'units' ? 'sparks' : 'units'); await settled(page);
        await page.locator('.view.active .student-library-load-error').waitFor();
        assert.equal(requests, 1, 'The other consumer cannot bypass the retained failed shared import');
        assert.equal(navigations, 1, 'Actual Vite failure is not preempted by automatic document reload');
        if (built) assert.ok(await page.evaluate(() => libraryPreloadFaults) > 0);
        assert.equal(await page.locator('.view.active .student-vocab-card').count(), 0);
        await page.evaluate(() => studentApp.navigateTo({ view: 'menu' })); await page.locator('#main-menu-view.active').waitFor();
        console.log(`${first} shared CSS failure stays honest on retry/other renderer and leaves Home reachable.`);
        await context.close();
    }
    {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        await fixture(page); let failures = 0;
        await page.addInitScript(() => localStorage.setItem('was_logged_in', 'true'));
        await page.route(`**${specialized[0]}`, route => { failures++; return route.fulfill({ status: 503, contentType: 'text/css', body: 'Controlled unavailable specialized Spark CSS' }); });
        await page.goto(`${baseUrl}/student.html#/sparks?spark=${sparkId}`); await settled(page);
        await page.locator('#student-sparks-library .student-library-load-error').waitFor();
        await gotoLibrary(page, 'units');
        await page.evaluate(() => studentApp.navigateTo({ view: 'sparks', sparkId: '77777777-7777-4777-8777-777777777778' })); await settled(page);
        await page.locator('#student-sparks-library .student-library-load-error').waitFor();
        assert.equal(failures, 1, 'Early skeleton/returning-shell acquisition shares renderer failure and never false-succeeds');
        console.log('Specialized Spark CSS failure is retained from the first skeleton; healthy Units remains usable.');
        await context.close();
    }
    {
        const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
        const f = await installTeacherFeatureFixture(page);
        await page.goto(`${baseUrl}/teacher.html#/teacher/sparks`);
        await page.waitForFunction(() => window.teacherApp?.isAuthenticated && teacherApp.routeReady && !teacherApp.isApplyingRoute);
        await page.evaluate(async ({ path, css }) => {
            await Promise.all(css.map(href => new Promise((resolve, reject) => {
                if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === new URL(href, location.href).href && link.sheet)) return resolve();
                const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href;
                const timer = setTimeout(() => reject(new Error('Teacher preview CSS deadline')), 10000);
                link.onload = () => { clearTimeout(timer); resolve(); }; link.onerror = () => { clearTimeout(timer); reject(new Error('Teacher preview CSS failed')); }; document.head.append(link);
            })));
            const { previewTeacherSpark } = await import(path);
            previewTeacherSpark({ id: 'library-style-preview', title: 'Library preview', sparkText: 'The teacher preview uses the real styled reader.', checkMode: 'reading_only', targetGrades: ['9'], questions: [] });
        }, { path: manifest ? `/${manifest['js/teacherStudentPreview.js'].file}` : '/js/teacherStudentPreview.js',
            css: manifest ? [...collectStaticDeliveryFiles(manifest, 'js/teacherStudentPreview.js')].filter(path => path.endsWith('.css')).map(path => `/${path}`) : [] });
        const frame = page.frameLocator('.teacher-unit-preview-frame');
        await frame.locator('.student-current-class-spark').waitFor();
        await frame.getByText('The teacher preview uses the real styled reader.', { exact: true }).waitFor();
        assert.equal(await frame.locator('.student-current-class-spark').evaluate(node => getComputedStyle(node).display), 'grid');
        assert.deepEqual(f.errors, []); console.log('Actual teacher shell and isolated Spark iframe await ordered library/reader styles.');
        await context.close();
    }
    for (const failed of [false, true]) {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        await fixture(page);
        if (failed) await page.route(`**${shared[0]}`, route => route.fulfill({ status: 503, contentType: 'text/css', body: 'Controlled demo library CSS failure' }));
        await page.goto(`${baseUrl}/student.html#/menu`); await settled(page);
        await page.waitForFunction(() => studentApp.activities.vocabularyData.classSelection?.ready);
        await page.evaluate(async () => {
            studentApp.authDisabled = true; studentApp.currentUser = null;
            await studentApp.navigateTo({ view: 'sparks' });
        }); await settled(page);
        if (failed) await page.locator('#student-sparks-library .student-library-load-error').waitFor();
        else await page.getByText('No Sparks are available for this class yet.', { exact: true }).waitFor();
        assert.equal(await page.locator('#student-sparks-view').getAttribute('aria-busy'), 'false');
        await page.evaluate(() => studentApp.navigateTo({ view: 'menu' })); await page.locator('#main-menu-view.active').waitFor();
        console.log(`Real demo Spark renderer ${failed ? 'CSS failure' : 'healthy empty result'} has owned recovery and reachable Home.`);
        await context.close();
    }
} finally { await browser?.close(); server?.kill(); }
