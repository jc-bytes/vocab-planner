import { schoolContext } from './services/schoolContext.js';
import { schoolRepository } from './services/schoolRepository.js';
import { classroomRepository } from './services/classroomRepository.js';
import { openClassWorkspaceDialog } from './teacherClassWorkspaceDialog.js';
import '../css/classrooms.css';
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
    onNavigate, onPublish, onReview, onGroups }) {
    let generation = 0, destroyed = false, controller, closeDialog;
    let route = { classId: null, tab: 'students' };
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
        try { await action(); if (current(id, owner)) await show(route); }
        catch (error) { if (current(id, owner)) status.textContent = error.message || 'Could not save. Please try again.'; }
        finally { if (current(id, owner)) control.disabled = false; }
    }
    function dialog(title, fields, save, help) {
        closeDialog?.();
        const id = generation, owner = getUserId();
        closeDialog = openClassWorkspaceDialog({ root, title, fields, help,
            isCurrent: () => current(id, owner),
            save, onSaved: () => { if (current(id, owner)) return show(route); }
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
    async function renderTeachers(active, id, owner, signal) {
        if (!schoolContext.hasRole('school_admin')) return;
        const [members, assigned] = await Promise.all([
            schoolRepository.listMembers(active.school_id, { signal }),
            repository.listClassTeachers(active.id, { signal })
        ]);
        if (!current(id, owner)) return;
        const block = element('section'); block.append(element('h3', 'Teachers'));
        for (const member of members.filter(member => member.active && member.roles.includes('teacher'))) {
            const present = assigned.some(teacher => teacher.user_id === member.user_id && teacher.active);
            const row = element('p', member.display_name || member.email || 'Teacher');
            const control = button(present ? 'Remove teacher' : 'Assign teacher', () =>
                mutate(control, () => repository.setClassTeacher(active.id, member.user_id, !present)));
            row.append(control); block.append(row);
        }
        root.append(block);
    }
    async function renderStudents(active, id, owner, signal) {
        const [roster, invitations] = await Promise.all([
            repository.getRoster(active.id, { signal }), repository.listInvitations(active.id, { signal })
        ]);
        if (!current(id, owner)) return;
        const block = element('section'); block.setAttribute('aria-label', 'Class students');
        block.append(element('h3', 'Students'));
        if (!active.archived) block.append(button('Invite students', () => dialog('Invite students', [
            { name: 'emails', label: 'Student emails', type: 'textarea', maxLength: 76500 }
        ], data => repository.inviteStudents(active.id, [...new Set(String(data.get('emails')).toLowerCase().split(/[\s,;]+/).filter(Boolean))]),
        'Enter one email or paste an email column from a spreadsheet. Invitations appear when students sign in with those emails.'), true));
        if (onGroups && !active.archived) block.append(button('Make groups', () => onGroups({ classId: active.id })));
        block.append(element('p', `${roster.length} student${roster.length === 1 ? '' : 's'}`));
        if (!roster.length) block.append(element('p', 'No students have joined yet.'));
        for (const student of roster) {
            const row = element('article', undefined, 'teacher-workspace-row');
            const summary = element('div', undefined, 'teacher-workspace-summary');
            summary.append(element('h4', student.name), element('p', student.email)); row.append(summary);
            if (!active.archived) {
                const remove = button('Remove from class', () => dialog('Remove student', [], () => repository.removeStudent(active.id, student.studentId),
                    `Remove ${student.name} from ${active.name}? They will lose access to this class. Saved work remains in its history.`));
                row.append(remove);
            }
            block.append(row);
        }
        const pending = invitations.filter(invite => !invite.acceptedAt && !invite.revokedAt);
        if (pending.length) block.append(element('h3', 'Invitations'));
        for (const invite of pending) {
            const row = element('p', `${invite.email} · ${new Date(invite.expiresAt) <= new Date() ? 'Expired' : 'Invited'} `);
            if (!active.archived) {
                const cancel = button('Cancel invitation', () => mutate(cancel, () => repository.revokeInvitation(invite.id)));
                row.append(cancel);
            }
            block.append(row);
        }
        root.append(block);
    }
    async function renderWork(active, id, owner, signal) {
        const assignments = await repository.listAssignments(active.id, { signal });
        if (!current(id, owner)) return;
        const block = element('section'); block.setAttribute('aria-label', 'Class work');
        block.append(element('h3', 'Work'));
        if (!active.archived && active.canTeach === true && onPublish) block.append(button('Assign material', () => onPublish({ classId: active.id }), true));
        if (!assignments.length) block.append(element('p', 'No work has been assigned to this class.'));
        for (const assignment of assignments) {
            const row = element('article', undefined, 'teacher-workspace-row');
            const summary = element('div', undefined, 'teacher-workspace-summary'); row.append(summary);
            summary.append(element('h4', assignment.title), element('p', assignment.withdrawn ? 'Withdrawn' : `Available ${new Date(assignment.release_at).toLocaleString()}`));
            if (assignment.due_at) summary.append(element('p', `Due ${new Date(assignment.due_at).toLocaleString()}`));
            if (onReview) row.append(button('Review work', () => onReview({ classId: active.id, assignmentId: assignment.id })));
            block.append(row);
        }
        root.append(block);
    }
    async function show({ classId = null, tab = 'students' } = {}) {
        if (destroyed) return;
        closeDialog?.(); closeDialog = null;
        controller?.abort(); controller = new AbortController();
        const signal = controller.signal, id = ++generation, owner = getUserId();
        route = { classId, tab: tab === 'work' ? 'work' : 'students' };
        root.classList.add('classrooms');
        root.replaceChildren(element('h2', 'Classes'), status);
        status.textContent = owner ? 'Loading classes…' : 'Sign in to see your classes.';
        if (!owner) return;
        try {
            const classes = await repository.listClasses({ signal });
            if (!current(id, owner)) return;
            if (!classId) {
                const [subjects, years] = await Promise.all([repository.listSubjects({ signal }), schoolData.listYears(schoolContext.getSchoolId(), { signal })]);
                if (!current(id, owner)) return;
                root.append(setupActions(subjects, years));
                if (!classes.length) root.append(element('p', 'Create a subject and class to begin.'));
                const list = element('section', undefined, 'teacher-workspace-list teacher-class-grid');
                for (const c of classes) {
                    const card = element('article', undefined, 'teacher-workspace-row');
                    const summary = element('div', undefined, 'teacher-workspace-summary');
                    summary.append(element('h3', c.name), element('p', `${c.subject?.name || 'Subject'} · ${c.school_year}${c.archived ? ' · Archived' : ''}`));
                    card.append(summary, button('Open class', () => navigate({ classId: c.id, tab: 'students' })));
                    list.append(card);
                }
                root.append(list);
            } else {
                root.append(button('All classes', () => navigate({ classId: null, tab: 'students' })));
                const active = classes.find(c => c.id === classId);
                if (!active) { status.textContent = 'This class is unavailable. Choose another class.'; return; }
                root.append(element('h3', active.name), element('p', `${active.subject?.name || 'Subject'} · ${active.school_year}${active.archived ? ' · Archived' : ''}`));
                const archive = button(active.archived ? 'Reopen class' : 'Archive class', () => dialog(active.archived ? 'Reopen class' : 'Archive class', [],
                    () => repository.setClassArchived(active.id, !active.archived), active.archived ? 'New invitations and student submissions will be available again.' : 'New invitations and student submissions will stop. Saved work remains available for review.'));
                if (schoolContext.hasRole('school_admin')) root.append(archive);
                const tabs = element('nav'); tabs.setAttribute('aria-label', 'Class sections');
                for (const [value, label] of [['students', 'Students'], ['work', 'Work']]) {
                    const item = button(label, () => navigate({ classId, tab: value }), value === route.tab);
                    if (value === route.tab) item.setAttribute('aria-current', 'page');
                    tabs.append(item);
                }
                root.append(tabs);
                await renderTeachers(active, id, owner, signal);
                if (!current(id, owner)) return;
                if (route.tab === 'work') await renderWork(active, id, owner, signal);
                else await renderStudents(active, id, owner, signal);
            }
            if (current(id, owner)) status.textContent = '';
        } catch (error) { if (current(id, owner)) status.textContent = error.message || 'Could not load classes. Please try again.'; }
    }
    function hide() { generation++; controller?.abort(); closeDialog?.(); closeDialog = null; root.replaceChildren(); }
    return { show, hide, destroy() { destroyed = true; hide(); } };
}
