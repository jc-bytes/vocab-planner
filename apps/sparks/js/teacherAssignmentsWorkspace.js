import { createLibraryRowList, createLibraryRow } from './learningLibraryView.js';
import { bindFloatingActionMenu } from './ui/floatingActionMenu.js';
import { assignmentListTab, loadAssignmentReviewQueue } from './teacherAssignmentReviewQueue.js';
import { schoolContext } from './services/schoolContext.js';
import { assignmentTrimester, assignmentTrimesterLabel, assignmentTrimesterOptions } from './assignmentTrimester.js';
import { classroomRepository } from './services/classroomRepository.js';
import { node, action, selectField, createAssignmentDialog } from './teacherAssignmentUi.js';
import { assignmentResultRows, assignmentStatus } from './teacherAssignmentResults.js';
import { createStudentFeedbackEditor } from './teacherStudentFeedbackEditor.js';
import { openAssignmentExport } from './teacherAssignmentExport.js';
import '../css/teacher-assignments.css';
import '../css/classrooms.css';
import '../css/compact-workspace-table.css';
import { createClassWorkspaceLoading } from './classWorkspaceLoading.js';
import { compactFilter, sortAssignments, assignmentDate, assignmentWhen, assignmentSortOptions, assignmentTypeOptions } from './compactAssignmentControls.js';
import '../css/teacher-student-feedback.css';

export function createTeacherAssignmentsWorkspace({ root, getUserId, repository = classroomRepository, onNavigate, onPublish, onWordHuntReview, getSchoolCalendar = async () => null }) {
    let generation = 0, destroyed = false, controller, dialog;
    let context = { mode: 'assignments' }, studentFilter = '', stateOwner, restoreTabFocus = false;
    const defaults = () => ({ search: '', trimester: 'all', type: 'all', sort: 'release-desc', offset: 0, listTab: 'current' });
    let listState = defaults();
    const current = (id, owner) => !destroyed && id === generation && owner === getUserId();
    function navigate(next) { if (onNavigate) onNavigate(next); else show(next); }
    function closeDialog() { dialog?.close(); dialog = null; }
    async function show(next = {}) {
        if (destroyed) return;
        context = { mode: 'assignments', ...next }; closeDialog(); controller?.abort(); controller = new AbortController();
        const id = ++generation, owner = getUserId(), { mode, classId, assignmentId } = context;
        const focusAfterShow = restoreTabFocus; restoreTabFocus = false;
        if (stateOwner !== owner) { listState = defaults(); studentFilter = ''; stateOwner = owner; }
        const validListTabs = ['current', 'needs-review', 'scheduled', 'history'];
        const listTab = validListTabs.includes(context.listTab) ? context.listTab
            : !assignmentId && validListTabs.includes(context.tab) ? context.tab
            : mode === 'review' && !assignmentId ? 'needs-review' : listState.listTab;
        listState.listTab = listTab;
        root.classList.add('classrooms', 'assignment-workspace', 'teacher-student-library');
        root.replaceChildren(node('h2', 'Assignments', 'teacher-library-accessible-title'));
        function tabs(items, selected, onSelect, label) {
            const bar = node('div', undefined, 'data-tab-list activity-workflow-tabs secondary-tabs');
            bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', label);
            for (const [key, text] of items) {
                const control = action(text, () => { restoreTabFocus = true; onSelect(key); });
                control.className = `data-tab-btn activity-workflow-tab secondary-tab${key === selected ? ' active secondary-tab--active' : ''}`;
                control.id = `assignment-tab-${key}`; control.setAttribute('role', 'tab');
                control.setAttribute('aria-selected', String(key === selected));
                control.setAttribute('aria-controls', 'assignment-panel'); control.tabIndex = key === selected ? 0 : -1;
                bar.append(control);
            }
            bar.addEventListener('keydown', event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault(); const controls = [...bar.children], index = controls.indexOf(event.target);
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1
                    : (index + (event.key === 'ArrowRight' ? 1 : controls.length - 1)) % controls.length;
                controls[next].focus();
            });
            root.append(bar);
        }
        const status = node('p', '', 'inline-status'); status.setAttribute('role', 'status'); root.append(status);
        const loading = createClassWorkspaceLoading({ section: assignmentId ? 'results' : mode });
        root.setAttribute('aria-busy', String(Boolean(owner)));
        if (owner) root.append(loading);
        if (!owner) { status.textContent = 'Sign in to see your assignments.'; return; }
        try {
            const [classes, assignments, calendar] = await Promise.all([
                repository.listClasses({ signal: controller.signal }), repository.listAssignments(classId, { signal: controller.signal }), getSchoolCalendar({ signal: controller.signal })
            ]);
            if (!current(id, owner)) return;
            const selectedClass = classes.find(c => c.id === classId);
            if (classId && !selectedClass) { status.textContent = 'This class is unavailable.'; return; }
            const classLabel = c => `${c.subject?.name || ''} · ${c.name} · ${c.school_year}${c.archived ? ' · Archived' : ''}`;
            function openDetails(assignment, ownClass) {
                if (!current(id, owner)) return;
                const details = { body: node('section'), footer: node('div', undefined, 'assignment-detail-actions') };
                const metadata = node('dl', undefined, 'assignment-details-metadata');
                const term = assignmentTrimester(assignment, calendar, ownClass.school_year, schoolContext.getSchool()?.timezone || 'UTC');
                for (const [label, value] of [['Class',classLabel(ownClass)],['Trimester',assignmentTrimesterLabel(term)],['Type',assignment.kind === 'spark' ? 'Spark' : 'Vocabulary'],['Available',assignmentDate(assignment.release_at)],['Due',assignmentDate(assignment.due_at)],['Responses close',assignmentDate(assignment.close_at)],['Status',assignmentStatus(assignment)]]) {
                    metadata.append(node('dt',label),node('dd',value));
                }
                details.body.append(metadata, node('p', 'This assignment uses the saved material published to this class. Editing Library does not change this copy.'));

                if (!assignment.withdrawn && ownClass.canTeach === true) details.footer.append(action('Withdraw assignment', () => {
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
                return [details.body, details.footer];
            }
            if (assignmentId) {
                const assignment = assignments.find(a => a.id === assignmentId);
                if (!assignment) { status.textContent = 'This assignment is unavailable.'; return; }
                const ownClass = classes.find(c => c.id === assignment.class_id);
                if (!ownClass) { status.textContent = 'This class is unavailable.'; return; }
                root.append(action('Back to assignments', () => navigate({ mode: 'assignments', classId, tab: listTab })), node('h3', assignment.title), node('p', classLabel(ownClass)));
                const detailTab = context.tab === 'details' ? 'details' : 'student-work';
                tabs([['student-work', 'Student work'], ['details', 'Details']], detailTab, tab => navigate({ mode: 'assignments', classId, assignmentId, tab, listTab }), 'Assignment sections');
                const panel = node('section'); panel.id = 'assignment-panel'; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', `assignment-tab-${detailTab}`); root.append(panel);
                if (detailTab === 'details') {
                    panel.append(...openDetails(assignment, ownClass));
                } else {
                    const [roster, records, feedback] = await Promise.all([
                        repository.getRoster(ownClass.id, { signal: controller.signal }),
                        assignment.kind === 'spark' ? repository.listResponses(assignment.id, { signal: controller.signal }) : repository.getResults(assignment.id, { signal: controller.signal }),
                        repository.assignmentFeedback?.(assignment.id, { signal: controller.signal }) || Promise.resolve([])
                    ]);
                    if (!current(id, owner)) return;
                    let rows = assignmentResultRows(assignment.kind, records, roster, feedback);
                    const toolbar = node('div', undefined, 'teacher-library-control-row');
                    const reviewFilter = assignment.kind === 'spark' ? selectField(toolbar, 'Show work', 'reviewFilter', [['all', 'All work'], ['needs-review', 'Needs review']]) : null;
                    reviewFilter?.setAttribute('aria-label', 'Show work');
                    if (reviewFilter && listTab === 'needs-review') reviewFilter.value = 'needs-review';
                    const people = [...new Map(rows.map(r => [r.studentId, r.name]))];
                    const student = selectField(toolbar, 'Student', 'student', [['', 'All students'], ...people]);
                    if (people.some(([studentId]) => studentId === studentFilter)) student.value = studentFilter; else studentFilter = '';
                    const content = node('section');
                    const editors = new Map();
                    function renderRows() {
                        studentFilter = student.value;
                        const visible = rows.filter(r => (!studentFilter || r.studentId === studentFilter) && (reviewFilter?.value !== 'needs-review' || r.needsTeacherReview));
                        content.replaceChildren();
                        if (!visible.length) { content.append(node('p', reviewFilter?.value === 'needs-review' ? 'No submissions need review.' : 'No students or results yet.')); return; }
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
                                if (reviewFilter?.value === 'needs-review') { renderRows(); return; }
                                for (const label of content.querySelectorAll('[data-feedback-student]')) if (label.dataset.feedbackStudent === row.studentId) label.textContent = updated.status;
                                for (const label of content.querySelectorAll('[data-review-needed-student]')) if (label.dataset.reviewNeededStudent === row.studentId) label.textContent = updated.needsTeacherReview ? 'Written answers need teacher review.' : '';

                            } });
                        editors.set(key, result);
                        return result;
                    }
                    student.addEventListener('change', renderRows);
                    reviewFilter?.addEventListener('change', renderRows);
                    toolbar.append(action('Export results', () => {
                        if (!current(id, owner)) return; closeDialog();
                        dialog = openAssignmentExport({ rows: student.value ? rows.filter(r => r.studentId === student.value) : rows,
                            kind: assignment.kind, className: classLabel(ownClass), assignmentTitle: assignment.title,
                            isCurrent: () => current(id, owner), onClose: () => { dialog = null; } });
                    }));
                    if (assignment.kind === 'vocabulary' && onWordHuntReview) toolbar.append(action('Browse Word Hunt evidence', () => { if (current(id, owner)) onWordHuntReview(); }), node('p', 'Word Hunt opens evidence for the selected class. Review notes there are saved on this device.'));
                    panel.append(toolbar, content); renderRows();
                }
            } else {
                tabs([['current', 'Current'], ['needs-review', 'Needs review'], ['scheduled', 'Scheduled'], ['history', 'History']], listTab,
                    tab => { listState.offset = 0; navigate({ mode: 'assignments', classId, tab }); }, 'Assignment views');
                const directory = node('section'); directory.id = 'assignment-panel'; directory.setAttribute('role', 'tabpanel');
                directory.setAttribute('aria-labelledby', `assignment-tab-${listTab}`);
                const toolbar = node('div', undefined, 'teacher-library-control-row');
                const filters = node('div', undefined, 'teacher-library-filters');
                if (selectedClass) filters.append(node('span', selectedClass.name, 'assignment-class-label'));
                else {
                    const filter = compactFilter(filters, 'Class', [['', 'All classes'], ...classes.map(c => [c.id, classLabel(c)])]); filter.value = classId || ''; filter.name = 'class';
                    filter.addEventListener('change', () => { listState.offset = 0; navigate({ mode: 'assignments', classId: filter.value || undefined, tab: listTab }); });
                }
                const filterButton = action('Filters');
                const filterPanel = node('div', undefined, 'teacher-library-filter-panel');
                filterPanel.id = 'assignment-filter-panel'; filterPanel.popover = 'auto';
                filterButton.popoverTargetElement = filterPanel;
                filterButton.setAttribute('aria-label', 'Filter assignments');
                filterPanel.append(node('h3', 'Filter assignments'));
                const fields = node('div', undefined, 'teacher-library-filter-fields'); filterPanel.append(fields);
                filterPanel.append(action('Done', () => filterPanel.hidePopover()));
                filterPanel.addEventListener('beforetoggle', event => {
                    if (event.newState !== 'open') return;
                    const rect = filterButton.getBoundingClientRect();
                    filterPanel.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - 352))}px`;
                    filterPanel.style.top = `${Math.max(12, Math.min(rect.bottom + 6, innerHeight - 420))}px`;
                });
                filters.append(filterButton, filterPanel);
                const trimester = compactFilter(fields, 'Trimester', assignmentTrimesterOptions); trimester.value = listState.trimester;
                const types = compactFilter(fields, 'Type', assignmentTypeOptions); types.value = listState.type;
                const sort = compactFilter(fields, 'Sort', assignmentSortOptions); sort.value = listState.sort;
                const searchLabel = node('label', undefined, 'teacher-library-search');
                const search = node('input'); search.type = 'search'; search.placeholder = 'Search assignments'; search.setAttribute('aria-label', 'Search assignments'); search.value = listState.search;
                searchLabel.append(search); filters.append(searchLabel); toolbar.append(filters);
                const actions = node('div', undefined, 'teacher-library-authoring-tools');
                if (onPublish && classes.some(c => c.canTeach === true && !c.archived && (!classId || c.id === classId))) actions.append(action('Assign material', () => { if (current(id, owner)) onPublish({ classId }); }, true));
                toolbar.append(actions); directory.append(toolbar);
                let reviewCounts = new Map();
                if (listTab === 'needs-review') {
                    directory.append(node('p', 'Spark submissions awaiting teacher review. Vocabulary image evidence is available in Word Hunt.'));
                    if (onWordHuntReview) directory.append(action('Browse Word Hunt evidence', () => { if (current(id, owner)) onWordHuntReview(); }));
                    root.append(directory);
                    reviewCounts = await loadAssignmentReviewQueue(repository, assignments.filter(a => classes.some(c => c.id === a.class_id)
                        && !a.withdrawn && assignmentStatus(a) !== 'Scheduled'), { signal: controller.signal });
                    if (!current(id, owner)) return;
                }
                const list = createLibraryRowList(['Assignment', 'Class', 'Type', listTab === 'needs-review' ? 'Needs review' : 'When']);
                list.classList.add('assignment-library-rows'); directory.append(list);
                const footer = node('div', undefined, 'class-directory-footer'), paging = node('div'), count = node('span'); count.className = 'teacher-library-result-count'; count.setAttribute('role', 'status');
                const previous = action('Previous', () => { listState.offset -= 10; renderAssignments(); }); previous.setAttribute('aria-label', 'Previous assignments page');
                const next = action('Next', () => { listState.offset += 10; renderAssignments(); }); next.setAttribute('aria-label', 'Next assignments page');
                paging.append(previous,next); footer.append(paging,count); directory.append(footer); root.append(directory);
                function renderAssignments() {
                    const activeFilters = [trimester, types].filter(control => control.value !== 'all').length;
                    filterButton.textContent = activeFilters ? `Filters (${activeFilters})` : 'Filters';
                    listState.search = search.value; listState.trimester = trimester.value; listState.type = types.value; listState.sort = sort.value;
                    for (const child of [...list.children].slice(1)) child.remove();
                    const query = search.value.trim().toLocaleLowerCase();
                    const matches = assignments.filter(a => {
                        const ownClass = classes.find(c => c.id === a.class_id);
                        return ownClass && (listTab === 'needs-review' ? reviewCounts.has(a.id) : assignmentListTab(a, ownClass) === listTab)
                            && (trimester.value === 'all' || assignmentTrimester(a, calendar, ownClass.school_year, schoolContext.getSchool()?.timezone || 'UTC') === trimester.value)
                            && (types.value === 'all' || a.kind === types.value)
                            && `${a.title} ${classLabel(ownClass)}`.toLocaleLowerCase().includes(query);
                    });
                    const visible = sortAssignments(matches, sort.value);
                    listState.offset = Math.min(listState.offset, Math.max(0, Math.floor((visible.length - 1) / 10) * 10));
                    if (!visible.length) list.append(node('p', listTab === 'needs-review' ? 'No submissions need review with these filters.' : 'No assignments match this view.'));
                    for (const assignment of visible.slice(listState.offset, listState.offset + 10)) {
                        const ownClass = classes.find(c => c.id === assignment.class_id);
                        const open = tab => navigate({ mode: 'assignments', classId, assignmentId: assignment.id, tab, listTab });
                        const wrapper = node('article', undefined, 'assignment-library-item');
                        const row = createLibraryRow({ primary: assignment.title, cells: [ownClass.name, assignment.kind === 'spark' ? 'Spark' : 'Vocabulary',
                            listTab === 'needs-review' ? `${reviewCounts.get(assignment.id)} awaiting review` : assignmentWhen(assignment, assignmentStatus(assignment))] });
                        row.setAttribute('aria-label', `Open ${assignment.title} · ${ownClass.name}`); row.children[1].title = classLabel(ownClass);
                        row.children[2].id = `assignment-type-${assignment.id}`;
                        row.children[3].id = `assignment-when-${assignment.id}`;
                        row.setAttribute('aria-describedby', `${row.children[2].id} ${row.children[3].id}`);
                        row.lastElementChild.setAttribute('aria-hidden', 'true'); row.addEventListener('click', () => open('student-work'));
                        const trigger = action(''); trigger.setAttribute('aria-label', `More actions for ${assignment.title} · ${ownClass.name}`);
                        const menu = node('div'); menu.setAttribute('aria-label', `Actions for ${assignment.title}`);
                        menu.append(action('Student work', () => open('student-work')), action('Assignment details', () => open('details')));
                        bindFloatingActionMenu({ trigger, menu }); wrapper.append(row, trigger, menu); list.append(wrapper);
                    }
                    previous.disabled = listState.offset === 0; next.disabled = listState.offset + 10 >= visible.length;
                    count.textContent = `Assignments ${visible.length ? listState.offset+1 : 0}–${Math.min(listState.offset+10,visible.length)} of ${visible.length}`;
                }
                for (const control of [trimester,types,sort,search]) control.addEventListener(control === search ? 'input' : 'change', () => { listState.offset = 0; renderAssignments(); });
                renderAssignments();
            }
            if (current(id, owner)) status.textContent = '';
        } catch (error) {
            if (!current(id, owner)) return;
            status.textContent = '';
            const { showSectionLoadError } = await import('./ui/sectionRecovery.js');
            showSectionLoadError(root, { label: 'assignments', error, current: () => current(id, owner),
                keepContent: true, hasPreviousContent: false, retry: () => show({ ...context }) });
        }
        finally {
            if (current(id, owner)) {
                loading.remove(); root.setAttribute('aria-busy', 'false');
                if (focusAfterShow) root.querySelector('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
            }
        }
    }
    return { show, hide() { generation++; controller?.abort(); closeDialog(); root.replaceChildren(); root.removeAttribute('aria-busy'); }, destroy() { destroyed = true; generation++; controller?.abort(); closeDialog(); context = {}; studentFilter = ''; listState = defaults(); stateOwner = null; root.replaceChildren(); } };
}
