import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { assertNoAccessibilityViolations } from './lib/accessibility-audit.mjs';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const host = '127.0.0.1', port = Number(process.env.UI_TEACHER_ASSIGNMENTS_PORT || 8042), baseUrl = `http://${host}:${port}`;
let server, browser;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/', host, port });
    browser = await chromium.launch(); const context = await browser.newContext({ acceptDownloads: true, timezoneId: 'America/Panama' }); const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const teacherHtml = await readFile(new URL('../teacher.html', import.meta.url), 'utf8');
    const styles = [...teacherHtml.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map(match => match[0]).join('');
    await page.route('**/assignment-workspace-fixture', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Assignments fixture</title>${styles}</head><body class="teacher-site"><div class="app-container"><main class="teacher-main"></main></div></body></html>` }));
    await page.goto(`${baseUrl}/assignment-workspace-fixture`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const root = document.createElement('section'); root.id = 'teacher-assignments-view'; root.className = 'view active'; document.querySelector('main').append(root);
        const state = window.assignmentSmoke = { owner: 'teacher-a', calls: [], fail: true, navigation: [], published: [], root };
        const classes = [{ id: 'class-a', canTeach: true, name: '6A', school_year: 2026, subject: { name: 'Technology' } }, { id: 'class-b', canTeach: true, name: '6A', school_year: 2026, subject: { name: 'Science' } }, { id: 'archived', name: 'Old class', archived: true }];
        state.classes = classes;
        const assignments = [{ id: 'future', class_id: 'class-a', kind: 'vocabulary', title: 'Future vocabulary', release_at: '2099-01-01T00:00:00Z' }, { id: 'historical', class_id: 'class-a', kind: 'spark', title: 'Historical Spark', withdrawn: true, release_at: '2020-01-01T00:00:00Z' }, { id: 'vocab-a', class_id: 'class-a', kind: 'vocabulary', title: 'Vocabulary A', release_at: '2026-09-01T12:00:00Z' }, { id: 'spark-b', class_id: 'class-b', kind: 'spark', title: 'Spark B', release_at: '2026-09-01T12:00:00Z' }];
        state.repository = {
            listReviewResponses: async ids => ids.includes('spark-b') ? [{ assignment_id: 'spark-b', student_id: 'c', revision: 1, evaluation: { needsTeacherReview: true } }] : [],
            listClasses: async () => classes,
            listOwnMaterials: async () => [{ id: 'vocab', kind: 'vocabulary', title: 'Saved vocabulary' }, { id: 'spark', kind: 'spark', title: 'Saved Spark' }],
            publishMaterial: async payload => { state.calls.push(structuredClone(payload)); if (state.fail) { state.fail = false; throw new Error('Network interrupted'); } return ['new-a', 'new-b']; },
            listAssignments: async classId => assignments.filter(a => !classId || a.class_id === classId),
            getRoster: async classId => classId === 'class-a' ? [{ studentId: 'a', name: 'Ana' }, { studentId: 'b', name: 'Ben' }] : [{ studentId: 'c', name: 'Cora' }],
            getResults: async () => [{ studentId: 'a', name: 'Ana', activity: 'matching', score: 0, accuracy: 0, complete: false }],
            listResponses: async () => [{ revision:1, student_id: 'c', response: 'My private written answer', evaluation: { correct: 1, automaticTotal: 2, needsTeacherReview: true, isComplete:false } }],
            withdrawAssignment: async id => { state.withdrawn = id; }
        };
        state.notes=[];
        state.repository.assignmentFeedback=async assignmentId=>state.notes.filter(n=>n.assignment_id===assignmentId);
        state.repository.saveStudentFeedback=async input=>{
            const record={student_id:input.studentId,assignment_id:input.assignmentId,activity_type:input.activityType,revision:input.expectedRevision+1,note:input.note,review_status:input.reviewStatus,response_revision:input.responseRevision,updated_at:new Date().toISOString()};
            state.notes=state.notes.filter(n=>n.student_id!==record.student_id || n.assignment_id!==record.assignment_id || n.activity_type!==record.activity_type);state.notes.push(record);return record;
        };
        state.repository.studentFeedbackHistory=async()=>state.notes;
        state.saveStudentFeedback = state.repository.saveStudentFeedback;
        const { createTeacherAssignmentPublisher } = await import('/js/teacherAssignmentPublisher.js');
        const { createTeacherAssignmentsWorkspace } = await import('/js/teacherAssignmentsWorkspace.js');
        state.makePublisher = () => createTeacherAssignmentPublisher({ getUserId: () => state.owner, repository: state.repository, onPublished: result => state.published.push(result) });
        state.publisher = state.makePublisher();
        state.workspace = createTeacherAssignmentsWorkspace({ root, getUserId: () => state.owner, repository: state.repository,
            onNavigate: next => { state.navigation.push(next); return state.workspace.show(next); }, onPublish: next => state.publisher.open(next) });
        await state.workspace.show();
    });
    await page.getByRole('button', { name: 'Assign material', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Saved material').selectOption('1');
    await page.getByRole('dialog').getByLabel('Technology · 6A · 2026', { exact: true }).check();
    await page.getByRole('dialog').getByLabel('Science · 6A · 2026', { exact: true }).check();
    assert.equal(await page.getByRole('dialog').getByText('Old class').count(), 0);
    await page.getByRole('dialog').getByLabel('Available from').fill('2026-09-09T09:15');
    await page.getByRole('dialog').getByLabel('Due date (optional)').fill('2026-09-08T09:15');
    await page.getByRole('dialog').getByRole('button', { name: 'Assign material', exact: true }).click();
    assert.equal(await page.evaluate(() => window.assignmentSmoke.calls.length), 0);
    await page.getByRole('dialog').getByLabel('Due date (optional)').fill('2026-09-10T09:15');
    await page.getByRole('dialog').getByRole('button', { name: 'Assign material', exact: true }).click();
    await page.getByRole('button', { name: 'Retry assignment' }).waitFor();
    assert.equal(await page.getByRole('dialog').getByLabel('Saved material').isDisabled(), true);
    await page.getByRole('button', { name: 'Retry assignment' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    const payloads = await page.evaluate(() => window.assignmentSmoke.calls);
    assert.equal(payloads.length, 2); assert.deepEqual(payloads[0], payloads[1]);
    assert.equal(payloads[0].releaseAt, '2026-09-09T14:15:00.000Z'); assert.equal(payloads[0].dueAt, '2026-09-10T14:15:00.000Z');
    assert.deepEqual(payloads[0].classIds, ['class-a', 'class-b']); assert.equal(payloads[0].kind, 'spark');
    await page.getByRole('button', { name: 'Assign material', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Saved material').waitFor();
    await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Assign material', exact: true }).evaluate(e => e === document.activeElement), true);
    // Cancelling an in-flight withdrawal must not close a new dialog or redraw its old view.
    await page.evaluate(() => { const s = window.assignmentSmoke; s.repository.withdrawAssignment = () => new Promise(resolve => { s.resolveWithdrawal = resolve; }); });
    await page.getByRole('button',{name:'Open Vocabulary A · 6A',exact:true}).click();
    await page.getByRole('tab', {name:'Details',exact:true}).click();
    await page.getByRole('button', { name: 'Withdraw assignment', exact: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Withdraw assignment', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Back to assignments', exact: true }).click();
    await page.getByRole('button', { name: 'Assign material', exact: true }).click();
    await page.evaluate(async () => { window.assignmentSmoke.resolveWithdrawal(); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(await page.getByRole('dialog', { name: 'Assign material', exact: true }).count(), 1);
    await page.keyboard.press('Escape');
    // Preserve the library filters when opening work and returning.
    await page.getByRole('button',{name:'Filter assignments',exact:true}).click();
    await page.getByLabel('Type',{exact:true}).selectOption('vocabulary');
    await page.getByRole('button',{name:'Done',exact:true}).click();
    await page.getByRole('button',{name:'Open Vocabulary A · 6A',exact:true}).click();
    await page.getByRole('button', { name: 'Back to assignments', exact: true }).click();
    await page.getByRole('button',{name:'Filter assignments',exact:true}).click();
    assert.equal(await page.getByLabel('Type',{exact:true}).inputValue(), 'vocabulary');
    await page.getByLabel('Type',{exact:true}).selectOption('all');
    await page.getByRole('button',{name:'Done',exact:true}).click();
    assert.equal(await page.evaluate(() => window.assignmentSmoke.navigation.at(-1).mode), 'assignments');
    await page.getByRole('tab',{name:'Scheduled',exact:true}).click();
    await page.getByRole('button',{name:'Open Future vocabulary · 6A',exact:true}).waitFor();
    await page.getByRole('tab',{name:'History',exact:true}).click();
    await page.getByRole('button',{name:'Open Historical Spark · 6A',exact:true}).waitFor();
    await page.getByRole('tab',{name:'Needs review',exact:true}).click();
    await assertNoAccessibilityViolations(page, 'Needs review', {include:['#teacher-assignments-view']});
    assert.equal(await page.getByRole('button',{name:'Open Spark B · 6A',exact:true}).count(),1);
    assert.equal(await page.getByRole('button',{name:'Open Vocabulary A · 6A',exact:true}).count(),0);
    await page.getByRole('button',{name:'Open Spark B · 6A',exact:true}).click();
    assert.equal(await page.getByLabel('Show work',{exact:true}).inputValue(),'needs-review');
    await page.getByRole('button',{name:'Back to assignments',exact:true}).click();
    await page.getByRole('tab',{name:'Current',exact:true}).click();
    // Scope comes from assignment/class IDs, even when two classes share a name.
    await page.evaluate(() => window.assignmentSmoke.workspace.show({ mode: 'review', classId: 'class-a', assignmentId: 'vocab-a' }));
    assert.equal(await page.getByRole('cell', { name: 'No work submitted', exact: true }).count(), 1);
    assert.equal(await page.getByText('Cora', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Export results' }).click();
    await page.getByRole('dialog').getByLabel('Ben', { exact: true }).uncheck();
    assert.equal(await page.getByRole('dialog').getByText('1 of 2 students selected').count(), 1);
    const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download CSV' }).click();
    const csv = await readFile(await (await downloadPromise).path(), 'utf8');
    assert.ok(csv.includes('"a","Ana"')); assert.ok(!csv.includes('"b","Ben"')); assert.ok(csv.includes('"matching","0","0"'));
    await page.getByRole('dialog').getByLabel('Format').selectOption('pdf');
    assert.equal(await page.getByRole('dialog').getByLabel('Include update times').isVisible(), false);
    await page.getByRole('dialog').getByLabel('PDF page layout').selectOption('landscape');
    const pdfDownloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download PDF' }).click();
    const pdfBytes = await readFile(await (await pdfDownloadPromise).path(), 'latin1');
    assert.ok(pdfBytes.startsWith('%PDF-')); assert.ok(pdfBytes.includes('(Ana)')); assert.ok(!pdfBytes.includes('(Ben)'));
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await page.evaluate(() => window.assignmentSmoke.workspace.show({ mode: 'review', classId: 'class-b', assignmentId: 'spark-b' }));
    assert.equal(await page.getByText('My private written answer', { exact: true }).count(), 1);
    assert.equal(await page.getByText('Written answers need teacher review.', { exact: true }).count(), 1);
    await page.getByLabel('Note',{exact:true}).fill('Explain your reasoning.');
    await page.getByLabel('Submission review').selectOption('reviewed');
    await page.getByRole('button',{name:'Save teacher note',exact:true}).click();
    await page.getByText('Teacher note saved.',{exact:true}).waitFor();
    assert.equal(await page.getByText('Written answers need teacher review.',{exact:true}).count(),0);
    assert.equal(await page.locator('[data-feedback-student="c"]').innerText(),'In progress');
    await page.evaluate(()=>window.assignmentSmoke.workspace.show({mode:'review',classId:'class-b',assignmentId:'spark-b'}));
    assert.equal(await page.getByLabel('Note',{exact:true}).inputValue(),'Explain your reasoning.');
    // A note-save response cannot repopulate another teacher's review panel.
    await page.evaluate(()=>{const s=window.assignmentSmoke;s.repository.saveStudentFeedback=()=>new Promise(resolve=>{s.resolveNote=resolve;});});
    await page.getByLabel('Note',{exact:true}).fill('Draft for teacher A');
    await page.getByRole('button',{name:'Save teacher note',exact:true}).click();
    await page.evaluate(async()=>{const s=window.assignmentSmoke;s.owner='teacher-b';s.workspace.hide();s.root.replaceChildren();s.resolveNote({note:'Secret teacher A note',revision:2,updated_at:new Date().toISOString()});await new Promise(resolve=>setTimeout(resolve,0));});
    assert.equal(await page.getByText('Secret teacher A note').count(),0);
    await page.evaluate(async()=>{const s=window.assignmentSmoke;s.owner='teacher-a';await s.workspace.show({mode:'review',classId:'class-b',assignmentId:'spark-b'});});
    await page.getByRole('button', { name: 'Export results' }).click();
    await page.evaluate(() => { window.assignmentSmoke.owner = 'teacher-b'; });
    await page.getByRole('button', { name: 'Download CSV' }).click(); assert.equal(await page.getByRole('dialog').count(), 0);
    // Cancelling a pending publisher cannot redirect the page when its request finishes.
    await page.evaluate(() => {
        const s = window.assignmentSmoke; s.owner = 'teacher-a'; s.repository.publishMaterial = () => new Promise(resolve => { s.resolvePublication = resolve; });
        return s.publisher.open({ classId: 'class-a' });
    });
    await page.getByRole('dialog').getByRole('button', { name: 'Assign material', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await page.evaluate(async () => { window.assignmentSmoke.resolvePublication([]); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(await page.evaluate(() => window.assignmentSmoke.published.length), 1);
    // School administrators can inspect work, but only assigned teachers can change it.
    await page.evaluate(async () => {
        const s = window.assignmentSmoke;
        s.classes.forEach(c => { c.canTeach = false; });
        await s.workspace.show();
    });
    assert.equal(await page.getByRole('button', { name: 'Assign material', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Withdraw assignment', exact: true }).count(), 0);
    await page.evaluate(() => window.assignmentSmoke.publisher.open());
    await page.getByText('You need a teaching assignment in an active class to publish work.').waitFor();
    await page.keyboard.press('Escape');
    await page.evaluate(async () => {
        const s = window.assignmentSmoke; s.classes[0].canTeach = true;
        await s.workspace.show();
    });
    await page.getByRole('button',{name:'Open Vocabulary A · 6A',exact:true}).click();
    await page.getByRole('tab', {name:'Details',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Withdraw assignment',exact:true}).count(),1);
    await page.getByRole('button',{name:'Back to assignments',exact:true}).click();
    await page.getByRole('button', { name: 'Assign material', exact: true }).click();
    assert.equal(await page.getByRole('dialog').getByLabel('Technology · 6A · 2026', { exact: true }).count(), 1);
    assert.equal(await page.getByRole('dialog').getByLabel('Science · 6A · 2026', { exact: true }).count(), 0);
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.assignmentSmoke.workspace.show({ classId: 'class-b' }));
    assert.equal(await page.getByRole('button', { name: 'Assign material', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Withdraw assignment', exact: true }).count(), 0);
    // Filters retain drafts and the same pending editor, including away/back before save resolves.
    const feedbackFilters = await page.evaluate(async () => {
        const s = window.assignmentSmoke;
        await s.workspace.show({ mode: 'review', classId: 'class-a', assignmentId: 'vocab-a' });
        const picker = document.querySelector('select[name="student"]');
        const filter = value => { picker.value = value; picker.dispatchEvent(new Event('change')); };
        const editor = () => document.querySelector('.student-feedback-editor');
        const button = root => [...root.querySelectorAll('button')].find(b => b.textContent === 'Save teacher note');
        const flush = () => new Promise(resolve => setTimeout(resolve, 0));
        const original = s.saveStudentFeedback;
        let release;
        s.repository.saveStudentFeedback = input => new Promise(resolve => { release = async () => resolve(await original(input)); });
        filter('b'); const ben = editor(); ben.querySelector('textarea').value = 'Ben unsaved draft';
        filter('a'); const ana = editor(); ana.querySelector('textarea').value = 'Ana submitted draft'; button(ana).click();
        filter('b'); const otherDraft = editor().querySelector('textarea').value;
        filter('a'); const sameEditor = editor() === ana, pending = button(editor()).disabled;
        ana.querySelector('textarea').value = 'Ana newer unsaved draft';
        await release(); await flush();
        const newerDraft = ana.querySelector('textarea').value;
        s.repository.saveStudentFeedback = original; button(ana).click(); await flush();
        const record = s.notes.find(n => n.student_id === 'a' && n.assignment_id === 'vocab-a');
        const advancedRevision = record.revision, savedDraft = record.note;
        s.repository.saveStudentFeedback = input => new Promise(resolve => { release = async () => resolve(await original(input)); });
        ana.querySelector('textarea').value = 'Saved while filtered away'; button(ana).click(); filter('b');
        await release(); await flush(); filter('a');
        const detachedSave = editor().textContent.includes(`Note revision ${advancedRevision + 1}`);
        filter('b'); const preservedOther = editor() === ben && editor().querySelector('textarea').value === 'Ben unsaved draft';
        s.repository.saveStudentFeedback = original;
        return { sameEditor, pending, otherDraft, newerDraft, savedDraft, advancedRevision, detachedSave, preservedOther };
    });
    assert.equal(feedbackFilters.sameEditor, true); assert.equal(feedbackFilters.pending, true);
    assert.equal(feedbackFilters.otherDraft, 'Ben unsaved draft'); assert.equal(feedbackFilters.preservedOther, true);
    assert.equal(feedbackFilters.newerDraft, 'Ana newer unsaved draft'); assert.equal(feedbackFilters.savedDraft, 'Ana newer unsaved draft');
    assert.ok(feedbackFilters.advancedRevision >= 2); assert.equal(feedbackFilters.detachedSave, true);
    await page.evaluate(async () => {
        const s = window.assignmentSmoke; s.originalAssignments = s.repository.listAssignments;
        s.repository.listAssignments = async () => Array.from({length:23},(_,i)=>({id:`compact-${i}`,title:`Assignment ${String(i+1).padStart(2,'0')}`,class_id:i%2?'class-b':'class-a',kind:i%2?'spark':'vocabulary',release_at:'2026-09-01T12:00:00Z',due_at:i===22?null:'2026-10-20T12:00:00Z',withdrawn:i===22}));
        await s.workspace.show();
    });
    const compact = page.locator('.assignment-library-rows');
    assert.equal(await compact.locator('article').count(),10);
    await page.getByRole('button',{name:'Next assignments page'}).click();
    await page.getByText('Assignments 11–20 of 22',{exact:true}).waitFor();
    assert.equal(await compact.getByText('Assignment 01',{exact:true}).count(),0);
    await page.getByRole('button',{name:'Next assignments page'}).click();
    assert.equal(await compact.locator('article').count(),2);
    await page.getByRole('button',{name:'Filter assignments',exact:true}).click();
    await page.getByLabel('Type',{exact:true}).selectOption('spark');
    await page.getByText('Assignments 1–10 of 11',{exact:true}).waitFor();
    await page.getByLabel('Sort',{exact:true}).selectOption('title-desc');
    assert.equal(await compact.locator('article strong').first().textContent(),'Assignment 22');
    assert.equal(await page.getByRole('button',{name:'Filter assignments',exact:true}).textContent(),'Filters (1)');
    await page.getByRole('button',{name:'Done',exact:true}).click();
    await page.getByRole('button',{name:'More actions for Assignment 22 · 6A',exact:true}).click();
    await page.getByRole('menuitem',{name:'Assignment details',exact:true}).click();
    await page.locator('.assignment-details-metadata').getByText('Spark',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Back to assignments',exact:true}).click();
    assert.equal(await compact.locator('article strong').first().textContent(),'Assignment 22');
    await page.getByRole('searchbox',{name:'Search assignments'}).fill('Assignment 02');
    await page.getByText('Assignments 1–1 of 1',{exact:true}).waitFor();
    await page.getByRole('searchbox',{name:'Search assignments'}).fill('missing');
    await page.getByText('No assignments match this view.').waitFor();
    await page.getByRole('searchbox',{name:'Search assignments'}).fill('');
    await assertNoAccessibilityViolations(page, 'Unified assignments', {include:['#teacher-assignments-view']});
    await page.evaluate(() => { document.querySelector('.assignment-library-item strong').textContent = 'A long assignment title with several words to check narrow screens and keep its actions visible'; });
    await mkdir('/tmp/sparks-unified-assignments', {recursive:true});
    for(const width of [1440,768,390,320]) {
        await page.setViewportSize({width,height:900});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Assignments fit ${width}`);
        assert.equal(await page.locator('.assignment-library-item').first().evaluate(item => { const title = item.querySelector('strong').getBoundingClientRect(), menu = item.querySelector('.floating-action-menu-trigger').getBoundingClientRect(); return title.right <= menu.left; }), true, `Title clears its actions at ${width}`);
        await page.screenshot({path:`/tmp/sparks-unified-assignments/assignments-${width}.png`,fullPage:true});
    }
    await page.evaluate(()=>{
        const s=window.assignmentSmoke;
        s.repository.listAssignments=()=>new Promise((resolve,reject)=>{s.resolveList=resolve;s.rejectList=reject;});
        s.workspace.show();
    });
    await page.getByText('Loading assignments…',{exact:true}).waitFor();
    assert.equal(await page.locator('#teacher-assignments-view').getAttribute('aria-busy'),'true');
    await page.evaluate(()=>window.assignmentSmoke.rejectList(new Error('Assignments unavailable')));
    const assignmentRecovery = page.locator('#teacher-assignments-view [data-section-recovery]');
    await assignmentRecovery.getByText('Could not load assignments. Check your connection and try again.',{exact:true}).waitFor();
    assert.equal(await assignmentRecovery.getAttribute('role'), 'alert');
    assert.equal(await page.getByText('Assignments unavailable',{exact:true}).count(),0, 'Raw repository errors are replaced by actionable section feedback');
    assert.equal(await page.locator('#teacher-assignments-view').getAttribute('aria-busy'),'false');
    await assignmentRecovery.getByRole('button',{name:'Try again',exact:true}).click();
    await assignmentRecovery.waitFor({state:'detached'});
    await page.getByText('Loading assignments…',{exact:true}).waitFor();
    await page.evaluate(()=>window.assignmentSmoke.resolveList([]));
    await page.getByText('No assignments match this view.').waitFor();
    assert.equal(await page.locator('#teacher-assignments-view').getAttribute('aria-busy'),'false');
    await page.evaluate(()=>{const s=window.assignmentSmoke;s.repository.listAssignments=s.originalAssignments;});
    // A replaced account must not receive a delayed load from the previous account.
    await page.evaluate(() => {
        const s = window.assignmentSmoke; s.owner = 'teacher-a'; s.publisher.destroy(); s.publisher = s.makePublisher();
        s.repository.listOwnMaterials = () => new Promise(resolve => { s.resolveMaterials = resolve; });
        s.loading = s.publisher.open();
    });
    await page.getByRole('dialog').waitFor();
    await page.evaluate(async () => { const s = window.assignmentSmoke; s.owner = 'teacher-b'; s.resolveMaterials([{ id: 'secret', title: 'Teacher A secret', kind: 'vocabulary' }]); await s.loading; });
    assert.equal(await page.getByText('Teacher A secret').count(), 0);
    await page.evaluate(() => { const s = window.assignmentSmoke; s.publisher.hide(); s.workspace.hide(); });
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.evaluate(() => { const s = window.assignmentSmoke; s.publisher.destroy(); s.workspace.destroy(); });
    assert.equal(await page.getByRole('dialog').count(), 0); assert.deepEqual(errors, []);
    console.log('Teacher assignments smoke passed: retry, modal cancellation, private class review, exact scoped CSV, Spark responses, saved teacher notes, review readback and stale account loads.');
} finally { await browser?.close(); server?.kill(); }
