import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const port = Number(process.env.UI_TEACHER_PREVIEW_SECURITY_PORT || 19998), baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_TEACHER_PREVIEW_SECURITY_DIST === '1';
const manifest = built ? JSON.parse(await readFile('dist-desktop/.vite/manifest.json', 'utf8')) : null;
const previewModule = manifest ? `/${manifest['js/teacherStudentPreview.js'].file}` : '/js/teacherStudentPreview.js';
const payload = '<img src="/preview-security-payload-must-not-load.png" onerror="window.__previewInjected=parent.localStorage.getItem(\'preview-proof-sentinel\')">';
const words = [{ word: 'ROBOT', definition: payload }, { word: 'CIRCUIT', definition: 'A complete path.' },
    { word: 'OUTPUT', definition: 'Information produced.' }, { word: 'INPUT', definition: 'Information entered.' }];
let browser, server;
async function openPreview(page, reviewOnly) {
    await page.evaluate(async ({ path, words, reviewOnly }) => {
        const { previewTeacherUnit } = await import(path);
        await previewTeacherUnit({}, { id: 'preview-content-security', name: 'Preview content security', grade: '6', words,
            ...(reviewOnly ? { activitySettings: { weeklyPoolVersion: 1, reviewOnly: true,
                requiredActivities: ['crossword'], additionalActivities: [] } } : {}) }, 'local');
    }, { path: previewModule, words, reviewOnly });
    const frame = page.frameLocator('.teacher-unit-preview-frame');
    await frame.locator('#activity-menu-view [data-activity="flashcards"], #activity-menu-view [data-activity="crossword"]').first().waitFor({ state: 'attached' });
    return frame;
}
try {
    server = await ensureViteServer({ baseUrl, probePath: '/teacher.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    for (const bypassCSP of [true, false]) {
        const context = await browser.newContext({ serviceWorkers: 'block', bypassCSP }), page = await context.newPage();
        const errors = [], forbidden = [], payloadRequests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (request.url().includes('preview-security-payload-must-not-load')) payloadRequests.push(request.url()); });
        const html = (await readFile(built ? 'dist-desktop/teacher.html' : 'teacher.html', 'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
        await page.route('**/teacher.html', route => route.fulfill({ contentType: 'text/html', body: html }));
        await page.route(/https?:\/\/[^/]+\/(?:rest|auth|storage|functions)\/v1\//, route => { forbidden.push(route.request().url()); return route.abort(); });
        await page.goto(`${baseUrl}/teacher.html`);
        // Preview progress starts fresh, so the real first-use tour can appear after the activity paints.
        await page.addLocatorHandler(page.frameLocator('.teacher-unit-preview-frame').getByRole('button', { name: 'Skip guide', exact: true }),
            async control => control.click());
        await page.evaluate(() => {
            document.querySelectorAll('.teacher-main > .view').forEach(view => {
                view.classList.toggle('hidden', view.id !== 'teacher-dashboard-view');
                view.classList.toggle('active', view.id === 'teacher-dashboard-view');
            });
            document.querySelector('.app-container').classList.add('teacher-authenticated');
            localStorage.setItem('preview-proof-sentinel', 'synthetic-local-only');
        });
        const frame = await openPreview(page, true);
        await frame.locator('#activity-menu-view .activity-card[data-activity="crossword"]').click();
        await frame.locator('#cw-active-clue').waitFor();
        await frame.locator('.cw-clue-item').filter({ hasText: 'preview-security-payload-must-not-load' }).click();
        assert.equal(await frame.locator('#cw-active-clue .cw-active-text').textContent(), payload);
        assert.equal(await frame.locator('#cw-active-clue img, #cw-active-clue svg, #cw-active-clue script').count(), 0);
        const child = page.frames().find(frame => frame.url().includes('student-preview.html'));
        assert.equal(await child.evaluate(() => window.__previewInjected), undefined, 'vocabulary cannot execute even when CSP is bypassed');
        assert.deepEqual(payloadRequests, [], 'vocabulary never becomes a resource element');
        await frame.locator('.cw-clue-item').filter({ hasText: 'A complete path.' }).click();
        assert.equal(await frame.locator('#cw-active-clue .cw-active-text').textContent(), 'A complete path.');
        const policy = await frame.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
        assert.match(policy, /script-src 'self'(?:;|$)/);
        assert.match(policy, /object-src 'none'/);
        const storage = await child.evaluate(() => {
            const before = localStorage.getItem('preview-proof-sentinel');
            localStorage.setItem('preview-only-progress', 'child-only');
            sessionStorage.setItem('preview-only-session', 'child-only');
            return { before, parent: parent.localStorage.getItem('preview-only-progress'),
                parentSession: parent.sessionStorage.getItem('preview-only-session') };
        });
        assert.deepEqual(storage, { before: null, parent: null, parentSession: null });
        if (!bypassCSP) {
            await child.evaluate(() => {
                window.__previewCspViolations = [];
                document.addEventListener('securitypolicyviolation', event => {
                    window.__previewCspViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI });
                });
                const image = document.createElement('img');
                image.alt = '';
                image.setAttribute('onerror', 'window.__previewInlineExecuted=true');
                image.src = 'data:image/png;base64,not-an-image';
                document.body.append(image);
            });
            await child.waitForFunction(() => window.__previewCspViolations.some(event => event.directive.startsWith('script-src') && event.blocked === 'inline'));
            assert.equal(await child.evaluate(() => window.__previewInlineExecuted), undefined,
                'the real preview CSP independently blocks an inline event handler');
        }
        await page.locator('.teacher-unit-preview-screen > header').getByRole('button', { name: 'Back to library', exact: true }).click();
        assert.equal(await page.locator('.teacher-unit-preview-frame').count(), 0);
        const flashcards = await openPreview(page, false);
        await flashcards.locator('#activity-menu-view [data-activity="flashcards"]').click();
        await flashcards.locator('#activity-view:not(.hidden) .flashcard').first().waitFor();
        const fresh = page.frames().find(frame => frame.url().includes('student-preview.html'));
        assert.equal(await fresh.evaluate(() => localStorage.getItem('preview-only-progress')), null,
            'closing a preview discards its in-memory progress');
        assert.equal(await page.evaluate(() => localStorage.getItem('preview-proof-sentinel')), 'synthetic-local-only');
        assert.deepEqual(forbidden, [], 'preview never attempts real backend writes or reads');
        assert.deepEqual(errors, []);
        console.log(`${built ? 'built' : 'source'} ${bypassCSP ? 'CSP-bypassed sink' : 'enforced CSP'}: literal hostile clue, normal Crossword/Flashcards, isolated ephemeral progress and zero backend requests passed.`);
        await context.close();
    }
} finally { await browser?.close(); server?.kill(); }
