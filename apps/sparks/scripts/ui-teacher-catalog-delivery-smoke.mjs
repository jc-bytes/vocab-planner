import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { loadVocabularyCatalog } from './lib/vocabularyCatalog.mjs';
import { installTeacherFeatureFixture } from './lib/teacher-feature-fixture.mjs';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const port = Number(process.env.UI_TEACHER_CATALOG_PORT || 19869), baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_TEACHER_CATALOG_DIST === '1';
const catalog = await loadVocabularyCatalog(process.cwd());
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
    const draft = catalog[0].fileVocabulary;
    const library = await page.evaluate(async draft => {
        teacherApp.saveToLocal(draft);
        const result = await teacherApp.getTeacherLibrary();
        return { remoteIds: result.remoteVocabs.map(vocab => vocab.id),
            items: result.items.map(item => ({ id: item.vocab.id, type: item.type })) };
    }, draft);
    assert.deepEqual(library.remoteIds, [], 'Authenticated school library does not mix the retired public catalogue');
    assert.ok(library.items.some(item => item.id === draft.id && item.type === 'local'), 'Real scoped drafts remain available');
    assert.deepEqual(publicCatalogReads, [], 'Default private reads do not request the public manifest');
    const examples = [catalog.find(record => !record.vocabulary.activitySettings?.retiredWeeklySet),
        catalog.find(record => record.vocabulary.activitySettings?.retiredWeeklySet)].filter(Boolean);
    for (const { entry, fileVocabulary } of examples) {
        await page.evaluate(async entry => {
            // Explicit path authoring remains supported independently of default
            // private catalogue discovery. Load the real published archive file.
            await teacherApp.openTeacherVocabularyItem(entry, 'remote');
        }, entry);
        await page.waitForFunction(id => teacherApp.vocabSet.id === id && document.querySelector('#teacher-editor-view')?.classList.contains('active'), entry.id);
        assert.equal(await page.locator('#vocab-name').inputValue(), fileVocabulary.name);
        assert.deepEqual(await page.evaluate(() => teacherApp.vocabSet.words), fileVocabulary.words);
    }
    assert.deepEqual(failed, []); assert.deepEqual(fixture.errors, []); assert.deepEqual(publicCatalogReads, []);
    console.log(`Private teacher catalogue excludes ${catalog.length} archive entries; explicit authoring opened ${examples.length} current/retired JSON materials with exact words and no missing resources.`);
    await context.close();
} finally { await browser?.close(); server?.kill(); }
