import { schoolContext } from './services/schoolContext.js';
import { schoolRepository } from './services/schoolRepository.js';
import { createSparkCheckForm } from './classroomSparkCheckView.js';
import { classroomRepository } from './services/classroomRepository.js';
import '../css/classrooms.css';

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

// Session-bound student class entry point. Teacher management lives in teacherClassWorkspace.
// No retained roster or draft data survives destroy/account replacement.
export function createClassroomView({ root, getUserId, openVocabulary, onSchoolReady = async () => {}, repository = classroomRepository, getClassId = () => null, materialKind = null, title = 'My classes', loadingMarkup = null }) {
    let generation = 0;
    let controller;
    let destroyed = false;
    const previews = new Set();
    function cancelPreviews() {
        for (const preview of previews) { preview.request++; preview.controller?.abort(); }
        previews.clear();
    }
    const status = element('p', '', 'inline-status');
    status.setAttribute('role', 'status');
    function current(id, owner) { return !destroyed && id === generation && owner === getUserId(); }
    function button(label, action, refresh = true) {
        const node = element('button', label, 'btn secondary-btn');
        node.type = 'button';
        node.addEventListener('click', () => mutate(node, action, refresh));
        return node;
    }
    async function mutate(control, action, refresh = true) {
        const id = generation, owner = getUserId();
        if (!owner || !current(id, owner)) return;
        control.disabled = true;
        try {
            await action();
            if (refresh && current(id, owner)) await show();
        } catch (error) {
            if (current(id, owner)) status.textContent = error.message || 'Could not save. Please try again.';
        } finally { if (control.isConnected) control.disabled = false; }
    }
    async function show() {
        if (destroyed) return;
        cancelPreviews();
        controller?.abort(); controller = new AbortController();
        const id = ++generation, owner = getUserId();
        if (loadingMarkup) { root.innerHTML = loadingMarkup(); root.dataset.classLoading = 'true'; }
        else root.replaceChildren(element('h1', title), status);
        root.classList.add('classrooms');
        status.textContent = 'Loading classes…';
        if (!owner) { status.textContent = 'Sign in to see your classes.'; return; }
        try {
            await schoolContext.load(owner);
            await onSchoolReady({ signal: controller.signal });
            if (!current(id, owner)) return;
            const [allClasses, allInvites, schoolInvites] = await Promise.all([
                repository.listMyClasses({ signal: controller.signal }), repository.listMyInvitations({ signal: controller.signal }), schoolRepository.listMyInvitations({ signal: controller.signal })
            ]);
            if (!current(id, owner)) return;
            if (loadingMarkup) root.append(status);
            const chooser = element('label', 'School '), select = document.createElement('select');
            for (const school of schoolContext.getAccess().schools.filter(s => s.roles.includes('student'))) {
                const option = element('option', school.name); option.value = school.id; select.append(option);
            }
            select.value = schoolContext.getSchoolId() || '';
            if (!select.value && select.options.length) { select.selectedIndex = 0; schoolContext.select(select.value); }
            select.addEventListener('change', () => { if (current(id, owner)) { schoolContext.select(select.value); void show(); } });
            chooser.append(select); root.append(chooser);
            const selectedSchool = schoolContext.getSchoolId();
            const classes = allClasses.filter(c => c.schoolId === selectedSchool && (!getClassId() || c.id === getClassId()));
            const invites = allInvites.filter(invite => invite.schoolId === selectedSchool);
            for (const invitation of schoolInvites) {
                const card = element('article', undefined, 'card');
                card.append(element('h2', invitation.school_name || invitation.schoolName || 'School invitation'),
                    button('Join school', () => schoolRepository.acceptInvitation(invitation.id)));
                root.append(card);
            }
            for (const invite of invites) {
                const card = element('article', undefined, 'card');
                card.append(element('h2', `${invite.subjectName} · ${invite.className}`), element('p', `${invite.teacherName || 'Teacher'} · ${invite.schoolYear}`),
                    button('Join class', () => repository.acceptInvitation(invite.id)));
                root.append(card);
            }
            if (!classes.length) root.append(element('p', 'You have not joined a class yet. Ask your teacher for an invitation using your school email.'));
            for (const c of classes) {
                const card = element('article', undefined, 'card');
                const preview = { request: 0, controller: null };
                previews.add(preview);
                card.append(element('h2', `${c.subjectName} · ${c.name}`), element('p', `${c.teacherName || 'Teacher'} · ${c.schoolYear}${c.archived ? ' · Archived' : ''}`));
                root.append(card);
                const assignments = await repository.listAssignments(c.id, { signal: controller.signal });
                if (!current(id, owner)) return;
                const visibleAssignments = assignments.filter(a => !materialKind || a.kind === materialKind);
                if (!visibleAssignments.length) card.append(element('p', 'No assignments are available yet.'));
                for (const assignment of visibleAssignments) {
                    card.append(button(assignment.title, async () => {
                        preview.controller?.abort(); preview.controller = new AbortController();
                        const signal = preview.controller.signal, request = ++preview.request;
                        const isPreviewCurrent = () => current(id, owner) && request === preview.request && !signal.aborted;
                        try {
                            const detail = await repository.readAssignment(assignment.id, { signal });
                            if (!isPreviewCurrent()) return;
                            const responses = detail.kind === 'spark' ? await repository.listResponses(assignment.id, { signal }) : [];
                            if (!isPreviewCurrent()) return;
                            showMaterial(detail, card, responses[0], c.archived, isPreviewCurrent);
                        } catch (error) { if (isPreviewCurrent()) throw error; }
                    }, false));
                }
            }
            if (current(id, owner)) { root.querySelector('.student-page-skeleton')?.remove(); delete root.dataset.classLoading; status.textContent = ''; }
        } catch (error) {
            if (current(id, owner)) { if (loadingMarkup) { root.replaceChildren(status); delete root.dataset.classLoading; } status.textContent = error.message || 'Could not load classes. Please try again.'; }
        }
    }
    function showMaterial(assignment, card, savedResponse, archived, isPreviewCurrent) {
        card.querySelector('[data-assignment-preview]')?.remove();
        const section = element('section'); section.dataset.assignmentPreview = assignment.id;
        section.append(element('h3', assignment.title));
        const content = assignment.content;
        if (content.kind === 'vocabulary') {
            const list = document.createElement('dl');
            for (const word of content.words || []) list.append(element('dt', word.word), element('dd', word.definition));
            section.append(list);
            if (openVocabulary) section.append(button('Open activities', () => isPreviewCurrent() && openVocabulary(assignment.id), false));
        } else {
            section.append(element('p', content.sparkText), element('p', content.whyItMatters));
            if (content.question) section.append(element('p', content.question));
            if (archived || (assignment.close_at && new Date(assignment.close_at) <= new Date())) {
                section.append(element('p', 'Responses are closed.'));
                if (savedResponse) section.append(element('p', savedResponse.response));
            } else if (content.checkMode === 'reading_only') {
                section.append(element('p', 'Read this Spark. No response is required.'));
            } else if (content.questions?.length) {
                section.append(createSparkCheckForm({ assignment, savedResponse,
                    save: (answers, revision) => isPreviewCurrent()
                        ? repository.checkSpark(assignment.id, answers, revision)
                        : Promise.reject(new DOMException('Assignment changed', 'AbortError')),
                    isCurrent: isPreviewCurrent }));
            } else {
                const responseForm = document.createElement('form');
                const label = element('label', 'Your written response');
                const input = document.createElement('textarea'); input.required = true; input.maxLength = 10000;
                input.value = savedResponse?.response || ''; label.append(input);
                const submit = element('button', 'Save response', 'btn primary-btn'); submit.type = 'submit';
                const feedback = element('p'); feedback.setAttribute('role', 'status');
                let revision = savedResponse?.revision || 0;
                responseForm.append(label, element('p', 'Your teacher will review this written response.'), submit, feedback);
                responseForm.addEventListener('submit', event => {
                    event.preventDefault(); const response = input.value;
                    mutate(submit, async () => {
                        if (!isPreviewCurrent()) return;
                        try {
                            const saved = await repository.saveResponse(assignment.id, response, revision);
                            if (!isPreviewCurrent() || !responseForm.isConnected) return;
                            revision = saved.revision; feedback.textContent = 'Response saved.';
                        } catch (error) { if (isPreviewCurrent()) throw error; }
                    }, false);
                });
                section.append(responseForm);
            }
        }
        card.append(section);
    }
    return { show, destroy() { destroyed = true; generation++; controller?.abort(); cancelPreviews(); root.replaceChildren(); } };
}
