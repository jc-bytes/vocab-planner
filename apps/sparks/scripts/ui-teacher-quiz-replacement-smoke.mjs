import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { teacherFeatureIds as ids, installTeacherFeatureFixture } from './lib/teacher-feature-fixture.mjs';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const port = Number(process.env.UI_TEACHER_QUIZ_REPLACEMENT_PORT || 19877);
const baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_TEACHER_QUIZ_REPLACEMENT_DIST === '1';
const vocabularies = ['Networks', 'Protocols'].map((name, index) => ({
    id: `quiz-replacement-${index}`, name, subjectSlug: ids.subject, grades: ['6'],
    trimester: 'IT', month: 'march', week: index + 1, activitySettings: {},
    words: Array.from({ length: 6 }, (_, word) => ({ word: `${name} term ${word + 1}`, definition: `${name} definition ${word + 1}` }))
}));
const entries = vocabularies.map((vocabulary, index) => ({ ...vocabulary,
    path: `vocabularies/quiz-replacement-${index}.json`, wordCount: vocabulary.words.length }));
const readRpcs = new Set(['my_school_access_v1', 'get_school_settings_v1', 'list_teaching_classes_v1',
    'list_vocabulary_metadata_school_v1', 'list_school_years_v1', 'class_roster_v1', 'list_student_identity_roster_school_v1',
    'list_student_progress_summaries_school_v1', 'list_student_roster_filters_school_v1',
    'get_student_progress_school_v3', 'teacher_student_insight_v1']);
let server, browser;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/teacher.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const fixture = await installTeacherFeatureFixture(page);
    const errors = [], unexpectedBackend = [], failedResponses = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    // The fixture owns authentication/read responses. Reject writes and any
    // accidental backend outside that synthetic host before network dispatch.
    await page.route(/\/(?:rest|auth|storage|functions)\/v1(?:\/|$)/, async route => {
        const request = route.request(), url = new URL(request.url());
        const rpc = url.pathname.includes('/rpc/');
        const allowedRead = ['GET', 'HEAD', 'OPTIONS'].includes(request.method())
            || request.method() === 'POST' && rpc && readRpcs.has(url.pathname.split('/').at(-1));
        if (url.hostname !== 'teacher-feature-fixture.supabase.co' || !allowedRead) {
            unexpectedBackend.push(`${request.method()} ${url.pathname}`);
            return route.abort('blockedbyclient');
        }
        return route.fallback();
    });
    // The authenticated catalogue is private. Real scoped drafts supply Quiz inputs.

    for (const [index, entry] of entries.entries()) {
        await page.route(`**/${entry.path}*`, route => route.fulfill({ json: vocabularies[index] }));
    }
    const route = `#/teacher/vocabulary?subject=${ids.subject}&grade=6&trimester=IT&month=march&mode=quizzes`;
    await page.goto(`${baseUrl}/teacher.html#/teacher/overview`);
    await page.waitForFunction(() => window.teacherApp?.isAuthenticated && teacherApp.routeReady && !teacherApp.isApplyingRoute);
    await page.evaluate(async ({ vocabularies, route }) => {
        vocabularies.forEach(vocab => teacherApp.saveToLocal(vocab));
        const next = teacherApp.parseRoute(route);
        teacherApp.setRoute(next);
        await teacherApp.applyRoute(next);
    }, { vocabularies, route });
    const picker = page.locator('#quiz-vocab-picker');
    await picker.locator('.teacher-vocab-pick-card').first().waitFor();
    assert.equal(await picker.locator('.teacher-vocab-pick-card').count(), 2);

    const activeDraft = () => page.evaluate(() => {
        const keys = Object.keys(localStorage).filter(key => key.startsWith('teacher_quiz_builder_active_draft:'));
        return { keys, values: keys.map(key => JSON.parse(localStorage.getItem(key))),
            unscoped: localStorage.getItem('teacher_quiz_builder_active_draft'),
            document: JSON.parse(JSON.stringify(teacherApp.vocabSet)), generation: teacherApp.teacherVocabularyDocumentGeneration };
    });
    const waitEditor = name => page.waitForFunction(name =>
        document.querySelector('#quiz-maker-view')?.classList.contains('active')
        && document.querySelector('#quiz-title-input')?.value === name
        && document.querySelectorAll('#quiz-section-list .quiz-section-card').length > 0, name);
    const waitHub = async () => {
        try { await page.waitForFunction(() => document.querySelector('#teacher-dashboard-view')?.classList.contains('active')
            && document.querySelectorAll('#quiz-vocab-picker [aria-label^="Build quiz from"]').length === 2); }
        catch (error) {
            console.error('Quiz return state:', await page.evaluate(() => ({ hash: location.hash,
                active: [...document.querySelectorAll('.view.active')].map(view => view.id),
                picker: document.querySelector('#quiz-vocab-picker')?.innerText,
                keys: Object.keys(localStorage).filter(key => key.startsWith('teacher_vocab_library:')).map(key => ({ key, values: JSON.parse(localStorage.getItem(key)).map(value => ({ id:value.id,name:value.name,grades:value.grades })) })) })));
            throw error;
        }
    };
    const exerciseControls = async title => {
        await page.locator('[data-quiz-tool-tab="details"]').click();
        await page.locator('#quiz-title-input').fill(title);
        await page.locator('[data-quiz-tool-tab="build"]').click();
        await page.locator('#generate-questions-btn').click();
        assert.ok(await page.locator('#quiz-questions-list .doc-q-card').count() > 0, 'Generate populates real preview');
        assert.ok((await page.locator('#quiz-questions-list').innerText()).includes(title), 'Title input updates real preview');
        const draft = await activeDraft();
        assert.equal(draft.keys.length, 1);
        assert.ok(draft.keys[0].includes(ids.teacher), 'Draft belongs to the active teacher');
        assert.equal(draft.unscoped, null);
        assert.equal(draft.values[0].state.meta.title, title);
        assert.equal(draft.values[0].vocabSet.id, draft.document.id);
        return draft;
    };

    await picker.getByRole('button', { name: 'Build quiz from Networks', exact: true }).click();
    await waitEditor('Networks');
    const first = await exerciseControls('Networks reviewed');
    assert.equal(first.document.id, vocabularies[0].id);
    await page.locator('#quiz-maker-back-btn').click();
    await waitHub();

    await page.locator('[data-quiz-vocab-view-mode="rows"]').click();
    assert.equal(await picker.locator('.quiz-vocab-row').count(), 2);
    await picker.getByRole('button', { name: 'Build quiz from Protocols', exact: true }).click();
    await waitEditor('Protocols');
    const second = await exerciseControls('Protocols reviewed');
    assert.equal(second.document.id, vocabularies[1].id);
    assert.equal(second.generation, first.generation + 1);
    assert.deepEqual(second.document.words, vocabularies[1].words);
    assert.equal(await page.locator('#vocab-name').inputValue(), 'Protocols');
    assert.match(await page.locator('#words-container').textContent(), /Protocols term 1/);
    await page.locator('#quiz-maker-close-btn').click();
    await waitHub();

    // Public app entry point retains the existing maker and changes its return
    // destination without relying on compiled export names or private context.
    await page.evaluate(() => teacherApp.openQuizMaker({ returnTo: 'editor' }));
    await waitEditor('Protocols reviewed');
    await page.locator('#quiz-maker-back-btn').click();
    await page.locator('#teacher-editor-view.active').waitFor();
    assert.equal(await page.locator('#vocab-name').inputValue(), 'Protocols');

    await page.evaluate(() => {
        teacherApp.disposeLoadedTeacherFeatures();
        return teacherApp.openQuizMaker({ restoreDraft: true, returnTo: 'editor' });
    });
    await waitEditor('Protocols reviewed');
    const restored = await exerciseControls('Protocols reopened');
    assert.equal(restored.document.id, vocabularies[1].id);
    await page.locator('#quiz-maker-close-btn').click();
    await page.locator('#teacher-editor-view.active').waitFor();
    await page.evaluate(() => teacherApp.disposeLoadedTeacherFeatures());
    assert.deepEqual(unexpectedBackend, [], 'No backend mutation or real backend request');
    assert.deepEqual(failedResponses, []);
    assert.deepEqual(errors, []);
    assert.deepEqual(fixture.errors, []);
    console.log(`${built ? 'Built' : 'Source'} actual teacher Quiz replacement passed: Networks → Protocols; cards/rows; Back/Close; title/generate; owned draft/current document; hub/editor return; disposal/reopen; zero backend writes.`);
    await context.close();
} finally { await browser?.close(); server?.kill(); }
