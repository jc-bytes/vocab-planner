import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { createClassroomRepository } from '../js/services/classroomRepository.js';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { AUDIT_PASSWORD, AUDIT_STUDENT_EMAIL, AUDIT_TEACHER_EMAIL, seedLocalAuditData, getBrowserSupabaseConfig } from './lib/local-supabase-audit.mjs';
import { assertNoAccessibilityViolations } from './lib/accessibility-audit.mjs';
import { seedReturningStudentGuidePreferences } from './lib/student-guide-fixture.mjs';

const port = 8074, baseUrl = `http://127.0.0.1:${port}`;
const output = '/tmp/sparks-student-class-selector';
let server, browser, page;
try {
    const seeded = await seedLocalAuditData();
    const config = getBrowserSupabaseConfig(seeded.status);
    // Keep the established August fixture and publish an explicit October unit.
    // Both are needed to prove the current trimester excludes older work.
    const materialId = 'audit-current-class-vocabulary';
    await seeded.admin.from('vocabularies').upsert({ id: materialId, owner_id: seeded.users.teacher.id,
        school_id: seeded.schoolId, teacher_subject_id: seeded.subject.id, name: 'Current class unit',
        assigned_date: '2026-10-01', trimester: '3', month: 'October', week: 1,
        words: [{ word: 'Source', definition: 'Where information comes from.' }],
        activity_settings: { requiredActivities: ['flashcards'] }
    }).throwOnError();
    const teacher = createClient(config.url, config.publishableKey, { auth: { persistSession: false } });
    await teacher.auth.signInWithPassword({ email: AUDIT_TEACHER_EMAIL, password: AUDIT_PASSWORD }).then(({error}) => { if(error) throw error; });
    await createClassroomRepository(() => teacher, () => seeded.schoolId).publishMaterial({
        classIds: [seeded.classroom.id], kind: 'vocabulary', materialId,
        releaseAt: '2026-10-01T12:00:00Z', publicationKey: '6b47ab0a-2026-4000-8000-000000000004'
    });
    await teacher.auth.signOut();
    server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port });
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.grantPermissions(['local-network-access'], {origin:baseUrl});
    await context.routeWebSocket(url => url.host === `127.0.0.1:${port}`, socket => socket.close());
    await context.addInitScript(value => { window.SUPABASE_CONFIG = value; }, config);
    page = await context.newPage();
    await seedReturningStudentGuidePreferences(page, seeded.users.student.id);
    await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
    const errors = [], writes = [];
    let classReads = 0;
    page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
    page.on('requestfailed', request => console.error('Failed request', request.url(), request.failure()));
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
        if (/\/rpc\/(my_teaching_classes_v1|read_class_assignment_v1)/.test(request.url())) classReads++;
        if (/\/rest\/v1\//.test(request.url()) && !['GET', 'HEAD'].includes(request.method()) && !/\/rpc\//.test(request.url())) writes.push(request.url());
        if (/\/rpc\/(publish_|invite_|remove_|withdraw_|save_|check_class_|create_|accept_)/.test(request.url())) writes.push(request.url());
    });
    await context.route('**/student.html*', async route => {
        const response = await route.fetch();
        const html = (await response.text()).replace("connect-src 'self'", `connect-src 'self' ${config.url} ${config.url.replace('http:', 'ws:')}`);
        await route.fulfill({ response, body: html });
    });
    await page.goto(`${baseUrl}/student.html`, { waitUntil: 'domcontentloaded' });
    await page.locator('#login-email').fill(AUDIT_STUDENT_EMAIL);
    await page.locator('#login-password').fill(AUDIT_PASSWORD);
    await page.locator('#student-login-form button[type="submit"]').click();
    await page.locator('#student-tab-shell:not(.hidden)').waitFor({ timeout: 30000 });
    assert.equal(await page.locator('#student-tab-classes').count(), 0);
    await page.locator('#student-tab-vocabulary').click();
    const selector = page.locator('#student-subject-picker .student-subject-trigger');
    await selector.waitFor();
    assert.ok(await selector.textContent(), 'An enrolled class is selected automatically');
    assert.ok(!(await selector.textContent()).includes('6A'), 'Class label omits the group');
    await page.locator('#vocab-list .student-vocab-card, #vocab-list .student-vocab-unit-row').first().waitFor();
    await mkdir(output, { recursive: true });
    const headerOrder = await page.evaluate(() => {
        const picker = document.querySelector('#student-subject-picker').getBoundingClientRect();
        const arcade = document.querySelector('.student-top-bar .student-arcade-balance').getBoundingClientRect();
        return picker.width > 0 && picker.right <= arcade.left && arcade.left - picker.right < 30;
    });
    assert.ok(headerOrder, 'Class selector sits immediately left of Arcade Time');
    await page.screenshot({ path: `${output}/units-desktop.png`, fullPage: true });
    await assertNoAccessibilityViolations(page, 'Student class units', { include: ['#student-tab-shell', '#vocab-selection-view'] });
    const real = await page.locator('#student-subject-picker .student-subject-option').allTextContents();
    assert.equal(await page.locator('#vocab-list').getByText('Cross-browser Audit Vocabulary', {exact:true}).count(), 0, 'Older trimester unit is excluded');
    assert.ok((await page.evaluate(() => location.hash)).includes('trimester=IIIT'), 'Old trimester URL normalizes to current trimester');
    const readsBeforeMonth = classReads;
    await page.getByRole('button', {name:'Back to Months', exact:true}).click();
    await page.locator('#vocab-list .teacher-library-choice-card').first().waitFor();
    assert.equal(await page.locator('#vocab-list').getByText('August', {exact:true}).count(), 0, 'Older trimester month is excluded');
    await page.locator('#vocab-list .teacher-library-choice-card').first().click();
    await page.locator('#vocab-list .student-vocab-card').first().waitFor();
    assert.equal(classReads, readsBeforeMonth, 'Month navigation reuses loaded assignments');

    let releaseClasses;
    const classesReady = new Promise(resolve => { releaseClasses = resolve; });
    const pauseClasses = async route => { await classesReady; await route.continue(); };
    await page.route('**/rest/v1/rpc/my_teaching_classes_v1', pauseClasses);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const loadingSelector = page.locator('#student-subject-picker .student-subject-trigger');
    await loadingSelector.waitFor();
    assert.equal(await loadingSelector.isEnabled(), false, 'Refresh keeps a disabled loading class selector visible');
    await page.screenshot({ path: `${output}/refresh-loading.png`, fullPage: true });
    releaseClasses();
    await page.waitForFunction(() => document.querySelector('#student-subject-picker .student-subject-trigger')?.disabled === false);
    await page.unroute('**/rest/v1/rpc/my_teaching_classes_v1', pauseClasses);

    await page.locator('#student-tab-sparks').click();
    for (let level=0; level<3; level++) { await page.locator('#student-sparks-library .student-spark-library-choice').first().waitFor(); await page.locator('#student-sparks-library .student-spark-library-choice').first().click(); }
    await page.locator('#student-sparks-library .student-class-spark-questions textarea').waitFor();
    assert.equal(await page.locator('#student-sparks-library select').count(), 0, 'No school selector or management controls');
    assert.equal(await page.locator('#student-sparks-library').getByText('Audit Technology · Audit 6A', {exact:true}).count(), 0);
    await page.screenshot({ path: `${output}/sparks-desktop.png`, fullPage: true });
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:`${output}/sparks-phone.png`,fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'Sparks has no phone overflow');
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(`${baseUrl}/student.html#/classes`);
    await page.waitForFunction(() => location.hash.startsWith('#/units'));
    await page.locator('#vocab-list .student-vocab-card, #vocab-list .student-vocab-unit-row').first().waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${output}/units-phone.png`, fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No phone overflow');
    const behavior = await page.evaluate(async () => {
        const { StudentClassSelection } = await import('/js/student/studentClassSelection.js');
        let owner = 'one', resolveOld;
        const manager = { currentUser: { uid: owner }, resetStudentVocabularyDrilldown() {}, parseRoute: () => ({ view: 'units' }), navigateTo() {} };
        let classes = [{ id: 'a', subjectName: 'Technology', name: '6A' }];
        const repository = { listMyClasses: async () => classes, listAssignments: async id => [{ id, kind: 'vocabulary', release_at: '2020-01-01' }],
            readAssignment: async id => ({ id, kind: 'vocabulary', content: { words: [] }, title: `Unit ${id}` }) };
        const selection = new StudentClassSelection(manager, repository);
        await selection.load();
        const one = selection.selectedId === 'a' && selection.vocabs[0].assignmentId === 'a';
        classes = [...classes, { id: 'b', subjectName: 'Science', name: '6A' }];
        await selection.load({forceRefresh:true}); selection.select('b'); await selection.load();
        const multiple = selection.selectedId === 'b' && selection.vocabs[0].assignmentId === 'b';
        const root = document.createElement('div'); selection.render(root);
        const options = root.querySelectorAll('.student-subject-option').length;
        repository.readAssignment = () => new Promise(resolve => { resolveOld = resolve; });
        const old = selection.load({forceRefresh:true});
        // Observe cancellation before reset so the intentional rejection cannot
        // escape as an unhandled browser error. Other failures remain failures.
        const cancelled = old.then(() => { throw new Error('Reset did not cancel the old class read.'); }, error => {
            if (error.name !== 'AbortError' || error.message !== 'Class loading cancelled') throw error;
        });
        const deadline = performance.now() + 3000;
        while (!resolveOld) {
            if (performance.now() >= deadline) throw new Error('The held class assignment read was not reached.');
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        manager.currentUser = { uid: 'two' }; selection.reset();
        resolveOld({ id: 'b', kind: 'vocabulary', content: {}, title: 'Old unit' }); await cancelled;
        const isolated = !selection.vocabs.length && !selection.classes.length;
        classes = []; await selection.load(); selection.render(root);
        const empty = root.querySelector('.student-subject-trigger').disabled && !selection.selectedId;
        return { one, multiple, options, isolated, empty };
    });
    assert.deepEqual(behavior, { one: true, multiple: true, options: 2, isolated: true, empty: true });
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
    console.log(JSON.stringify({ realClasses: real, behavior, screenshots: output, dataWrites: writes.length }, null, 2));
} catch (error) { if (page) { await mkdir(output, {recursive:true}); await page.screenshot({path: `${output}/failure.png`, fullPage:true}); console.error(await page.locator('body').innerText()); } throw error; } finally { await browser?.close(); server?.kill(); }
