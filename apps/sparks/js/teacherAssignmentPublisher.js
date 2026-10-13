import { classroomRepository } from './services/classroomRepository.js';
import { node, action, inputField, selectField, createAssignmentDialog } from './teacherAssignmentUi.js';
import '../css/teacher-assignments.css';

export function publicationDates(release, due, close) {
    const convert = value => value ? new Date(value).toISOString() : null;
    const releaseAt = convert(release), dueAt = convert(due), closeAt = convert(close);
    if (!releaseAt) throw new Error('Choose when students can open this assignment.');
    if (dueAt && dueAt < releaseAt) throw new Error('The due date must follow the available date.');
    if (closeAt && closeAt < releaseAt) throw new Error('The close date must follow the available date.');
    if (closeAt && dueAt && closeAt < dueAt) throw new Error('The close date must follow the due date.');
    return { releaseAt, dueAt, closeAt };
}

export function createTeacherAssignmentPublisher({ getUserId, repository = classroomRepository, onPublished = () => {} }) {
    let generation = 0, destroyed = false, active, controller;
    const current = (id, owner) => !destroyed && id === generation && owner === getUserId();
    function dismiss() { generation++; controller?.abort(); active?.close(); active = null; }
    async function open({ classId, materialId, kind } = {}) {
        if (destroyed) return;
        dismiss(); const id = ++generation, owner = getUserId();
        if (!owner) return;
        controller = new AbortController();
        const view = createAssignmentDialog('Assign material', () => { if (id === generation) { generation++; controller?.abort(); active = null; } });
        active = view;
        const status = node('p', 'Loading saved materials and classes…'); status.setAttribute('role', 'status'); view.body.append(status);
        try {
            const [materials, classes] = await Promise.all([
                repository.listOwnMaterials({ signal: controller.signal }), repository.listClasses({ signal: controller.signal })
            ]);
            if (!current(id, owner)) return;
            const availableClasses = classes.filter(c => c.canTeach === true && !c.archived);
            if (!materials.length || !availableClasses.length) {
                status.textContent = !materials.length ? 'Save a vocabulary set or Spark in Library first.' : 'You need a teaching assignment in an active class to publish work.';
                return;
            }
            const form = node('form');
            const material = selectField(form, 'Saved material', 'material', materials.map((m, index) => [String(index), `${m.kind === 'spark' ? 'Spark' : 'Vocabulary'} · ${m.title}`]));
            const selectedIndex = materials.findIndex(m => m.id === materialId && (!kind || m.kind === kind));
            if (selectedIndex >= 0) material.value = String(selectedIndex);
            const targets = node('fieldset'); targets.append(node('legend', 'Classes'));
            for (const c of availableClasses) {
                const choice = node('label', `${c.subject?.name || ''} · ${c.name} · ${c.school_year}`);
                const input = node('input'); input.type = 'checkbox'; input.name = 'classIds'; input.value = c.id; input.checked = c.id === classId;
                choice.prepend(input); targets.append(choice);
            }
            form.append(targets);
            const release = inputField(form, 'Available from', 'release', 'datetime-local'); release.required = true;
            release.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            const due = inputField(form, 'Due date (optional)', 'due', 'datetime-local');
            const close = inputField(form, 'Close responses (optional)', 'close', 'datetime-local');
            form.append(node('p', `Times use ${Intl.DateTimeFormat().resolvedOptions().timeZone}. Students receive a saved copy with this material’s activity settings. Editing Library later will not change published work.`));
            const submit = node('button', 'Assign material', 'btn primary-btn'); submit.type = 'submit'; form.append(submit);
            // Keep the exact submitted payload after an uncertain failure. Retry cannot change
            // either its key or content, so a committed request never publishes twice.
            let pending = null, busy = false;
            form.addEventListener('submit', async event => {
                event.preventDefault();
                if (busy || !current(id, owner)) return;
                try {
                    if (!pending) {
                        const classIds = [...targets.querySelectorAll('input:checked')].map(input => input.value);
                        if (!classIds.length) throw new Error('Select at least one class.');
                        if (classIds.length > 50) throw new Error('Assign to at most 50 classes at a time.');
                        const chosen = materials[Number(material.value)];
                        pending = { classIds, kind: chosen.kind, materialId: chosen.id, publicationKey: crypto.randomUUID(), ...publicationDates(release.value, due.value, close.value) };
                    }
                    busy = true; submit.disabled = true;
                    for (const control of form.querySelectorAll('input, select')) control.disabled = true;
                    status.textContent = 'Publishing… Closing this dialog does not cancel the request.';
                    const assignments = await repository.publishMaterial(pending);
                    if (!current(id, owner)) return;
                    view.close();
                    onPublished({ assignments, classIds: pending.classIds });
                } catch (error) {
                    if (current(id, owner)) {
                        status.textContent = `${error.message || 'Could not publish.'}${pending ? ' Retry uses the same saved request to avoid duplicates.' : ''}`;
                        submit.textContent = pending ? 'Retry assignment' : 'Assign material';
                    }
                } finally { busy = false; if (current(id, owner)) submit.disabled = false; }
            });
            status.textContent = ''; view.body.prepend(form); material.focus();
        } catch (error) { if (current(id, owner)) status.textContent = error.message || 'Could not load saved materials.'; }
    }
    return { open, hide: dismiss, destroy() { destroyed = true; dismiss(); } };
}
