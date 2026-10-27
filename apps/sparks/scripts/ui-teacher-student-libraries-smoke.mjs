import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const port = Number(process.env.UI_TEACHER_LIBRARIES_PORT || 18245);
const baseUrl = `http://127.0.0.1:${port}`;
let server, browser;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/', host: '127.0.0.1', port });
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], backendRequests = [];
    await page.route(/https?:\/\/[^/]+\/(?:rest|auth|storage|functions)\/v1\//, route => { backendRequests.push(route.request().url()); return route.abort(); });
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-15T17:00:00Z'));
    await page.goto(baseUrl);
    await page.evaluate(async () => {
        document.body.innerHTML = `<main style="padding:24px"><section id="teacher-dashboard-view"><div id="vocabulary-assign-panel"><div id="teacher-vocab-view-toggle" class="vocab-view-toggle"></div><div id="teacher-vocab-breadcrumb"></div><div id="library-list"></div></div></section><section id="teacher-sparks-view"><button id="add-spark-btn">Add Spark</button><div id="spark-library-list"></div></section></main>`;
        for (const file of ['theme','typography','buttons','forms','cards','navigation','teacher','teacher-student-library']) {
            const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = `/css/${file}.css`; document.head.append(link);
        }
        const { createTeacherVocabularyBrowserFeature } = await import('/js/teacherVocabularyBrowserFeature.js');
        const { installTeacherSettingsMethods } = await import('/js/teacherSettings.js');
        const { installTeacherVocabularyMethods } = await import('/js/teacherVocabulary.js');
        const { getDefaultSchoolCalendar } = await import('/js/services/schoolCalendar.js');
        class Manager {
            getSubjects() { return [{ slug: 'technology', name: 'Technology', color: '#adc6ff' }]; }
            ensureAuthenticated() { return true; }
            updateVocabularyRoute() {}
            refreshIcons() {}
            openTeacherVocabularyItem(vocab, type) { window.edited = { id: vocab.id, type }; }
            openAssignmentPublisher(value) { window.published = value; }
        }
        installTeacherVocabularyMethods(Manager);
        installTeacherSettingsMethods(Manager);
        const owner = window.libraryOwner = new Manager();
        owner.openTeacherVocabularyItem = (vocab, type) => { window.edited = { id: vocab.id, type }; };
        owner.subjects = [{ slug: 'technology', name: 'Technology', color: '#adc6ff' }];
        owner.currentUser = { id: 'teacher-fixture' }; owner.teacherVocabularySessionGeneration = 0;
        owner.schoolCalendar = getDefaultSchoolCalendar(new Date('2026-10-15'));
        owner.libraryDrilldown = { subject: 'technology', grade: '6', trimester: 'IIIT', month: 'october' };
        const make = (id, month, week) => ({ id, name: `Grade 6 IIIT ${month} Week ${week} - Safe choices`, grade: '6', subjectSlug: 'technology', purpose: 'practice', trimester: 'IIIT', month: month.toLowerCase(), week, description: 'Learn to make safe choices.', words: [{ word: 'privacy', definition: 'Control over personal information.', example: 'Keep your address private.' }], activitySettings: { requiredActivities: ['flashcards','matching'], additionalActivities: [] } });
        owner.libraryItems = [{ type: 'local', vocab: make('unit-oct', 'October', 5) }, { type: 'local', vocab: make('unit-sep', 'September', 2) }];
        window.libraryBrowser = createTeacherVocabularyBrowserFeature({
            getSubjects: () => owner.getSubjects(), describeVocabulary: (vocab, type) => owner.describeTeacherVocabulary(vocab, type),
            describeVocabularyGrouping: vocab => owner.describeTeacherVocabularyGrouping(vocab),
            ensureAuthenticated: () => true, captureScope: options => owner.createTeacherVocabularyOperationGuard(options), isActive: () => true,
            getDrilldown: () => owner.libraryDrilldown, writeDrilldown: value => { owner.libraryDrilldown = value; },
            loadCatalog: async () => ({ items: owner.libraryItems }), refreshIcons() {},
            captureNavigation: () => null, isNavigationCurrent: () => true,
            openItem: (vocab, type) => owner.openTeacherVocabularyItem(vocab, type), assignItem: value => owner.openAssignmentPublisher(value)
        });
        await window.libraryBrowser.show();
        const { createTeacherSparksFeature } = await import('/js/teacherSparks.js');
        const { createServerStateQuery } = await import('/js/services/serverStateQuery.js');
        const rows = [
            { id: 'p1', title: 'G6 T3 W5 - Explain the risk - Words in use', sparkText: 'Read the message before you share it.', whyItMatters: 'Your information belongs to you.', question: 'What is the risk?', gradeQuestions: { 6: 'What should you keep private?', 7: 'Why would you check the source?' }, targetGrades: ['6','7'], scheduledDate: '2026-10-05', status: 'scheduled', checkMode: 'optional' },
            { id: 'p2', title: 'G6 T3 W5 - Explain the risk - Words in use 2', sparkText: 'This is the second reading.', question: 'What would you do?', targetGrades: ['6'], scheduledDate: '2026-10-05', status: 'draft', checkMode: 'optional', questions: [{ id: 'q1', type: 'multiple_choice', prompt: 'Which is private?', options: ['Password','Color'], correctOption: 0 }] },
            { id: 'sep', title: 'September reading', sparkText: 'Earlier material.', scheduledDate: '2026-09-14', status: 'scheduled', checkMode: 'reading_only' },
            { id: 'old', targetGrades: ['8'], title: 'Archived reading', sparkText: 'Archived.', scheduledDate: '2026-10-06', status: 'archived', checkMode: 'reading_only' }
        ];
        const { toClientTimestamp } = await import('/js/services/supabaseValues.js');
        rows.forEach(row => { row.createdAt = toClientTimestamp('2026-10-18T12:00:00Z'); });
        window.writes = 0;
        window.sparkFeature = createTeacherSparksFeature({ ensureAuthenticated: () => true, showView() {}, showEditorView() {}, getCurrentUser: () => owner.currentUser, isAuthenticationDisabled: () => false, getSchoolCalendar: () => owner.schoolCalendar, refreshIcons() {}, feedback: { error: message => { throw new Error(message); }, warning() {}, success() {} }, queryService: createServerStateQuery(), repository: { list: async () => rows, save: async () => { window.writes++; } } });
        await window.sparkFeature.show();
    });
    await page.locator('#library-list .student-vocab-card').waitFor();
    assert.equal(await page.locator('#library-list .student-vocab-card h3').innerText(), 'Safe choices');
    await page.locator('#library-list .floating-action-menu-trigger').click();
    await page.locator('#library-list .edit-vocab-btn').click();
    assert.equal(await page.evaluate(() => window.edited.id), 'unit-oct');
    await page.locator('#library-list .student-vocab-card').click();
    const unitScreen = page.frameLocator('.teacher-unit-preview-frame');
 await page.addLocatorHandler(unitScreen.getByRole('button', { name: 'Skip guide', exact: true }), async locator => locator.click());
    await unitScreen.locator('#activity-menu-view:not(.hidden)').waitFor();
    await unitScreen.locator('[data-activity=flashcards]').click();
    await unitScreen.locator('.flashcard-wrapper').waitFor();
    await page.screenshot({ path: '/tmp/teacher-unit-preview.png', fullPage: true });
    await page.getByRole('button', { name: 'Back to library' }).click();
    await page.locator('#teacher-vocab-view-toggle [aria-label="Show rows"]').click();
    await page.locator('#library-list .teacher-material-row .floating-action-menu-trigger').waitFor();
    await page.locator('#library-list .floating-action-menu-trigger').click();
    await page.locator('#library-list .preview-vocab-btn').click();
    await unitScreen.locator('#activity-menu-view:not(.hidden)').waitFor();
    await page.getByRole('button', { name: 'Back to library' }).click();
    await page.locator('#library-list').getByRole('button', { name: 'Back to Months' }).click();
    await page.locator('#library-list :is(.teacher-library-choice-card, button.student-vocab-row)').filter({ hasText: 'September' }).click();
    await page.waitForFunction(() => window.libraryOwner.libraryDrilldown.month === 'september');
    await page.locator('#library-list').getByRole('button', { name: 'Back to Months' }).click();
    await page.locator('#library-list :is(.teacher-library-choice-card, button.student-vocab-row)').filter({ hasText: 'October' }).click();

    await page.locator('#spark-library-list .student-spark-card').first().waitFor();
    assert.deepEqual((await page.locator('#spark-library-list .student-spark-card h3').allTextContents()).sort(), ['Archived reading', 'Explain the risk · Part 1', 'Explain the risk · Part 2']);
    await page.locator('.teacher-material-item').filter({ has: page.locator('[data-spark-id="p1"]') }).locator('.floating-action-menu-trigger').click();
    await page.locator('[data-spark-action="preview"][data-spark-id="p1"]').click();
    await unitScreen.locator('#student-sparks-view:not(.hidden)').waitFor();
    await unitScreen.getByText('What should you keep private?', { exact: true }).waitFor();
    await page.getByLabel('Preview grade').selectOption('7');
    await unitScreen.getByText('Why would you check the source?', { exact: true }).waitFor();
    await unitScreen.locator('textarea').fill('I would check who wrote the message.');
    await unitScreen.getByRole('button', { name: 'Save answer', exact: true }).click();
    await unitScreen.getByText('Answer saved. Your teacher will review it.', { exact: true }).waitFor();
    // The actual student breadcrumb can return to the list and reopen the saved preview response.
    await unitScreen.getByRole('button', { name: 'Sparks', exact: true }).click();
    await unitScreen.locator('.student-spark-library-choice').click();
    await unitScreen.locator('.student-spark-library-choice').click();
    await unitScreen.locator('.student-spark-card').click();
    assert.equal(await unitScreen.locator('textarea').inputValue(), 'I would check who wrote the message.');
    assert.equal(await page.evaluate(() => window.writes), 0);
    await page.getByRole('button', { name: 'Back to library' }).click();
    await page.locator('#spark-library-list').getByRole('button', { name: 'Show rows' }).click();
    assert.equal(await page.locator('#spark-library-list .teacher-material-row').count(), 3);
    await page.locator('.teacher-material-item').filter({ has: page.locator('[data-spark-id="p2"]') }).locator('.floating-action-menu-trigger').click();
    await page.locator('[data-spark-action="preview"][data-spark-id="p2"]').click();
    await unitScreen.locator('label').filter({ hasText: 'Which is private?' }).waitFor();
    await unitScreen.locator('.student-class-spark-questions select').selectOption('1');
    await unitScreen.getByRole('button', { name: 'Check answers', exact: true }).click();
    await unitScreen.getByText('0 of 1 multiple-choice answers correct.', { exact: true }).waitFor();
    await unitScreen.locator('.student-class-spark-questions select').selectOption('0');
    await unitScreen.getByRole('button', { name: 'Check answers', exact: true }).click();
    await unitScreen.getByText('1 of 1 multiple-choice answers correct.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Back to library' }).click();
    await page.locator('#spark-library-list').getByRole('button', { name: 'Show cards' }).click();
    for (const width of [1440,768,390,320]) {
        await page.setViewportSize({ width, height: 1000 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false, `Library overflow at ${width}px`);
        await page.locator('.teacher-material-item').filter({ has: page.locator('[data-spark-id="p1"]') }).locator('.floating-action-menu-trigger').click();
    await page.locator('[data-spark-action="preview"][data-spark-id="p1"]').click();
        await unitScreen.locator('#student-sparks-view:not(.hidden)').waitFor();
        assert.equal(await unitScreen.locator('body').evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Preview overflow at ${width}px`);
        await page.screenshot({ path: `/tmp/teacher-library-preview-${width}.png`, fullPage: true });
        await page.getByRole('button', { name: 'Back to library' }).click();
    }
    await page.locator('#library-list .floating-action-menu-trigger').click();
    await page.locator('#library-list .preview-vocab-btn').click();
    await unitScreen.locator('#activity-menu-view:not(.hidden)').waitFor();
    await page.evaluate(() => { window.libraryOwner.teacherVocabularySessionGeneration++; });
    await page.locator('.teacher-unit-preview-screen').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => window.writes), 0);
    await page.screenshot({ path: '/tmp/teacher-library-final.png', fullPage: true });
    assert.deepEqual(errors, []);
    assert.deepEqual(backendRequests, []);
    console.log('Teacher/student library parity passed: cards, rows, month navigation, actions, previews, grade questions, zero writes, stale-session cleanup, and responsive containment.');
} finally { await browser?.close(); server?.kill(); }
