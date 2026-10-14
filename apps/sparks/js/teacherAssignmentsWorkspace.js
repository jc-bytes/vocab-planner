import { classroomRepository } from './services/classroomRepository.js';
import { node, action, selectField, createAssignmentDialog } from './teacherAssignmentUi.js';
import { assignmentResultRows, assignmentStatus } from './teacherAssignmentResults.js';
import { createStudentFeedbackEditor } from './teacherStudentFeedbackEditor.js';
import { openAssignmentExport } from './teacherAssignmentExport.js';
import '../css/classrooms.css';
import '../css/teacher-assignments.css';
import '../css/teacher-student-feedback.css';

export function createTeacherAssignmentsWorkspace({ root, getUserId, repository = classroomRepository, onNavigate, onPublish, onWordHuntReview }) {
    let generation = 0, destroyed = false, controller, dialog;
    let context = { mode: 'assignments' }, statusFilter = 'all', studentFilter = '';
    const current = (id, owner) => !destroyed && id === generation && owner === getUserId();
    function navigate(next) { if (onNavigate) onNavigate(next); else show(next); }
    function closeDialog() { dialog?.close(); dialog = null; }
    async function show(next = {}) {
        if (destroyed) return;
        context = { mode: 'assignments', ...next }; closeDialog(); controller?.abort(); controller = new AbortController();
        const id = ++generation, owner = getUserId(), { mode, classId, assignmentId } = context;
        root.classList.add('classrooms'); root.replaceChildren(node('h2', mode === 'review' ? 'Review' : 'Assignments'));
        const status = node('p', 'Loading…'); status.setAttribute('role', 'status'); root.append(status);
        if (!owner) { status.textContent = 'Sign in to see your assignments.'; return; }
        try {
            const [classes, assignments] = await Promise.all([
                repository.listClasses({ signal: controller.signal }), repository.listAssignments(classId, { signal: controller.signal })
            ]);
            if (!current(id, owner)) return;
            const selectedClass = classes.find(c => c.id === classId);
            if (classId && !selectedClass) { status.textContent = 'This class is unavailable.'; return; }
            const classLabel = c => `${c.subject?.name || ''} · ${c.name} · ${c.school_year}${c.archived ? ' · Archived' : ''}`;
            if (assignmentId) {
                const assignment = assignments.find(a => a.id === assignmentId);
                if (!assignment) { status.textContent = 'This assignment is unavailable.'; return; }
                const ownClass = classes.find(c => c.id === assignment.class_id);
                if (!ownClass) { status.textContent = 'This class is unavailable.'; return; }
                const returnMode = context.returnMode === 'assignments' ? 'assignments' : 'review';
                root.append(action(returnMode === 'review' ? 'Back to review list' : 'Back to assignments', () => navigate({ mode: returnMode, classId })), node('h3', assignment.title), node('p', classLabel(ownClass)));
                const [roster, records, feedback] = await Promise.all([
                    repository.getRoster(ownClass.id, { signal: controller.signal }),
                    assignment.kind === 'spark' ? repository.listResponses(assignment.id, { signal: controller.signal }) : repository.getResults(assignment.id, { signal: controller.signal }),
                    repository.assignmentFeedback?.(assignment.id, { signal: controller.signal }) || Promise.resolve([])
                ]);
                if (!current(id, owner)) return;
                let rows = assignmentResultRows(assignment.kind, records, roster, feedback);
                const toolbar = node('div', undefined, 'teacher-workspace-toolbar');
                const people = [...new Map(rows.map(r => [r.studentId, r.name]))];
                const student = selectField(toolbar, 'Student', 'student', [['', 'All students'], ...people]);
                if (people.some(([studentId]) => studentId === studentFilter)) student.value = studentFilter; else studentFilter = '';
                const content = node('section');
                const editors = new Map();
                function renderRows() {
                    studentFilter = student.value;
                    const visible = studentFilter ? rows.filter(r => r.studentId === studentFilter) : rows;
                    content.replaceChildren();
                    if (!visible.length) { content.append(node('p', 'No students or results yet.')); return; }
                    if (assignment.kind === 'spark') {
                        for (const row of visible) {
                            const card = node('article', undefined, 'card'); const reviewLabel = node('p', row.status); reviewLabel.dataset.feedbackStudent = row.studentId; card.append(node('h4', row.name), reviewLabel);
                            if (row.response) card.append(node('p', row.response, 'teacher-assignment-response'));
                            if (row.automaticTotal !== '') card.append(node('p', `${row.score} of ${row.automaticTotal} automatic answers correct.`));
                            const reviewNeeded = node('p', row.needsTeacherReview ? 'Written answers need teacher review.' : ''); reviewNeeded.dataset.reviewNeededStudent = row.studentId; card.append(reviewNeeded);
                            if (row.updatedAt) card.append(node('p', new Date(row.updatedAt).toLocaleString()));
                            card.append(editor(row));
                            content.append(card);
                        }
                    } else {
                        const table = node('table', undefined, 'teacher-assignment-table'); table.append(node('caption', assignment.title));
                        const head = node('thead'), heading = node('tr');
                        for (const text of ['Student', 'Activity', 'Status', 'Score', 'Accuracy', 'Teacher note']) { const cell = node('th', text); cell.scope = 'col'; heading.append(cell); }
                        head.append(heading); table.append(head); const body = node('tbody');
                        for (const row of visible) { const tr = node('tr'); for (const value of [row.name, row.activity, row.status, row.score, row.accuracy]) tr.append(node('td', String(value))); const feedbackCell = node('td'); const general = feedback.find(f => f.student_id === row.studentId && f.activity_type === ''); if (row.activity && general?.note) feedbackCell.append(node('p', `Assignment note: ${general.note}`)); feedbackCell.append(editor(row)); tr.append(feedbackCell); body.append(tr); }
                        table.append(body); content.append(table);
                    }
                }
                function editor(row) {
                    const key = JSON.stringify([row.studentId, row.activity]);
                    if (editors.has(key)) return editors.get(key);
                    const result = createStudentFeedbackEditor({ repository, assignmentId: assignment.id, studentId: row.studentId,
                        activityType: assignment.kind === 'spark' ? '' : row.activity || '', kind: assignment.kind,
                        responseRevision: row.responseRevision, feedback: row.feedback,
                        isCurrent: () => current(id, owner), onSaved: record => {
                            const index = feedback.findIndex(f => f.student_id === record.student_id && f.activity_type === record.activity_type);
                            if (index < 0) feedback.push(record); else feedback[index] = record;
                            rows = assignmentResultRows(assignment.kind, records, roster, feedback);
                            const updated = rows.find(item => item.studentId === row.studentId && item.activity === row.activity);
                            for (const label of content.querySelectorAll('[data-feedback-student]')) if (label.dataset.feedbackStudent === row.studentId) label.textContent = updated.status;
                            for (const label of content.querySelectorAll('[data-review-needed-student]')) if (label.dataset.reviewNeededStudent === row.studentId) label.textContent = updated.needsTeacherReview ? 'Written answers need teacher review.' : '';

                        } });
                    editors.set(key, result);
                    return result;
                }
                student.addEventListener('change', renderRows);
                toolbar.append(action('Export results', () => {
                    if (!current(id, owner)) return; closeDialog();
                    dialog = openAssignmentExport({ rows: student.value ? rows.filter(r => r.studentId === student.value) : rows,
                        kind: assignment.kind, className: classLabel(ownClass), assignmentTitle: assignment.title,
                        isCurrent: () => current(id, owner), onClose: () => { dialog = null; } });
                }));
                if (assignment.kind === 'vocabulary' && onWordHuntReview) toolbar.append(action('Browse Word Hunt evidence', () => { if (current(id, owner)) onWordHuntReview(); }), node('p', 'Word Hunt opens evidence across your assignments. Review notes there are saved on this device.'));
                root.append(toolbar, content); renderRows();
            } else {
                const toolbar = node('div', undefined, 'teacher-workspace-toolbar');
                const filter = selectField(toolbar, 'Class', 'class', [['', 'All classes'], ...classes.map(c => [c.id, classLabel(c)])]); filter.value = classId || '';
                filter.addEventListener('change', () => navigate({ mode, classId: filter.value || undefined }));
                const states = selectField(toolbar, 'Status', 'status', [['all', 'All statuses'], ...['Available', 'Scheduled', 'Closed', 'Withdrawn'].map(s => [s, s])]); states.value = statusFilter;
                if (mode !== 'review' && onPublish && classes.some(c => c.canTeach === true && !c.archived && (!classId || c.id === classId))) toolbar.append(action('Assign material', () => { if (current(id, owner)) onPublish({ classId }); }, true));
                if (mode === 'review' && onWordHuntReview) toolbar.append(action('Browse Word Hunt evidence', () => { if (current(id, owner)) onWordHuntReview(); }), node('p', 'Browse Word Hunt evidence across your assignments.'));
                root.append(toolbar); const list = node('section', undefined, 'teacher-workspace-list'); root.append(list);
                function renderAssignments() {
                    statusFilter = states.value; list.replaceChildren();
                    const visible = assignments.filter(a => statusFilter === 'all' || assignmentStatus(a) === statusFilter);
                    if (!visible.length) list.append(node('p', assignments.length ? 'No assignments match this status.' : 'No assignments yet. Assign a saved material to a class to begin.'));
                    for (const assignment of visible) {
                        const ownClass = classes.find(c => c.id === assignment.class_id); if (!ownClass) continue;
                        const card = node('article', undefined, 'teacher-workspace-row');
                        const summary = node('div', undefined, 'teacher-workspace-summary');
                        const controls = node('div', undefined, 'teacher-workspace-actions');
                        card.append(summary, controls); summary.append(node('h3', assignment.title), node('p', classLabel(ownClass)), node('span', assignmentStatus(assignment), 'teacher-workspace-status'),
                            node('p', `Available ${new Date(assignment.release_at).toLocaleString()}`));
                        if (assignment.due_at) summary.append(node('p', `Due ${new Date(assignment.due_at).toLocaleString()}`));
                        if (assignment.close_at) summary.append(node('p', `Responses close ${new Date(assignment.close_at).toLocaleString()}`));
                        controls.append(action('Review work', () => navigate({ mode: 'review', classId: classId || undefined, assignmentId: assignment.id, returnMode: mode })));
                        if (mode !== 'review' && !assignment.withdrawn && ownClass.canTeach === true) controls.append(action('Withdraw assignment', () => {
                            if (!current(id, owner)) return; closeDialog();
                            const confirm = createAssignmentDialog('Withdraw assignment', () => { dialog = null; }); dialog = confirm;
                            confirm.body.append(node('p', `Withdraw “${assignment.title}” from ${ownClass.name}? Students will no longer be able to open it. Saved results remain available to you.`));
                            const feedback = node('p'); feedback.setAttribute('role', 'status'); confirm.body.append(feedback);
                            const save = action('Withdraw assignment', async () => {
                                if (!current(id, owner) || save.disabled) return; save.disabled = true; feedback.textContent = 'Withdrawing… Closing this dialog does not cancel the request.';
                                try { await repository.withdrawAssignment(assignment.id); if (current(id, owner) && confirm.dialog.isConnected) { confirm.close(); await show(context); } }
                                catch (error) { if (current(id, owner) && confirm.dialog.isConnected) feedback.textContent = error.message || 'Could not withdraw assignment.'; }
                                finally { save.disabled = false; }
                            }, true); confirm.footer.append(save);
                        }));
                        list.append(card);
                    }
                }
                states.addEventListener('change', renderAssignments); renderAssignments();
            }
            if (current(id, owner)) status.textContent = '';
        } catch (error) { if (current(id, owner)) status.textContent = error.message || 'Could not load assignments. Please try again.'; }
    }
    return { show, hide() { generation++; controller?.abort(); closeDialog(); }, destroy() { destroyed = true; generation++; controller?.abort(); closeDialog(); context = {}; studentFilter = ''; statusFilter = 'all'; root.replaceChildren(); } };
}
