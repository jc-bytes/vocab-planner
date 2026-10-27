import { bindFloatingActionMenu } from './ui/floatingActionMenu.js';
import { schoolContext } from './services/schoolContext.js';
import { schoolRepository } from './services/schoolRepository.js';
import { classroomRepository } from './services/classroomRepository.js';
import { openClassWorkspaceDialog } from './teacherClassWorkspaceDialog.js';
import { createClassWorkspaceLoading } from './classWorkspaceLoading.js';
import '../css/classrooms.css';
import '../css/compact-workspace-table.css';
import { compactFilter, sortAssignments, assignmentDate, assignmentWhen, assignmentSortOptions, assignmentStatusOptions, assignmentTypeOptions } from './compactAssignmentControls.js';
import { assignmentTrimester, assignmentTrimesterLabel, assignmentTrimesterOptions } from './assignmentTrimester.js';
import { assignmentStatus } from './teacherAssignmentResults.js';
import '../css/teacher-class-workspace.css';

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

// Navigation and publication are injected so this workspace can move without
// bringing another screen's data, drafts or lifecycle along with it.
export function createTeacherClassWorkspace({ root, getUserId, repository = classroomRepository, schoolRepository: schoolData = schoolRepository,
    onNavigate, onPublish, onReview, onGroups, onStudent, onClassesLoaded, headerRoot = null, getSchoolCalendar = async () => null }) {
    let generation = 0, destroyed = false, controller, closeDialog;
    let route = { classId: null, tab: 'students' };
    let externalHeader = null, cachedClasses = null, cachedOwner = null;
    function clearHeader() {
        if (!externalHeader) return;
        externalHeader.remove(); externalHeader = null;
        headerRoot?.classList.remove('has-class-context');
        const label = headerRoot?.querySelector('#teacher-top-bar-section');
        if (label) label.hidden = false;
    }
    const status = element('p', '', 'inline-status');
    status.setAttribute('role', 'status');
    const current = (id, owner) => !destroyed && generation === id && owner === getUserId();
    function button(label, action, primary = false) {
        const node = element('button', label, `btn ${primary ? 'primary-btn' : 'secondary-btn'}`);
        node.type = 'button';
        const id = generation, owner = getUserId();
        node.addEventListener('click', () => {
            if (!current(id, owner) || !owner || node.disabled) return;
            Promise.resolve().then(() => { if (current(id, owner)) return action(); }).catch(error => { if (current(id, owner)) status.textContent = error.message || 'Could not complete this action.'; });
        });
        return node;
    }
    function navigate(next) { return onNavigate ? onNavigate(next) : show(next); }
    async function mutate(control, action) {
        const id = generation, owner = getUserId();
        if (!owner || !current(id, owner)) return;
        control.disabled = true;
        try { await action(); if (current(id, owner)) await show({ ...route, refresh: true }); }
        catch (error) { if (current(id, owner)) status.textContent = error.message || 'Could not save. Please try again.'; }
        finally { if (current(id, owner)) control.disabled = false; }
    }
    function dialog(title, fields, save, help) {
        closeDialog?.();
        const id = generation, owner = getUserId();
        closeDialog = openClassWorkspaceDialog({ root, title, fields, help,
            isCurrent: () => current(id, owner),
            save, onSaved: () => { if (current(id, owner)) return show({ ...route, refresh: true }); }
        });
    }
    function setupActions(subjects, years) {
        const actions = element('div', undefined, 'class-workspace-actions');
        actions.append(button('Add subject', () => dialog('Add subject', [
            { name: 'name', label: 'Subject name', maxLength: 100 }
        ], data => repository.createSubject(data.get('name')))));
        const available = subjects.filter(subject => !subject.archived);
        const availableYears = years.filter(year => !year.archived);
        const create = button('Create class', () => dialog('Create class', [
            { name: 'name', label: 'Class name', maxLength: 100 },
            { name: 'subject', label: 'Subject', options: available.map(subject => ({ value: subject.id, label: subject.name })) },
            { name: 'year', label: 'School year', options: availableYears.map(year => ({ value: String(year.year), label: year.label })) }
        ], data => repository.createClass({ name: data.get('name'), subjectId: data.get('subject'), schoolYear: data.get('year') })), true);
        create.disabled = !available.length || !availableYears.length;
        actions.append(create);
        if (!available.length) actions.append(element('p', 'Add a subject before creating a class.'));
        if (!availableYears.length) actions.append(element('p', 'Ask a school administrator to add or reopen an academic year.'));
        return actions;
    }
    function renderDirectory(classes, subjects, years) {
        const directory = element('section', undefined, 'class-directory');
        directory.setAttribute('aria-label', 'Class directory');
        const toolbar = element('div', undefined, 'class-directory-toolbar');
        const filters = element('div', undefined, 'class-directory-filters');
        const search = element('input');
        search.type = 'search'; search.placeholder = 'Search classes';
        search.setAttribute('aria-label', 'Search classes');
        filters.append(search);
        function select(label, values) {
            return compactFilter(filters, {Subjects:'Subject',Years:'Year',Statuses:'Status'}[label] || label,
                [['', `All ${label.toLowerCase()}`], ...values], label);
        }
        const subject = select('Subjects', [...new Set(classes.map(c => c.subject?.name).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b)).map(name => [name, name]));
        const year = select('Years', [...new Set(classes.map(c => String(c.school_year)))].sort().reverse().map(value => [value, value]));
        const state = select('Statuses', [['active', 'Active'], ['archived', 'Archived']]);
        state.value = 'active';
        toolbar.append(filters, setupActions(subjects, years));
        const cards = element('div', undefined, 'teacher-class-cards');
        cards.setAttribute('aria-label', 'My classes');
        const footer = element('div', undefined, 'class-directory-footer');
        const paging = element('div');
        let offset = 0;
        const previous = button('Previous', () => { offset -= 12; render(); });
        previous.setAttribute('aria-label', 'Previous classes page');
        const next = button('Next', () => { offset += 12; render(); });
        next.setAttribute('aria-label', 'Next classes page');
        const count = element('span'); count.setAttribute('role', 'status');
        paging.append(previous, next); footer.append(paging, count);
        function render() {
            const query = search.value.trim().toLocaleLowerCase();
            const filtered = classes.filter(c => (!query || `${c.name} ${c.subject?.name || ''}`.toLocaleLowerCase().includes(query))
                && (!subject.value || c.subject?.name === subject.value)
                && (!year.value || String(c.school_year) === year.value)
                && (!state.value || (c.archived ? 'archived' : 'active') === state.value));
            cards.replaceChildren();
            for (const c of filtered.slice(offset, offset + 12)) {
                const card = element('article', undefined, 'teacher-class-card');
                const title = element('h3', c.name);
                const details = element('p', `${c.subject?.name || 'Subject'} · ${c.school_year}${c.archived ? ' · Archived' : ''}`);
                const open = button('Open class', () => navigate({ classId: c.id, tab: 'work' }));
                open.setAttribute('aria-label', `Open class ${c.name}`);
                card.append(title, details, open); cards.append(card);
            }
            if (!filtered.length) cards.append(element('p', classes.length ? 'No classes match these filters.' : 'Create your first class to begin.', 'teacher-empty-state'));
            previous.disabled = offset === 0; next.disabled = offset + 12 >= filtered.length;
            count.textContent = `Classes ${filtered.length ? offset + 1 : 0}–${Math.min(offset + 12, filtered.length)} of ${filtered.length}`;
        }
        for (const control of [search, subject, year, state]) control.addEventListener(control === search ? 'input' : 'change', () => { offset = 0; render(); });
        directory.append(toolbar, cards, footer); root.append(directory); render();
    }
    function renderClassHeader(active, id, owner, signal) {
        const header = element('header', undefined, 'class-detail-header');
        const back = button('←', () => navigate({ classId: null, tab: 'students' }));
        back.className = 'class-back-link'; back.setAttribute('aria-label', 'Back to all classes'); back.title = 'All classes';
        const title = element('div', undefined, 'class-detail-title');
        title.append(element('h3', active.name), element('span', `${active.subject?.name || 'Subject'} · ${active.school_year}${active.archived ? ' · Archived' : ''}`));
        const teachers = element('span', '', 'class-detail-teachers');
        title.append(teachers); header.append(back);
        if (headerRoot) {
            const context = element('span', undefined, 'class-top-bar-context');
            context.append(element('span', active.name), element('span', String(active.school_year)));
            headerRoot.classList.add('has-class-context'); headerRoot.append(context); externalHeader = context;
        } else header.append(title);
        root.append(header);
        if (!schoolContext.hasRole('school_admin')) return;
        return async function renderSettings() {
            const [members, assigned] = await Promise.all([
                schoolData.listMembers(active.school_id, { signal }), repository.listClassTeachers(active.id, { signal })
            ]);
            if (!current(id, owner)) return;
            const teacherMembers = members.filter(member => member.active && member.roles.includes('teacher'));
            const popup = element('section', undefined, 'class-settings-panel');
            popup.setAttribute('aria-label', 'Class settings');
            const message = element('p'); message.setAttribute('role', 'status');
            const list = element('div', undefined, 'class-settings-teachers');
            let pending = false;
            for (const member of teacherMembers) {
                const present = assigned.some(teacher => teacher.user_id === member.user_id && teacher.active);
                const row = element('div', undefined, 'class-settings-teacher');
                row.append(element('span', member.display_name || member.email || 'Teacher'));
                const control = button(present ? 'Remove teacher' : 'Assign teacher', async () => {
                    if (pending || !current(id, owner)) return;
                    pending = true; list.querySelectorAll('button').forEach(button => { button.disabled = true; });
                    message.textContent = 'Saving…';
                    try {
                        await repository.setClassTeacher(active.id, member.user_id, !present);
                        if (current(id, owner)) await show({ ...route, refresh: true });
                    } catch (error) { if (current(id, owner)) message.textContent = error.message || 'Could not save teacher assignment.'; }
                    finally { pending = false; list.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
                });
                control.setAttribute('aria-label', `${present ? 'Remove teacher' : 'Assign teacher'} ${member.display_name || member.email || 'Teacher'}`);
                row.append(control); list.append(row);
            }
            if (!teacherMembers.length) list.append(element('p', 'No active teachers in this school.'));
            const archive = button(active.archived ? 'Reopen class' : 'Archive class', () => {
                if (pending) return;
                dialog(active.archived ? 'Reopen class' : 'Archive class', [],
                    () => repository.setClassArchived(active.id, !active.archived),
                    active.archived ? 'New invitations and student submissions will be available again.' : 'New invitations and student submissions will stop. Saved work remains available for review.');
            });
            popup.append(element('h3', 'Teachers'), list, message, archive);
            root.append(popup);
        }
    }
    async function renderStudents(active, id, owner, signal) {
        const [roster, invitations] = await Promise.all([
            repository.getRoster(active.id, { signal }), repository.listInvitations(active.id, { signal })
        ]);
        if (!current(id, owner)) return;
        const block = element('section', undefined, 'class-directory class-student-directory'); block.setAttribute('aria-label', 'Class students');
        const toolbar = element('div', undefined, 'class-directory-toolbar');
        const filters = element('div', undefined, 'class-directory-filters');
        const search = element('input'); search.type = 'search'; search.placeholder = 'Search students'; search.setAttribute('aria-label', 'Search students'); filters.append(search);
        const actions = element('div', undefined, 'class-workspace-actions');
        if (!active.archived) actions.append(button('Invite students', () => dialog('Invite students', [
            { name: 'emails', label: 'Student emails', type: 'textarea', maxLength: 76500 }
        ], data => repository.inviteStudents(active.id, [...new Set(String(data.get('emails')).toLowerCase().split(/[\s,;]+/).filter(Boolean))]),
        'Enter one email or paste an email column from a spreadsheet. Invitations appear when students sign in with those emails.'), true));
        if (onGroups && !active.archived) actions.append(button('Make groups', () => onGroups({ classId: active.id })));
        toolbar.append(filters, actions);
        const scroll = element('div', undefined, 'class-directory-scroll'); scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Students table');
        const table = element('table'); table.setAttribute('aria-label', 'Class students');
        const head = element('thead'), headings = element('tr');
        for (const label of ['Name', 'Email', 'Actions']) { const cell = element('th', label); cell.scope = 'col'; headings.append(cell); }
        head.append(headings); const body = element('tbody'); table.append(head, body); scroll.append(table);
        const footer = element('div', undefined, 'class-directory-footer'), paging = element('div'), count = element('span'); count.setAttribute('role', 'status');
        let offset = 0;
        const previous = button('Previous', () => { offset -= 10; render(); }); previous.setAttribute('aria-label', 'Previous students page');
        const next = button('Next', () => { offset += 10; render(); }); next.setAttribute('aria-label', 'Next students page');
        paging.append(previous, next); footer.append(paging, count);
        function render() {
            const query = search.value.trim().toLocaleLowerCase();
            const filtered = roster.filter(student => `${student.name} ${student.email}`.toLocaleLowerCase().includes(query));
            body.replaceChildren();
            for (const student of filtered.slice(offset, offset + 10)) {
                const row = element('tr'), name = element('th', student.name); name.scope = 'row';
                const actions = element('td');
                if (onStudent || !active.archived) {
                    const menu = element('div', undefined, 'class-student-menu');
                    menu.popover = 'auto'; menu.id = `class-student-menu-${student.studentId}`;
                    menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', `Actions for ${student.name}`);
                    const closeMenu = () => { if (menu.matches(':popover-open')) menu.hidePopover(); };
                    const trigger = element('button');
                    trigger.setAttribute('aria-label', `Actions for ${student.name}`);
                    if (onStudent) for (const [label, tab] of [['View profile', 'overview'], ['Assigned work', 'assigned'], ['Activity history', 'activity'], ['Account and coins', 'account']]) {
                        menu.append(button(label, () => {
                            closeMenu();
                            return onStudent({ classId: active.id, studentId: student.studentId, tab });
                        }));
                    }
                    if (!active.archived) {
                        const remove = button('Remove from class', () => {
                            closeMenu();
                            dialog('Remove student', [], () => repository.removeStudent(active.id, student.studentId),
                                `Remove ${student.name} from ${active.name}? They will lose access to this class. Saved work remains in its history.`);
                        });
                        menu.append(remove);
                    }
                    for (const item of menu.querySelectorAll('button')) item.setAttribute('role', 'menuitem');
                    bindFloatingActionMenu({trigger, menu});
                    actions.append(trigger, menu);
                } else actions.textContent = '—';
                row.append(name, element('td', student.email), actions); body.append(row);
            }
            if (!filtered.length) {
                const row = element('tr'), cell = element('td', roster.length ? 'No students match your search.' : 'No students have joined yet.'); cell.colSpan = 3; row.append(cell); body.append(row);
            }
            previous.disabled = offset === 0; next.disabled = offset + 10 >= filtered.length;
            count.textContent = `Students ${filtered.length ? offset + 1 : 0}–${Math.min(offset + 10, filtered.length)} of ${filtered.length}`;
        }
        search.addEventListener('input', () => { offset = 0; render(); });
        block.append(toolbar, scroll, footer); render();
        const pending = invitations.filter(invite => !invite.acceptedAt && !invite.revokedAt);
        if (pending.length) {
            const details = element('details', undefined, 'class-pending-invitations'); details.append(element('summary', `Invitations (${pending.length})`));
            for (const invite of pending) {
                const row = element('p', `${invite.email} · ${new Date(invite.expiresAt) <= new Date() ? 'Expired' : 'Invited'} `);
                if (!active.archived) {
                    const cancel = button('Cancel invitation', () => mutate(cancel, () => repository.revokeInvitation(invite.id)));
                    row.append(cancel);
                }
                details.append(row);
            }
            block.append(details);
        }
        root.append(block);
    }
    async function renderWork(active, id, owner, signal) {
        const [assignments, calendar] = await Promise.all([repository.listAssignments(active.id, { signal }), getSchoolCalendar({ signal })]);
        const trimesterOf = assignment => assignmentTrimester(assignment, calendar, active.school_year, schoolContext.getSchool()?.timezone || 'UTC');
        if (!current(id, owner)) return;
        const block = element('section', undefined, 'class-directory class-work-directory'); block.setAttribute('aria-label', 'Class work');
        const toolbar = element('div', undefined, 'class-directory-toolbar'), filters = element('div', undefined, 'class-directory-filters');
        const search = element('input'); search.type = 'search'; search.placeholder = 'Search work'; search.setAttribute('aria-label', 'Search work'); filters.append(search); toolbar.append(filters);
        const trimester = compactFilter(filters, 'Trimester', assignmentTrimesterOptions);
        trimester.title = 'Based on availability date and the school academic calendar';
        const states = compactFilter(filters, 'Status', assignmentStatusOptions);
        const types = compactFilter(filters, 'Type', assignmentTypeOptions);
        const sort = compactFilter(filters, 'Sort', assignmentSortOptions);
        if (!active.archived && active.canTeach === true && onPublish) toolbar.append(button('Assign material', () => onPublish({ classId: active.id }), true));
        const scroll = element('div', undefined, 'class-directory-scroll'); scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Work table');
        const table = element('table'); table.setAttribute('aria-label', 'Class work');
        const head = element('thead'), headings = element('tr');
        for (const label of ['Title', 'Trimester', 'When', 'Actions']) { const cell = element('th', label); cell.scope = 'col'; headings.append(cell); }
        head.append(headings); const body = element('tbody'); table.append(head, body); scroll.append(table);
        let offset = 0;
        const footer = element('div', undefined, 'class-directory-footer'), paging = element('div'), count = element('span'); count.setAttribute('role', 'status');
        const previous = button('Previous', () => { offset -= 10; render(); }); previous.setAttribute('aria-label', 'Previous work page');
        const next = button('Next', () => { offset += 10; render(); }); next.setAttribute('aria-label', 'Next work page');
        paging.append(previous, next); footer.append(paging, count);
        function render() {
            const query = search.value.trim().toLocaleLowerCase();
            const filtered = sortAssignments(assignments.filter(assignment => (assignment.title || '').toLocaleLowerCase().includes(query)
                && (trimester.value === 'all' || trimesterOf(assignment) === trimester.value)
                && (states.value === 'all' || assignmentStatus(assignment) === states.value)
                && (types.value === 'all' || assignment.kind === types.value)), sort.value);
            body.replaceChildren();
            for (const assignment of filtered.slice(offset, offset + 10)) {
                const row = element('tr'), title = element('th', assignment.title); title.scope = 'row';
                const actions = element('td');
                if (onReview) {
                    const review = button('Review', () => onReview({ classId: active.id, assignmentId: assignment.id }));
                    review.className = 'class-table-link'; review.setAttribute('aria-label', `Review work ${assignment.title}`); actions.append(review);
                }
                const when = element('td', assignmentWhen(assignment, assignmentStatus(assignment)));
                when.title = `Available: ${assignmentDate(assignment.release_at)} · Due: ${assignmentDate(assignment.due_at)}`;
                row.append(title, element('td', assignmentTrimesterLabel(trimesterOf(assignment))), when, actions); body.append(row);
            }
            if (!filtered.length) { const row = element('tr'), cell = element('td', assignments.length ? 'No work matches your search.' : 'No work has been assigned to this class.'); cell.colSpan = 4; row.append(cell); body.append(row); }
            previous.disabled = offset === 0; next.disabled = offset + 10 >= filtered.length;
            count.textContent = `Work ${filtered.length ? offset + 1 : 0}–${Math.min(offset + 10, filtered.length)} of ${filtered.length}`;
        }
        search.addEventListener('input', () => { offset = 0; render(); });
        for (const control of [trimester, states, types, sort]) control.addEventListener('change', () => { offset = 0; render(); });
        block.append(toolbar, scroll, footer); root.append(block); render();
    }
    async function show({ classId = null, tab = 'students', refresh = false } = {}) {
        if (destroyed) return;
        clearHeader();
        closeDialog?.(); closeDialog = null;
        controller?.abort(); controller = new AbortController();
        const signal = controller.signal, id = ++generation, owner = getUserId();
        const changedClass = route.classId !== classId;
        route = { classId, tab: ['work', 'settings'].includes(tab) ? tab : 'students' };
        root.classList.add('classrooms');
        root.classList.toggle('class-detail', Boolean(classId));
        root.replaceChildren(element('h2', classId ? 'Classwork' : 'My classes', classId ? 'classrooms-page-title' : 'teacher-class-home-title'), status);
        status.textContent = owner ? '' : 'Sign in to see your classes.';
        root.setAttribute('aria-busy', String(Boolean(owner)));
        if (!owner) return;
        let placeholder = createClassWorkspaceLoading({ classId, tab: route.tab, includeNavigation: Boolean(classId) });
        root.append(placeholder);
        try {
            const classes = classId && !refresh && cachedOwner === owner && cachedClasses
                ? cachedClasses : await repository.listClasses({ signal });
            if (!current(id, owner)) return;
            cachedClasses = classes; cachedOwner = owner;
            onClassesLoaded?.(classes);
            if (!classId) {
                const [subjects, years] = await Promise.all([repository.listSubjects({ signal }), schoolData.listYears(schoolContext.getSchoolId(), { signal })]);
                if (!current(id, owner)) return;
                renderDirectory(classes, subjects, years);
            } else {
                const active = classes.find(c => c.id === classId);
                if (!active) {
                    root.append(button('All classes', () => navigate({ classId: null, tab: 'students' })));
                    status.textContent = 'This class is unavailable. Choose another class.'; return;
                }
                const renderSettings = renderClassHeader(active, id, owner, signal);
                if (!current(id, owner)) return;
                if (route.tab === 'settings' && !renderSettings) route.tab = 'students';
                const tabs = element('div', undefined, 'class-detail-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Class sections');
                const sections = [['work', 'Classwork'], ['students', 'Students']];
                if (renderSettings) sections.push(['settings', 'Class settings']);
                for (const [value, label] of sections) {
                    const item = button(label, () => navigate({ classId, tab: value }));
                    item.className = 'class-detail-tab'; item.setAttribute('role', 'tab');
                    item.id = `class-tab-${value}`; item.setAttribute('aria-selected', String(value === route.tab));
                    item.setAttribute('aria-controls', 'class-detail-panel');
                    item.tabIndex = value === route.tab ? 0 : -1;
                    item.addEventListener('keydown', event => {
                        const controls = [...tabs.children], index = controls.indexOf(item);
                        const destination = event.key === 'ArrowRight' ? (index + 1) % controls.length
                            : event.key === 'ArrowLeft' ? (index + controls.length - 1) % controls.length
                            : event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : null;
                        if (destination !== null) { event.preventDefault(); controls[destination].focus(); }
                    });
                    tabs.append(item);
                }
                const navigation = element('div', undefined, 'class-detail-navigation');
                const header = root.querySelector('.class-detail-header');
                if (headerRoot && header) navigation.append(header);
                navigation.append(tabs); root.append(navigation);
                placeholder.remove();
                placeholder = createClassWorkspaceLoading({ classId, tab: route.tab });
                placeholder.id = 'class-detail-panel'; placeholder.setAttribute('role', 'tabpanel');
                placeholder.setAttribute('aria-labelledby', `class-tab-${route.tab}`); root.append(placeholder);
                if (route.tab === 'work') await renderWork(active, id, owner, signal);
                else if (route.tab === 'settings') await renderSettings();
                else await renderStudents(active, id, owner, signal);
                if (!current(id, owner)) return;
                const panel = root.lastElementChild;
                panel.id = 'class-detail-panel'; panel.setAttribute('role', 'tabpanel');
                panel.setAttribute('aria-labelledby', `class-tab-${route.tab}`);
            }
            if (current(id, owner)) status.textContent = '';
        } catch (error) {
            if (current(id, owner)) {
                status.textContent = '';
                const { showSectionLoadError, isAccessFailure } = await import('./ui/sectionRecovery.js');
                if (!current(id, owner)) return;
                const errorPanel = element('section');
                const notice = showSectionLoadError(errorPanel, { label: 'classes', error, current: () => current(id, owner),
                    retry: () => show({ ...route, refresh: true }) });
                notice?.querySelector('button')?.classList.add('class-loading-retry');
                if (isAccessFailure(error)) root.replaceChildren();
                if (root.querySelector('.class-detail-tabs')) {
                    errorPanel.id = 'class-detail-panel'; errorPanel.setAttribute('role', 'tabpanel');
                    errorPanel.setAttribute('aria-labelledby', `class-tab-${route.tab}`);
                }
                root.append(errorPanel);
            }
        } finally {
            if (current(id, owner)) {
                placeholder.remove(); root.setAttribute('aria-busy', 'false');
                if (changedClass && headerRoot) window.scrollTo({ top: 0, behavior: 'instant' });
            }
        }
    }
    function hide() { clearHeader(); cachedClasses = null; cachedOwner = null; root.removeAttribute('aria-busy'); generation++; controller?.abort(); closeDialog?.(); closeDialog = null; root.replaceChildren(); }
    return { show, hide, destroy() { destroyed = true; hide(); } };
}
