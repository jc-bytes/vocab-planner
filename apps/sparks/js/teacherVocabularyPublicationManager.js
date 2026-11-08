import '../css/teacher-assignments.css';
import { classroomRepository } from './services/classroomRepository.js';
import { schoolContext } from './services/schoolContext.js';
import { node, action, selectField, inputField, createAssignmentDialog } from './teacherAssignmentUi.js';

// One reviewed request owns its retries. Closing a dialog never claims cancellation.
export async function openVocabularyPublicationManager({ materialId, repository = classroomRepository, isCurrent = () => true, onChanged = () => {} }) {
    const generation = schoolContext.getGeneration();
    const view = createAssignmentDialog('Published vocabulary', () => {});
    const current = () => view.dialog.isConnected && isCurrent() && generation === schoolContext.getGeneration();
    const status = node('p', 'Loading saved vocabulary and assignments…'); status.setAttribute('role', 'status'); view.body.append(status);
    try {
        const state = await repository.vocabularyPublicationState(materialId);
        if (!current()) { view.close(); return; }
        view.body.append(node('p', `${state.name} · Saved revision ${state.revision}${state.archived ? ' · Archived' : ''}`),
            node('p', 'These operations use the saved library version. Save your editor changes before opening this window. Existing grades and completed work are kept.'));
        if (state.publicationErrors.length) view.body.append(node('p', `Not ready to publish: ${state.publicationErrors.join(' ')}`));
        const form = node('form');
        const operation = selectField(form, 'Change', 'operation', [
            ['requirements', 'Update required and optional activities'], ['replace', 'Create replacement assignments'],
            ['reschedule', 'Move selected assignments'], ['retire', 'Withdraw selected assignments'], ['archive', 'Archive library vocabulary']
        ]);
        const choices = node('fieldset'); choices.append(node('legend', 'Assignments to change'));
        for (const assignment of state.assignments) {
            const label = node('label'); const box = node('input'); box.type = 'checkbox'; box.value = assignment.id;
            label.append(box, document.createTextNode(`${assignment.className} · ${assignment.title} · ${assignment.withdrawn ? 'Withdrawn' : 'Published'}${assignment.hasLibraryChanges ? ' · Library differs' : ' · Matches library'}${assignment.hasWork ? ' · Student work saved' : ''}${assignment.hasPublishedGrades ? ' · Grades published' : ''}`));
            choices.append(label);
        }
        if (!state.assignments.length) choices.append(node('p', 'No assignments published to your classes.'));
        form.append(choices);
        const placement = node('fieldset'); placement.hidden = true; placement.append(node('legend', 'Assignment placement'));
        const date = inputField(placement, 'Placement date', 'assignedDate', 'date');
        const trimester = inputField(placement, 'Trimester', 'trimester', 'text');
        const month = selectField(placement, 'Month', 'month', ['', 'January','February','March','April','May','June','July','August','September','October','November','December'].map(x => [x, x || 'Unspecified']));
        const week = inputField(placement, 'Week', 'week', 'number'); week.min = '1';
        form.append(placement);
        const explanation = node('p'); explanation.setAttribute('role', 'status');
        const review = action('Preview changes', async () => {
            if (!current() || review.disabled) return;
            review.disabled = true; status.textContent = 'Checking the selected assignments…';
            const request = { operation: operation.value, assignmentIds: [...choices.querySelectorAll('input:checked')].map(x => x.value) };
            if (request.operation === 'reschedule') request.placement = { assignedDate: date.value || null, trimester: trimester.value, month: month.value, week: week.value ? Number(week.value) : null };
            try {
                const preview = await repository.previewVocabularyChange(materialId, request);
                if (!current()) return;
                for (const control of form.querySelectorAll('input,select,button')) control.disabled = true;
                explanation.replaceChildren(node('p', preview.notice), node('p', `${preview.assignments.length} assignments selected. Required activities: ${(preview.requiredActivities || []).join(', ')}.`));
                const requestKey = crypto.randomUUID();
                let busy = false;
                const apply = action('Apply reviewed changes', async () => {
                    if (!current() || busy) return; busy = true; apply.disabled = true;
                    status.textContent = 'Applying changes. Closing this window does not cancel the request.';
                    try {
                        const receipt = await repository.applyVocabularyChange(materialId, request, preview.token, requestKey);
                        if (!current()) return;
                        explanation.textContent = `Saved. ${receipt.changes.length} assignments handled. Student work and grades were preserved.`;
                        apply.remove(); status.textContent = '';
                        onChanged(receipt);
                    } catch (error) {
                        if (current()) { status.textContent = error.message || 'Could not apply changes.'; apply.textContent = 'Retry the same reviewed changes'; }
                    } finally { busy = false; if (current()) apply.disabled = false; }
                }, true);
                explanation.append(apply, action('Close', () => view.close()));
                status.textContent = '';
            } catch (error) { if (current()) { status.textContent = error.message || 'Could not preview changes.'; review.disabled = false; } }
        });
        operation.addEventListener('change', () => { placement.hidden = operation.value !== 'reschedule'; });
        form.append(review); form.addEventListener('submit', event => event.preventDefault());
        view.body.append(form, explanation); status.textContent = '';
    } catch (error) { if (current()) status.textContent = error.message || 'Could not load publications.'; }
    return view;
}
