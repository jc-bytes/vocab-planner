import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installStudentAssignedFlowFixture } from './lib/student-assigned-flow-fixture.mjs';
import { installTeacherFeatureFixture } from './lib/teacher-feature-fixture.mjs';
import { capturePresentationReference, servePresentationReference, verifyPresentationReference } from './lib/presentation-reference.mjs';
import { collectStaticDeliveryFiles } from './lib/deliverySizeBudgets.mjs';

const [mode, argument, ...options] = process.argv.slice(2);
assert.ok(['capture', 'capture-source', 'verify-reference', 'compare'].includes(mode) && argument, 'Usage: node scripts/ui-student-presentation-parity-smoke.mjs capture|capture-source|verify-reference|compare /tmp/reference [--source]');
const reference = resolve(argument), source = options.includes('--source') || mode === 'capture-source';
const historicalOption = options.indexOf('--historical-artifact');
assert.ok(historicalOption < 0 || mode === 'capture' && options[historicalOption + 1], '--historical-artifact is only valid for historical capture.');
const widths = [320, 390, 430, 760, 761, 768, 1280];
const cases = {
    home: ['#main-menu-view', '.student-continue-hero', '.student-continue-copy', '.student-home-unit', '.student-home-panel'],
    'home-blocked': ['#main-menu-view', '.student-continue-hero', '.student-home-unit', '.student-arcade-gate-notice', '.student-arcade-gate-copy'],
    units: ['#vocab-selection-view', '#vocab-list', '.student-vocab-card', '.student-vocab-copy', '.student-vocab-required-progress'],
    'units-rows': ['#vocab-selection-view', '#vocab-list', '.student-vocab-row', '.student-vocab-row-month', '.student-vocab-row-progress'],
    sparks: ['#student-sparks-view', '#student-sparks-library', '.student-spark-card', '.student-vocab-copy', '.student-vocab-required-progress'],
    'sparks-rows': ['#student-sparks-view', '#student-sparks-library', '.student-spark-row', '.student-vocab-row-header'],
    menu: ['#activity-menu-view', '.activity-menu-title-block', '#current-unit-title', '.activity-card', '.activity-flow-section', '.activity-secondary-grid .activity-card', '#student-vocab-export-menu'],
    arcade: ['#arcade-view', '#current-game-card', '#current-game-card h3', '#current-game-card p', '.game-cost', '#play-current-game-btn'],
    activity: ['#activity-view', '#activity-container', '.flashcard-stage', '.flashcard', '.flashcard-mastery-check'],
    'preview-menu': ['#activity-menu-view', '#current-unit-title', '.activity-card', '#student-vocab-export-menu'],
    'preview-activity': ['#activity-view', '#activity-container', '.flashcard-stage', '.flashcard']
};
const properties = ['display', 'position', 'boxSizing', 'gridTemplateColumns', 'gridTemplateRows', 'gap', 'padding', 'margin',
    'borderWidth', 'borderColor', 'borderStyle', 'borderRadius', 'backgroundColor', 'backgroundImage', 'color', 'fontFamily',
    'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'whiteSpace', 'overflowX', 'overflowY',
    'alignItems', 'justifyContent', 'boxShadow', 'opacity', 'transform'];
let browser, currentServer, historical;

async function installFixture(page, name) {
    const fixture = await installStudentAssignedFlowFixture(page, { completeRequiredActivities: name !== 'home-blocked' });
    await page.addInitScript(rows => {
        localStorage.setItem('student_vocabulary_view_mode', rows ? 'rows' : 'cards');
        localStorage.setItem('student_sparks_view_mode', rows ? 'rows' : 'cards');
    }, name.endsWith('-rows'));
    fixture.detail.vocabularyPlacement = { ...fixture.detail.vocabularyPlacement, assignedDate: '2026-10-22', week: 4 };
    await page.clock.setFixedTime(new Date('2026-10-25T15:00:00Z'));
    await page.addInitScript(() => { let state = 831; Math.random = () => (state = state * 16807 % 2147483647) / 2147483647; });
    const spark = { id: '77777777-7777-4777-8777-777777777778', class_id: fixture.ids.class, kind: 'spark',
        title: 'G9 T3 W05 - A reliable source', release_at: '2026-10-01T12:00:00Z', close_at: '2026-10-02T12:00:00Z' };
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-expose-headers': 'content-range' };
    await page.route(url => url.hostname === 'fixture.supabase.co' && url.pathname === '/rest/v1/class_assignments', route => {
        const data = Number(new URL(route.request().url()).searchParams.get('offset')) > 0 ? [] : [spark,
            { id: fixture.ids.assignment, class_id: fixture.ids.class, kind: 'vocabulary', title: fixture.detail.title, release_at: '2026-10-22T12:00:00Z' }];
        return route.fulfill({ status: 200, headers: { ...headers, 'content-range': `0-${Math.max(0, data.length - 1)}/${data.length}` }, json: data });
    });
    await page.route(url => url.hostname === 'fixture.supabase.co' && url.pathname === '/rest/v1/rpc/read_class_assignment_v1', route => {
        const data = route.request().postDataJSON()?.p_assignment_id === spark.id ? { ...spark,
            content: { sparkText: 'Evidence helps us verify whether a claim is reliable.', whyItMatters: 'Check the source before sharing.',
                question: 'Why should a reader check the source?', checkMode: 'reading_only' } } : fixture.detail;
        return route.fulfill({ status: 200, headers, json: data });
    });
    return fixture;
}
async function settle(page, frame = page) {
    await page.waitForLoadState('networkidle');
    await frame.waitForFunction(() => [...document.querySelectorAll('link[rel="stylesheet"]')].every(link => link.disabled || link.sheet), null, { timeout: 10000 });
    await frame.evaluate(async () => {
        await document.fonts.ready;
        const finite = document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime));
        let timer;
        try { await Promise.race([Promise.all(finite.map(animation => animation.finished.catch(() => {}))),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Presentation transitions did not settle within two seconds.')), 2000); })]); }
        finally { clearTimeout(timer); }
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
}
async function snapshot(frame, selectors) {
    return frame.evaluate(({ selectors, properties }) => {
        const round = value => Math.round(value * 4) / 4;
        const rect = box => ({ x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) });
        const elements = {};
        for (const selector of selectors) {
            elements[selector] = [...document.querySelectorAll(selector)].slice(0, 3).map(node => {
                const style = getComputedStyle(node), bounds = node.getBoundingClientRect(), range = document.createRange();
                range.selectNodeContents(node);
                return { text: node.textContent.replace(/\s+/g, ' ').trim(), box: rect(bounds),
                    styles: Object.fromEntries(properties.map(name => [name, style[name]])),
                    textBounds: [...range.getClientRects()].filter(box => box.width && box.height).map(box => rect(box)),
                    horizontalBoxOutsideViewport: bounds.left < -0.75 || bounds.right > innerWidth + 0.75,
                    horizontalTextOutsideViewport: [...range.getClientRects()].some(box => box.width && (box.left < -0.75 || box.right > innerWidth + 0.75)),
                    centerHit: bounds.width && bounds.height && bounds.x + bounds.width / 2 >= 0 && bounds.x + bounds.width / 2 < innerWidth
                        && bounds.y + bounds.height / 2 >= 0 && bounds.y + bounds.height / 2 < innerHeight
                        ? node.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)) : null };
            });
        }
        return { viewport: { width: innerWidth, height: innerHeight }, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1, elements };
    }, { selectors, properties });
}
async function sample(page, frame, name, scheme, result, screenshots) {
    for (const width of widths) {
        await page.setViewportSize({ width, height: width >= 1000 ? 900 : 480 });
        await page.mouse.move(0, 0); await settle(page, frame);
        await frame.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('.view.active').forEach(node => { node.scrollTop = 0; }); });
        const key = `${scheme}/${name}/${width}`;
        const state = await snapshot(frame, cases[name]);
        assert.ok(state.elements[cases[name][0]].length && state.elements[cases[name][0]][0].box.width > 0, `${key}: actual view must exist`);
        if (state.horizontalOverflow) console.warn(`${key}: observed horizontal overflow; recorded explicitly for future comparison.`);
        result.samples[key] = state;
        const imageTarget = name.startsWith('preview-') ? page.locator('.teacher-unit-preview-frame') : page;
        await imageTarget.screenshot({ path: join(screenshots, `${scheme}-${name}-${width}.png`) });
        if (name === 'menu' || name === 'preview-menu') {
            const trigger = frame.locator('#student-vocab-export-menu > button, #student-vocab-export-menu > summary');
            await trigger.click();
            await frame.locator('#student-vocab-export-menu [role="menu"]').waitFor({ state: 'visible' });
            await settle(page, frame);
            result.samples[`${key}/export-open`] = await snapshot(frame, ['#student-vocab-export-menu', '#student-vocab-export-menu [role="menu"]', '#download-word-hunt-btn', '#generate-final-report-btn', '[data-activity-pdf-export]']);
            await imageTarget.screenshot({ path: join(screenshots, `${scheme}-${name}-${width}-export.png`) });
            if (await trigger.evaluate(node => node.tagName === 'SUMMARY')) await trigger.click();
            else await trigger.press('Escape');
        }
    }
}
async function collect(baseUrl, artifactRoot, target, label) {
    const screenshots = join(target, label, 'screenshots'); await mkdir(screenshots, { recursive: true });
    const manifest = artifactRoot ? JSON.parse(await readFile(join(artifactRoot, '.vite/manifest.json'), 'utf8')) : null;
    const result = { label, browser: browser.version(), widths, properties, samples: {}, cold: {} };
    for (const scheme of ['dark', 'light']) for (const name of Object.keys(cases)) {
        if (name === 'preview-activity') continue;
        const context = await browser.newContext({ serviceWorkers: 'block', colorScheme: scheme, reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
        const page = await context.newPage(), requests = new Set(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { const url = new URL(request.url()); if (url.origin === baseUrl && ['script', 'stylesheet'].includes(request.resourceType())) requests.add(url.pathname); });
        let frame = page;
        if (name === 'preview-menu') {
            await installTeacherFeatureFixture(page);
            await page.goto(`${baseUrl}/teacher.html#/teacher/vocabulary`);
            await page.waitForFunction(() => window.teacherApp?.isAuthenticated && teacherApp.routeReady && !teacherApp.isApplyingRoute);
            await page.evaluate(async ({ path, css }) => {
                // A native import of a built entry does not run Vite's generated
                // preload wrapper. Reproduce that edge's complete CSS dependency set.
                await Promise.all(css.map(href => new Promise((resolve, reject) => {
                    const absolute = new URL(href, location.href).href;
                    const existing = [...document.querySelectorAll('link[rel="stylesheet"]')].find(link => link.href === absolute);
                    if (existing?.sheet) { resolve(); return; }
                    const link = existing || document.createElement('link');
                    const timer = setTimeout(() => reject(new Error('Teacher preview entry CSS did not load.')), 10000);
                    link.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
                    link.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Teacher preview entry CSS failed.')); }, { once: true });
                    if (!existing) { link.rel = 'stylesheet'; link.href = absolute; document.head.append(link); }
                })));
                const { previewTeacherUnit } = await import(path);
                await previewTeacherUnit(await teacherApp.getTeacherLibrary(), { id: 'parity-preview', name: 'Preview vocabulary', grade: '6', words: [{ word: 'Source', definition: 'Where information begins.' }] }, 'local');
            }, { path: manifest ? `/${manifest['js/teacherStudentPreview.js'].file}` : '/js/teacherStudentPreview.js',
                css: manifest ? [...collectStaticDeliveryFiles(manifest, 'js/teacherStudentPreview.js')].filter(path => path.endsWith('.css')).map(path => `/${path}`) : [] });
            const iframe = await page.locator('.teacher-unit-preview-frame').elementHandle(); frame = await iframe.contentFrame();
            await frame.locator('#activity-menu-view:not(.hidden) .activity-card').first().waitFor();
        } else {
            const fixture = await installFixture(page, name), unit = `assignment.${fixture.ids.assignment}`;
            const hash = { home: '#/menu', units: '#/units?trimester=IIIT&month=october', sparks: '#/sparks?trimester=IIIT&month=october',
                menu: `#/unit/${unit}`, arcade: '#/arcade', activity: `#/unit/${unit}/activity/flashcards` }[name];
            await page.goto(`${baseUrl}/student.html${hash || (name === 'home-blocked' ? '#/menu' : name === 'units-rows' ? '#/units?trimester=IIIT&month=october' : '#/sparks?trimester=IIIT&month=october')}`);
            await page.waitForFunction(() => window.studentApp?.authInitialized && !studentApp.routing.isApplyingRoute);
            await page.locator(cases[name][0] + '.active').waitFor();
            if (name.startsWith('home')) {
                const tab = page.locator('#student-home-tab-week');
                await tab.waitFor({ state: 'attached' }); await settle(page);
                if (await tab.isVisible()) await tab.click();
                await page.locator('.student-home-unit').first().waitFor();
            }
            if (name === 'units') await page.locator('#vocab-list .student-vocab-card').first().waitFor();
            if (name === 'units-rows') await page.locator('#vocab-list .student-vocab-row:not(.student-vocab-row-header)').first().waitFor();
            if (name === 'sparks') await page.locator('.student-spark-card').first().waitFor();
            if (name === 'sparks-rows') await page.locator('.student-spark-row:not(.student-vocab-row-header)').first().waitFor();
            if (name === 'activity') await page.locator('.flashcard').first().waitFor();
            if (name === 'arcade') await page.locator('#play-current-game-btn').waitFor();
        }
        if (name === 'menu' || name === 'preview-menu') await frame.evaluate(() => {
            document.querySelectorAll('#activity-menu-view .activity-secondary-disclosure').forEach(details => { details.open = true; });
        });
        await settle(page, frame);
        const files = [...requests].sort();
        const emitted = files.filter(path => /^\/assets\/[^/]+\.(?:js|css)$/.test(path));
        result.cold[`${scheme}/${name}`] = { requests: files.length, files,
            ...(artifactRoot ? { emittedGzipBytes: (await Promise.all(emitted.map(async path => gzipSync(await readFile(join(artifactRoot, path)), { level: 9 }).length))).reduce((sum, value) => sum + value, 0) } : {}) };
        await sample(page, frame, name, scheme, result, screenshots);
        if (name === 'preview-menu') {
            await frame.locator('[data-activity="flashcards"]').click(); await frame.locator('.flashcard').first().waitFor();
            await sample(page, frame, 'preview-activity', scheme, result, screenshots);
        }
        assert.deepEqual(errors, [], `${scheme}/${name}: no unhandled browser failures`);
        await context.close(); console.log(`${label}: ${scheme}/${name} all ${widths.length} widths captured`);
    }
    await writeFile(join(target, `${label}.json`), `${JSON.stringify(result, null, 2)}\n`);
    return result;
}
function compare(expected, actual) {
    const differences = [];
    function visit(a, b, path) {
        if (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 0.75) return;
        if (typeof a !== 'object' || a === null || b === null || typeof b !== 'object') { if (a !== b) differences.push({ path, before: a, after: b }); return; }
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) visit(a[key], b[key], `${path}/${key}`);
    }
    visit(expected.samples, actual.samples, 'samples');
    return differences;
}
try {
    if (mode === 'capture') await capturePresentationReference(resolve(historicalOption >= 0 ? options[historicalOption + 1] : 'dist-desktop'), reference);
    if (mode === 'capture-source') {
        try { await access(join(reference, 'source-baseline.json')); throw new Error('Source baseline already exists; use compare --source.'); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const identity = await verifyPresentationReference(reference);
    browser = await chromium.launch();
    if (mode === 'capture' || mode === 'verify-reference') {
        historical = await servePresentationReference(reference);
        const actual = await collect(historical.url, join(reference, 'artifact'), reference,
            mode === 'capture' ? 'historical-built' : 'historical-confirmation');
        if (mode === 'verify-reference') {
            const expected = JSON.parse(await readFile(join(reference, 'historical-built.json'), 'utf8'));
            const differences = compare(expected, actual);
            await writeFile(join(reference, 'historical-confirmation-differences.json'), `${JSON.stringify(differences, null, 2)}\n`);
            assert.equal(differences.length, 0, `${differences.length} historical repeatability differences.`);
        }
        console.log(`Historical output identity: ${identity.outputIdentity}. This is not current-source freshness.`);
    } else {
        const port = Number(process.env.UI_PRESENTATION_PARITY_PORT || 19874), baseUrl = `http://127.0.0.1:${port}`;
        currentServer = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
            ...(source ? {} : { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] }) });
        const sourceMode = source || mode === 'capture-source';
        const expected = JSON.parse(await readFile(join(reference, sourceMode && mode !== 'capture-source' ? 'source-baseline.json' : 'historical-built.json'), 'utf8'));
        const actual = await collect(baseUrl, sourceMode ? null : resolve('dist-desktop'), reference,
            mode === 'capture-source' ? 'source-baseline' : sourceMode ? 'current-source' : 'current-built');
        const differences = compare(expected, actual);
        const coldDifferences = Object.keys(expected.cold).map(key => ({ case: key,
            beforeRequests: expected.cold[key].requests, afterRequests: actual.cold[key]?.requests,
            requestDelta: actual.cold[key]?.requests - expected.cold[key].requests,
            ...(expected.cold[key].emittedGzipBytes !== undefined && actual.cold[key]?.emittedGzipBytes !== undefined
                ? { beforeGzipBytes: expected.cold[key].emittedGzipBytes, afterGzipBytes: actual.cold[key].emittedGzipBytes,
                    gzipDelta: actual.cold[key].emittedGzipBytes - expected.cold[key].emittedGzipBytes } : {}) }));
        await writeFile(join(reference, `${mode === 'capture-source' ? 'source-vs-historical' : sourceMode ? 'source' : 'built'}-differences.json`), `${JSON.stringify(differences, null, 2)}\n`);
        await writeFile(join(reference, `${sourceMode ? 'source' : 'built'}-cold-differences.json`), `${JSON.stringify(coldDifferences, null, 2)}\n`);
        if (mode === 'capture-source') console.log(`Recorded ${differences.length} existing source-versus-built differences; future source compares use this separate source baseline.`);
        else assert.equal(differences.length, 0, `${differences.length} presentation differences; inspect the reference report and screenshots.`);
    }
    await verifyPresentationReference(reference);
} finally { await browser?.close(); currentServer?.kill(); await historical?.close(); }
