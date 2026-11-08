import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { weeklyFixture } from '../tests/fixtures/weekly-vocabulary-fixture.mjs';
import { installTeacherFeatureFixture } from './lib/teacher-feature-fixture.mjs';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const port = Number(process.env.UI_TEACHER_CATALOG_PORT || 19869), baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_TEACHER_CATALOG_DIST === '1';
const draftFixture = weeklyFixture();
let browser, server;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/teacher.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
    const fixture = await installTeacherFeatureFixture(page), failed = [], publicCatalogReads = [];
    page.on('request', request => { if (new URL(request.url()).pathname.endsWith('/vocabularies/manifest.json')) publicCatalogReads.push(request.url()); });
    page.on('response', response => { if (response.status() >= 400) failed.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    await page.goto(`${baseUrl}/teacher.html#/teacher/vocabulary`);
    await page.waitForFunction(() => window.teacherApp?.isAuthenticated && teacherApp.routeReady && !teacherApp.isApplyingRoute);
    const draft = draftFixture;
    const library = await page.evaluate(async draft => {
        teacherApp.saveToLocal(draft);
        const result = await teacherApp.getTeacherLibrary();
        return { remoteIds: result.remoteVocabs.map(vocab => vocab.id),
            items: result.items.map(item => ({ id: item.vocab.id, type: item.type })) };
    }, draft);
    assert.deepEqual(library.remoteIds, [], 'Authenticated school library does not mix the retired public catalogue');
    assert.ok(library.items.some(item => item.id === draft.id && item.type === 'local'), 'Real scoped drafts remain available');
    assert.deepEqual(publicCatalogReads, [], 'Default private reads do not request the public manifest');
    await page.evaluate(async draft => teacherApp.openTeacherVocabularyItem(draft, 'local'), draft);
    await page.waitForFunction(id => teacherApp.vocabSet.id === id && document.querySelector('#teacher-editor-view')?.classList.contains('active'), draft.id);
    assert.equal(await page.locator('#vocab-name').inputValue(), draft.name);
    assert.deepEqual(await page.evaluate(() => teacherApp.vocabSet.words), draft.words);
    assert.deepEqual(failed, []); assert.deepEqual(fixture.errors, []); assert.deepEqual(publicCatalogReads, []);
    console.log('Private teacher library and saved drafts work without requesting a file catalog.');
    await context.close();
} finally { await browser?.close(); server?.kill(); }
