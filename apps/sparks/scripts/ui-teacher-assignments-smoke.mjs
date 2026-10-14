import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const host = '127.0.0.1', port = Number(process.env.UI_TEACHER_ASSIGNMENTS_PORT || 8042), baseUrl = `http://${host}:${port}`;
const screenshots = process.env.UI_TEACHER_COMPLETION_SCREENSHOTS;
let server, browser;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/', host, port });
    browser = await chromium.launch(); const page = await browser.newPage({ acceptDownloads: true, timezoneId: 'America/Panama' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const teacherHtml = (await readFile(new URL('../teacher.html', import.meta.url), 'utf8'))
        .replace(/<script[^>]*src="js\/teacher\.js"[^>]*><\/script>/, '');
    await page.route('**/__teacher-assignments.html', route => route.fulfill({ contentType: 'text/html', body: teacherHtml }));
    await page.goto(`${baseUrl}/__teacher-assignments.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
        document.body.replaceChildren();
        const root = document.createElement('main'); document.body.append(root);
        const state = window.assignmentSmoke = { owner: 'teacher-a', calls: [], fail: true, navigation: [], published: [], root };
        const classes = [{ id: 'class-a', canTeach: true, name: '6A', school_year: 2026, subject: { name: 'Technology' } }, { id: 'class-b', canTeach: true, name: '6A', school_year: 2026, subject: { name: 'Science' } }, { id: 'archived', name: 'Old class', archived: true }];
        state.classes = classes;
        const assignments = [{ id: 'vocab-a', class_id: 'class-a', kind: 'vocabulary', title: 'Vocabulary A', release_at: '2026-09-01T12:00:00Z' }, { id: 'spark-b', class_id: 'class-b', kind: 'spark', title: 'Spark B', release_at: '2026-09-01T12:00:00Z' }];
        state.repository = {
            listClasses: async () => classes,
            listOwnMaterials: async () => [{ id: 'vocab', kind: 'vocabulary', title: 'Saved vocabulary' }, { id: 'spark', kind: 'spark', title: 'Saved Spark' }],
            publishMaterial: async payload => { state.calls.push(structuredClone(payload)); if (state.fail) { state.fail = false; throw new Error('Network interrupted'); } return ['new-a', 'new-b']; },
            listAssignments: async classId => assignments.filter(a => !classId || a.class_id === classId),
            getRoster: async classId => classId === 'class-a' ? [{ studentId: 'a', name: 'Ana' }, { studentId: 'b', name: 'Ben' }] : [{ studentId: 'c', name: 'Cora' }],
            getResults: async () => [{ studentId: 'a', name: 'Ana', activity: 'matching', score: 0, accuracy: 0, complete: false }],
            assignmentCompletion: async assignmentId => ({
                assignment: { id: assignmentId, title: 'Vocabulary A', kind: 'vocabulary',
                    content: state.unknownRequirements ? {} : { activitySettings: { requiredActivities: ['matching', 'quiz', 'flashcards'] } } },
                students: [
                    { studentId: 'a', name: state.longName ? 'Ana Example Student With A Long Family Name And Additional Names' : 'Ana', enrolled: true, progress: [
                        { activity: 'matching', score: 0, accuracy: 0, complete: true, verified: true },
                        { activity: 'hangman', score: 100, complete: true, verified: true }
                    ], feedback: state.notes.filter(n => n.student_id === 'a' && n.assignment_id === assignmentId) },
                    { studentId: 'b', name: 'Ben', enrolled: true, progress: [],
                        feedback: state.notes.filter(n => n.student_id === 'b' && n.assignment_id === assignmentId) },
                    { studentId: 'former', name: 'Former pupil', enrolled: false,
                        progress: [{ activity: 'matching', score: 75, complete: true, verified: true }], feedback: [] }
                ], total: 3, activeTotal: 2, historicalTotal: 1, offset: 0, limit: 100
            }),
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
    await page.getByRole('button', { name: 'Withdraw assignment', exact: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Withdraw assignment', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Assign material', exact: true }).click();
    await page.evaluate(async () => { window.assignmentSmoke.resolveWithdrawal(); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(await page.getByRole('dialog', { name: 'Assign material', exact: true }).count(), 1);
    await page.keyboard.press('Escape');
    // Return to the original list mode and retain its status filter.
    await page.getByLabel('Status').selectOption('Available');
    await page.getByRole('button', { name: 'Review work', exact: true }).first().click();
    await page.getByRole('button', { name: 'Back to assignments', exact: true }).click();
    assert.equal(await page.getByLabel('Status').inputValue(), 'Available');
    assert.equal(await page.evaluate(() => window.assignmentSmoke.navigation.at(-1).mode), 'assignments');
    // Scope comes from assignment/class IDs, even when two classes share a name.
    await page.evaluate(() => window.assignmentSmoke.workspace.show({ mode: 'review', classId: 'class-a', assignmentId: 'vocab-a' }));
    const report = page.getByRole('region', { name: 'Vocabulary completion', exact: true });
    await page.getByText('0 of 2 current class members complete · 1 in progress · 1 not started', { exact: true }).waitFor();
    assert.equal(await report.getByText('Not started · 0/3 required activities', { exact: true }).count(), 1);
    assert.equal(await report.getByText('In progress · 1/3 required activities', { exact: true }).count(), 1);
    assert.equal(await report.getByText('Former pupil', { exact: true }).count(), 0);
    await report.locator('article').filter({ has: page.getByRole('heading', { name: 'Ana', exact: true }) }).locator(':scope > details > summary').click();
    assert.equal(await report.getByText('Remaining: Quiz, Flashcards', { exact: true }).count(), 1);
    assert.equal(await report.getByRole('heading', { name: 'Hangman · Optional', exact: true }).count(), 1);
    assert.equal(await report.getByText('Activity score: 0', { exact: true }).count(), 1);
    assert.equal(await report.getByText('Answer accuracy: 0%', { exact: true }).count(), 1);
    assert.equal(await page.getByText('Cora', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Export results' }).click();
    await page.getByRole('dialog').getByLabel('Ben', { exact: true }).uncheck();
    assert.equal(await page.getByRole('dialog').getByText('1 of 2 students selected').count(), 1);
    const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download CSV' }).click();
    const csv = await readFile(await (await downloadPromise).path(), 'utf8');
    assert.ok(csv.includes('"a","Ana"')); assert.ok(!csv.includes('"b","Ben"')); assert.ok(csv.includes('"matching","0","0"'));
    assert.ok(!csv.includes('Former pupil')); assert.ok(csv.includes('"Current","In progress","1","3","quiz, flashcards"'));
    assert.ok(csv.includes('"Required","Not started","quiz","",""'));
    assert.ok(csv.includes('"Optional","Complete","hangman","100",""'));
    await page.getByRole('dialog').getByLabel('Format').selectOption('pdf');
    assert.equal(await page.getByRole('dialog').getByLabel('Include update times').isVisible(), false);
    await page.getByRole('dialog').getByLabel('PDF page layout').selectOption('landscape');
    const pdfDownloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download PDF' }).click();
    const pdfBytes = await readFile(await (await pdfDownloadPromise).path(), 'latin1');
    assert.ok(pdfBytes.startsWith('%PDF-')); assert.ok(pdfBytes.includes('(Ana)')); assert.ok(!pdfBytes.includes('(Ben)'));
    assert.ok(!pdfBytes.includes('Former pupil')); assert.ok(pdfBytes.includes('(1/3)')); assert.ok(pdfBytes.includes('(quiz, flashcards)'));
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    // Report filters scope both visible rows and the export dialog without changing class totals.
    await page.getByRole('combobox', { name: /^Completion/ }).selectOption('Not started');
    assert.equal(await report.getByRole('heading', { name: 'Ana', exact: true }).count(), 0);
    assert.equal(await report.getByRole('heading', { name: 'Ben', exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Export results' }).click();
    assert.equal(await page.getByRole('dialog').getByLabel('Ben', { exact: true }).count(), 1);
    assert.equal(await page.getByRole('dialog').getByLabel('Ana', { exact: true }).count(), 0);
    const missingCsvPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download CSV' }).click();
    const missingCsv = await readFile(await (await missingCsvPromise).path(), 'utf8');
    assert.ok(missingCsv.includes('"b","Ben","Current","Not started","0","3"'));
    assert.ok(missingCsv.includes('"Required","Not started","matching","",""'));
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('combobox', { name: /^Completion/ }).selectOption('all');
    await page.getByRole('combobox', { name: /^Roster/ }).selectOption('historical');
    assert.equal(await report.getByRole('heading', { name: 'Former pupil', exact: true }).count(), 1);
    assert.equal(await report.getByText('Historical evidence. Excluded from current class totals.', { exact: true }).count(), 1);
    assert.equal(await report.getByRole('heading', { name: 'Ana', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Export results' }).click();
    const historicalCsvPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download CSV' }).click();
    const historicalCsv = await readFile(await (await historicalCsvPromise).path(), 'utf8');
    assert.ok(historicalCsv.includes('"former","Former pupil","Historical","In progress","1","3"'));
    assert.ok(!historicalCsv.includes('"a","Ana"'));
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('combobox', { name: /^Roster/ }).selectOption('active');
    await page.getByLabel('Find student', { exact: true }).fill('anA');
    assert.equal(await report.getByRole('heading', { name: 'Ana', exact: true }).count(), 1);
    assert.equal(await report.getByRole('heading', { name: 'Ben', exact: true }).count(), 0);
    // A missing historical requirement snapshot is unavailable, never zero required work or optional work.
    await page.evaluate(async () => { const s = window.assignmentSmoke; s.unknownRequirements = true;
        await s.workspace.show({ mode: 'review', classId: 'class-a', assignmentId: 'vocab-a' }); });
    await report.getByText('The published requirements are unavailable. Saved activity evidence is shown without a vocabulary completion total.', { exact: true }).waitFor();
    assert.equal(await report.getByText('Unavailable', { exact: true }).count(), 2);
    await report.locator('article').filter({ has: page.getByRole('heading', { name: 'Ana', exact: true }) }).locator(':scope > details > summary').click();
    assert.equal(await report.getByRole('heading', { name: 'Matching · Requirement unavailable', exact: true }).count(), 1);
    assert.equal(await report.getByRole('heading', { name: /Optional/ }).count(), 0);
    await page.getByRole('button', { name: 'Export results' }).click();
    const unknownCsvPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download CSV' }).click();
    const unknownCsv = await readFile(await (await unknownCsvPromise).path(), 'utf8');
    assert.ok(unknownCsv.includes('"a","Ana","Current","Unavailable","",""'));
    assert.ok(unknownCsv.includes('"Unavailable","Complete","matching","0","0"'));
    assert.ok(!unknownCsv.includes('"Optional"'));
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await page.evaluate(() => { window.assignmentSmoke.unknownRequirements = false; });
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
    assert.equal(await page.getByRole('button', { name: 'Withdraw assignment', exact: true }).count(), 1);
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
        const picker = document.querySelector('input[type="search"]');
        const filter = value => { picker.value = value === 'a' ? 'Ana' : 'Ben'; picker.dispatchEvent(new Event('input')); };
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
    // The populated report and open evidence editors remain usable at every supported width.
    await page.evaluate(async teacherHtml => {
        const s = window.assignmentSmoke; s.longName = true;
        const template = new DOMParser().parseFromString(teacherHtml, 'text/html');
        const container = document.createElement('div'); container.className = 'app-container';
        const header = template.querySelector('.teacher-app-header');
        header.querySelector('#teacher-tab-shell').classList.remove('hidden');
        header.querySelector('#teacher-school-name').textContent = 'Academia Internacional David';
        header.querySelector('#teacher-mobile-section-label').textContent = 'Review';
        for (const tab of header.querySelectorAll('[data-section]')) {
            const selected = tab.dataset.section === 'review';
            tab.classList.toggle('active', selected); tab.setAttribute('aria-selected', String(selected));
        }
        container.append(header, s.root); document.body.replaceChildren(container);
        document.body.className = 'teacher-site'; s.root.className = 'teacher-main classrooms';
        await s.workspace.show({ mode: 'review', classId: 'class-a', assignmentId: 'vocab-a' });
        const evidence = s.root.querySelector('.teacher-completion-row > details'); evidence.open = true;
        evidence.querySelector('details').open = true;
    }, teacherHtml);
    if (screenshots) await mkdir(screenshots, { recursive: true });
    for (const width of [320, 360, 390, 430, 768, 1024, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        const bounds = await page.evaluate(() => ({
            page: document.documentElement.scrollWidth, viewport: innerWidth,
            clipped: [...document.querySelectorAll('main input, main select, main textarea, main button, main summary')]
                .filter(element => element.getClientRects().length && !element.closest('details:not([open])'))
                .map(element => ({ name: element.getAttribute('name') || element.textContent, box: element.getBoundingClientRect() }))
                .filter(({ box }) => box.left < -1 || box.right > innerWidth + 1)
                .map(({ name }) => name),
            misplacedIdentities: [...document.querySelectorAll('.teacher-completion-row')].filter(row => {
                const summary = row.querySelector('.teacher-workspace-summary').getBoundingClientRect();
                const evidence = row.querySelector('details').getBoundingClientRect();
                return summary.top > evidence.top + 20;
            }).length
        }));
        assert.ok(bounds.page <= bounds.viewport + 1, `Completion report overflows at ${width}px: ${JSON.stringify(bounds)}`);
        assert.deepEqual(bounds.clipped, [], `Completion controls clip at ${width}px`);
        assert.equal(bounds.misplacedIdentities, 0, `Student identity loses top alignment at ${width}px`);
        assert.equal(await report.locator('summary').filter({ hasText: /^Assignment note$/ }).count(), 2);
        assert.equal(await report.getByRole('button', { name: 'Save teacher note', exact: true }).count(), 1);
        if (screenshots && [390, 1280].includes(width)) await page.screenshot({ path: `${screenshots}/completion-${width}.png`, fullPage: false });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
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
    console.log('Teacher assignments smoke passed: retry, modal cancellation, required completion checklists, optional/history/unknown evidence, filtered CSV/PDF parity, Spark review, saved drafts and stale account loads.');
} finally { await browser?.close(); server?.kill(); }
