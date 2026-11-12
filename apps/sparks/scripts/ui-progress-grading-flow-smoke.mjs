import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installTeacherFeatureFixture, teacherFeatureIds as teacherIds } from './lib/teacher-feature-fixture.mjs';
import { installStudentAssignedFlowFixture, studentFlowIds } from './lib/student-assigned-flow-fixture.mjs';

// Only HTTP responses are fixtures. Both roles use the real HTML, auth, routing,
// repositories, lazy modules and styles in source and final-production modes.
const port = Number(process.env.UI_PROGRESS_GRADING_PORT || 19928), baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_PROGRESS_GRADING_DIST === '1';
const manifest = built ? JSON.parse(await readFile(new URL('../dist-desktop/.vite/manifest.json', import.meta.url), 'utf8')) : null;
const modulePath = source => manifest ? `/${manifest[source].file}` : `/${source}`;
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const assignmentId = studentFlowIds.assignment;
const title = 'Grading flow vocabulary';
const calendar = { schoolYear: 2026, trimesters: { IT: { startDate: '2026-01-01', endDate: '2026-03-31' }, IIT: { startDate: '2026-04-01', endDate: '2026-06-30' }, IIIT: { startDate: '2026-09-01', endDate: '2026-12-31' } } };
let config = { enabled: true, maxPoints: 100, bonusPerActivity: 5, bonusCap: null, capAtMaxPoints: false };
let revision = 0, published = null, failProgress = true, failGrades = false, failStudent = false;
const writes = [], requests = [], forbidden = [];
async function isolateBackend(context, origin) {
    await context.route(url => /\/(?:rest|auth|storage|functions)\/v1\//.test(url.pathname) && url.origin !== origin, route => {
        forbidden.push(new URL(route.request().url()).hostname); return route.abort();
    });
}
function liveGrade() {
    return { assignmentId, enabled: config.enabled, status: config.enabled ? 'provisional' : 'ungraded',
        grading: structuredClone(config), requiredCount: 2, requiredCompleted: 1, additionalCount: 1, additionalCompleted: 1,
        basePoints: config.maxPoints / 2, bonusPoints: config.bonusPerActivity,
        earnedPoints: config.maxPoints / 2 + config.bonusPerActivity, maxPoints: config.maxPoints,
        percent: (config.maxPoints / 2 + config.bonusPerActivity) / config.maxPoints * 100,
        activities: [{ activityType: 'flashcards', required: true, complete: true, points: config.maxPoints / 2 },
            { activityType: 'matching', required: true, complete: false, points: 0 },
            { activityType: 'quiz', required: false, complete: true, points: config.bonusPerActivity }] };
}
const reply = (route, json, status = 200) => route.fulfill({ status, headers, json });
const settledTeacher = page => page.waitForFunction(() => window.teacherApp?.isAuthenticated && teacherApp.routeReady && !teacherApp.isApplyingRoute);
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
let server, browser;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/teacher.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    const teacherContext = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
    await isolateBackend(teacherContext, 'https://teacher-feature-fixture.supabase.co');
    const teacher = await teacherContext.newPage();
    const teacherFixture = await installTeacherFeatureFixture(teacher);
    teacher.on('request', request => requests.push(new URL(request.url()).pathname));
    const teacherBackend = 'https://teacher-feature-fixture.supabase.co/rest/v1/rpc/';
    await teacher.route(`${teacherBackend}get_school_settings_v1`, route => reply(route, { schoolCalendar: calendar }));
    await teacher.route(`${teacherBackend}teacher_class_progress_v1`, route => {
        const args = route.request().postDataJSON();
        assert.equal(args.p_school_id, teacherIds.school); assert.equal(args.p_class_id, teacherIds.class);
        assert.ok([['2026-09-01','2026-12-31'], ['2026-10-01','2026-10-31']]
            .some(([from, to]) => args.p_from === from && args.p_to === to));
        return failProgress ? reply(route, { message: 'Controlled progress read failure' }, 503)
            : reply(route, [{ studentId: teacherIds.student, required: 2, completed: 1, review: 0, unknown: 0 }]);
    });
    await teacher.route(`${teacherBackend}teacher_class_progress_v2`, route => {
        assert.deepEqual(route.request().postDataJSON(), {
            p_school_id: teacherIds.school, p_class_id: teacherIds.class,
            p_from: '2026-10-01', p_to: '2026-10-31', p_activity_type: 'flashcards'
        });
        return reply(route, [{ studentId: teacherIds.student, required: 1, completed: 1, review: 0, unknown: 0 }]);
    });
    await teacher.route(`${teacherBackend}teacher_class_gradebook_v1`, route => failGrades
        ? reply(route, { message: 'Controlled gradebook read failure' }, 503)
        : reply(route, { assignments: [{ id: assignmentId, title, releaseAt: '2026-10-01T12:00:00Z', grading: structuredClone(config), revision, publishedAt: published?.publishedAt || null }],
            students: [{ studentId: teacherIds.student, name: 'Fixture Student', email: 'student@fixture.invalid', grades: [{ ...liveGrade(), published: structuredClone(published) }] }] }));
    for (const name of ['teacher_set_assignment_grading_v1', 'teacher_publish_vocabulary_grades_v1']) {
        await teacher.route(`${teacherBackend}${name}`, route => {
            const args = route.request().postDataJSON(); writes.push({ name, args });
            assert.equal(args.p_expected_user_id, teacherIds.teacher);
            assert.equal(args.p_school_id, teacherIds.school); assert.equal(args.p_assignment_id, assignmentId);
            assert.equal(args.p_expected_revision, revision);
            assert.match(route.request().headers().authorization || '', /^Bearer /);
            if (name === 'teacher_set_assignment_grading_v1') config = structuredClone(args.p_config);
            else published = { ...liveGrade(), publishedAt: '2026-11-04T12:00:00Z' };
            revision++; return reply(route, { revision });
        });
    }
    const progressHash = `#/teacher/students?class=${teacherIds.class}&display=progress&period=3&from=2026-09-01&to=2026-12-31`;
    await teacher.goto(`${baseUrl}/teacher.html${progressHash}`); await settledTeacher(teacher);
    await teacher.getByRole('button', { name: 'Retry progress', exact: true }).waitFor();
    failProgress = false;
    await teacher.getByRole('button', { name: 'Retry progress', exact: true }).click();
    await teacher.getByRole('table', { name: 'Required work completion' }).getByText('50%', { exact: true }).waitFor();
    assert.match(new URL(teacher.url()).hash, /display=progress/);
    await teacher.reload(); await settledTeacher(teacher);
    await teacher.getByRole('table', { name: 'Required work completion' }).waitFor();
    const progress = teacher.getByRole('region', { name: 'Trimester progress' });
    await progress.getByLabel('Month', { exact: true }).selectOption('2026-10');
    await progress.getByLabel('Activity', { exact: true }).selectOption('flashcards');
    await progress.getByText('1 / 1 tasks', { exact: true }).waitFor();
    await teacher.reload(); await settledTeacher(teacher);
    await progress.getByText('1 / 1 tasks', { exact: true }).waitFor();
    assert.equal(await progress.getByLabel('Month', { exact: true }).inputValue(), '2026-10');
    assert.equal(await progress.getByLabel('Activity', { exact: true }).inputValue(), 'flashcards');
    await teacher.setViewportSize({ width: 320, height: 844 });
    assert.equal(await noOverflow(teacher), true, 'progress filters fit at 320px');
    await teacher.setViewportSize({ width: 1440, height: 1000 });
    await teacher.getByRole('button', { name: 'Grades', exact: true }).click();
    let table = teacher.getByRole('table', { name: 'Class vocabulary grades' });
    await table.waitFor();
    assert.ok(requests.includes(modulePath('js/teacherVocabularyGradebook.js')), 'real teacher navigation requested its lazy gradebook module');
    assert.match(new URL(teacher.url()).hash, /display=grades/);
    await table.getByRole('button', { name: `Grading settings for ${title}`, exact: true }).click();
    await teacher.getByLabel('Required work points', { exact: true }).fill('50');
    assert.equal(await teacher.getByRole('button', { name: 'Publish current grades', exact: true }).isDisabled(), true);
    await teacher.getByRole('button', { name: 'Save grading', exact: true }).click();
    await teacher.getByRole('dialog').waitFor({ state: 'detached' });
    await table.getByRole('button', { name: 'Fixture Student, Grading flow vocabulary: 30 of 50 points', exact: true }).waitFor();
    await table.getByRole('button', { name: `Grading settings for ${title}`, exact: true }).click();
    await teacher.getByRole('button', { name: 'Publish current grades', exact: true }).click();
    await teacher.getByRole('dialog').waitFor({ state: 'detached' });
    await table.getByText('Published', { exact: true }).waitFor();
    failGrades = true;
    await teacher.reload(); await settledTeacher(teacher);
    await teacher.getByRole('button', { name: 'Retry grades', exact: true }).waitFor();
    failGrades = false;
    await teacher.getByRole('button', { name: 'Retry grades', exact: true }).click();
    table = teacher.getByRole('table', { name: 'Class vocabulary grades' }); await table.waitFor();
    await teacher.setViewportSize({ width: 390, height: 844 });
    await teacher.getByLabel('Grade student', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await noOverflow(teacher), true, 'gradebook fits a phone viewport');
    assert.match(await teacher.locator('.vocabulary-gradebook-mobile').textContent(), /30 \/ 50/);
    await teacher.setViewportSize({ width: 1440, height: 1000 });

    const studentContext = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    await isolateBackend(studentContext, 'https://fixture.supabase.co');
    const student = await studentContext.newPage();
    const studentFixture = await installStudentAssignedFlowFixture(student, { completeRequiredActivities: true });
    assert.equal(studentFixture.detail.class_id, studentFlowIds.class, 'the fixture preserves the real assignment RPC class_id');
    const studentRequests = [], studentResponses = [], studentRequestFailures = [];
    student.on('request', request => studentRequests.push(new URL(request.url()).pathname));
    student.on('response', response => studentResponses.push({ path: new URL(response.url()).pathname, status: response.status() }));
    student.on('requestfailed', request => studentRequestFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
    const classReadRelease = deferred(), gradeReadRelease = deferred();
    let classReadReached = false, holdClassRead = true, holdGradeRead = false;
    await student.route('https://fixture.supabase.co/rest/v1/rpc/my_teaching_classes_v1', async route => {
        if (holdClassRead) { classReadReached = true; await classReadRelease.promise; }
        return route.fallback();
    });
    await student.route('https://fixture.supabase.co/rest/v1/rpc/my_class_vocabulary_grades_v1', async route => {
        if (holdGradeRead) await gradeReadRelease.promise;
        const args = route.request().postDataJSON(); assert.equal(args.p_school_id, studentFlowIds.school); assert.equal(args.p_class_id, studentFlowIds.class);
        return failStudent ? reply(route, { message: 'Controlled published-grade read failure' }, 503)
            : reply(route, { grades: published?.enabled ? [structuredClone(published)] : [] });
    });
    const studentUrl = `${baseUrl}/student.html#/unit/assignment.${assignmentId}`;
    await student.goto(studentUrl);
    const panel = student.getByRole('region', { name: 'Published vocabulary grade' });
    try {
        await panel.getByText('30 / 50', { exact: true }).waitFor();
    } catch (error) {
        const state = await student.evaluate(() => {
            const app = window.studentApp;
            return { hash: location.hash, authInitialized: app?.authInitialized, authenticated: Boolean(app?.currentUser),
                currentView: app?.currentView, assignmentId: app?.currentVocab?.assignmentId, assignmentClassId: app?.currentVocab?.classId,
                classReady: app?.activities?.vocabularyData?.classSelection?.ready, classGeneration: app?.activities?.vocabularyData?.classSelection?.generation,
                text: document.body.innerText.slice(0, 3000),
                panelCount: document.querySelectorAll('[aria-label="Published vocabulary grade"]').length };
        }).catch(() => ({ unavailable: true }));
        console.error('Student issued-grade render diagnostics:', JSON.stringify({ state,
            fixtureErrors: studentFixture.errors.slice(-8), requests: studentRequests.slice(-45),
            responses: studentResponses.slice(-35), failedRequests: studentRequestFailures.slice(-8), published: Boolean(published?.enabled) }));
        throw error;
    }
    assert.equal(classReadReached, true, 'the actual independent class snapshot request is held');
    assert.equal(await student.evaluate(() => studentApp.activities.vocabularyData.classSelection.ready), false,
        'the assignment-pinned grade renders before the independent class snapshot returns');
    holdClassRead = false; classReadRelease.resolve();
    await student.waitForFunction(() => studentApp.activities.vocabularyData.classSelection.ready);
    // A genuine same-class refresh may start while a published-grade read is held.
    // Its transport generation must not invalidate the assignment's grade owner.
    await panel.locator('.student-vocabulary-grade-score').click();
    holdGradeRead = true;
    const pendingGradeRead = student.waitForRequest(request => new URL(request.url()).pathname === '/rest/v1/rpc/my_class_vocabulary_grades_v1');
    await panel.getByRole('button', { name: 'Check for updates', exact: true }).click();
    await pendingGradeRead;
    const classRefresh = await student.evaluate(async () => {
        const data = studentApp.activities.vocabularyData, selection = data.classSelection;
        const before = selection.generation;
        await data.prepareClassData({ forceRefresh: true });
        return { before, after: selection.generation, selectedId: selection.selectedId, assignmentClassId: studentApp.currentVocab.classId };
    });
    assert.ok(classRefresh.after > classRefresh.before, 'the real background class read advances its request generation');
    assert.equal(classRefresh.selectedId, studentFlowIds.class);
    assert.equal(classRefresh.assignmentClassId, studentFlowIds.class);
    holdGradeRead = false; gradeReadRelease.resolve();
    await panel.getByText('30 / 50', { exact: true }).waitFor();
    assert.ok(studentRequests.includes(modulePath('js/student/studentVocabularyGradePanel.js')), 'real unit route requested its lazy published-grade module');
    assert.equal(await noOverflow(student), true, 'student published grade fits a phone viewport');
    await student.reload(); await panel.getByText('30 / 50', { exact: true }).waitFor();
    await panel.locator('.student-vocabulary-grade-score').click();
    failStudent = true;
    await panel.getByRole('button', { name: 'Check for updates', exact: true }).click();
    await panel.getByRole('button', { name: 'Retry grade', exact: true }).waitFor();
    assert.equal(await panel.getByText('0 / 50', { exact: true }).count(), 0);
    failStudent = false;
    await panel.getByRole('button', { name: 'Retry grade', exact: true }).click();
    await panel.getByText('30 / 50', { exact: true }).waitFor();
    await panel.getByText('How this grade was earned', { exact: true }).click();
    await panel.getByText(/Flashcards.*Required.*Complete.*25 points/).waitFor();

    // Draft disabling must keep the issued snapshot until an explicit publication.
    await table.getByRole('button', { name: `Grading settings for ${title}`, exact: true }).click();
    await teacher.getByLabel('Grade this vocabulary', { exact: true }).uncheck();
    await teacher.getByRole('button', { name: 'Save grading', exact: true }).click();
    await teacher.getByRole('dialog').waitFor({ state: 'detached' });
    await panel.getByRole('button', { name: 'Check for updates', exact: true }).click();
    await panel.getByText('30 / 50', { exact: true }).waitFor();
    await table.getByRole('button', { name: `Grading settings for ${title}`, exact: true }).click();
    await teacher.getByRole('button', { name: 'Publish ungraded status', exact: true }).click();
    await teacher.getByRole('dialog').waitFor({ state: 'detached' });
    await panel.getByRole('button', { name: 'Check for updates', exact: true }).click();
    await student.locator('.student-vocabulary-grade').waitFor({ state: 'hidden' });
    assert.equal(writes.length, 4); assert.equal(revision, 4);

    await teacher.goto(`${baseUrl}/teacher.html#/teacher/vocabulary`); await settledTeacher(teacher);
    await teacher.locator('#teacher-library-create-btn').click();
    await teacher.locator('#create-new-btn').click();
    await teacher.locator('#teacher-editor-view.active').waitFor();
    await teacher.locator('#vocab-editor-tab-config').click();
    const settings = teacher.getByRole('region', { name: 'Vocabulary grading', exact: true });
    await settings.getByLabel('Grade this vocabulary', { exact: true }).waitFor();
    assert.equal(await settings.getByLabel('Grade this vocabulary', { exact: true }).isChecked(), false);
    await settings.getByLabel('Grade this vocabulary', { exact: true }).check();
    await settings.getByLabel('Base points', { exact: true }).fill('50');
    await settings.getByLabel('Extra points per additional activity', { exact: true }).fill('2.5');
    await settings.getByLabel('Maximum extra points', { exact: true }).fill('10');
    await teacher.waitForFunction(() => teacherApp.vocabSet.activitySettings.grading?.maxPoints === 50 && teacherApp.vocabSet.activitySettings.grading?.bonusPerActivity === 2.5);
    assert.deepEqual(await teacher.evaluate(() => teacherApp.vocabSet.activitySettings.grading), { enabled: true, maxPoints: 50, bonusPerActivity: 2.5, bonusCap: 10, capAtMaxPoints: false });
    await teacher.setViewportSize({ width: 390, height: 844 });
    assert.equal(await noOverflow(teacher), true, 'editor grading defaults fit a phone viewport');
    assert.deepEqual(forbidden, [], 'all backend traffic stays within the synthetic fixtures');
    assert.deepEqual(teacherFixture.errors, []); assert.deepEqual(studentFixture.errors, []);
    console.log(`Real-entry progress/grading flow passed (${built ? 'final built output' : 'source'}): independent class snapshot, same-class refresh during held grade read, routes/reloads, read retries, captured-principal save/publish, immutable issued grade, explicit ungrading, editor defaults, lazy requests and mobile.`);
    await studentContext.close(); await teacherContext.close();
} finally { await browser?.close(); server?.kill(); }
