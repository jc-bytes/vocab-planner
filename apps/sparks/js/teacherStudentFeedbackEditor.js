import { node, action, selectField } from './teacherAssignmentUi.js';

// Shared by the student profile and class assignment review. Notes are teacher-only.
export function createStudentFeedbackEditor({ repository, assignmentId, studentId, activityType = '', kind,
    responseRevision = null, feedback = null, isCurrent = () => true, onSaved = () => {} }) {
    const host = node('fieldset', undefined, 'student-feedback-editor');
    host.append(node('legend', activityType ? 'Teacher activity note' : 'Teacher note and review'));
    host.append(node('p', 'Saved for teachers of this class.'));
    const label = node('label', 'Note'); const note = node('textarea');
    note.rows = 3; note.maxLength = 4000; note.name = 'teacher-note'; label.append(note); host.append(label);
    const canReview = kind === 'spark' && !activityType && responseRevision !== null;
    const review = canReview ? selectField(host, 'Submission review', 'review-status', [
        ['unreviewed', 'Awaiting review'], ['reviewed', 'Reviewed and accepted'], ['needs_revision', 'Needs revision']
    ]) : null;
    if (canReview) host.append(node('p', 'Review applies to this submission. Incorrect automatic answers still need correction.'));
    const saved = node('p'); host.append(saved);
    const status = node('p'); status.setAttribute('role', 'status'); host.append(status);
    const controls = node('div', undefined, 'teacher-toolbar'); host.append(controls);
    let revision = 0, generation = 0, historyButton, historyHost, historyGeneration = 0;
    // Filters may detach this editor while its owner and pending request remain current.
    const current = id => id === generation && isCurrent();
    function apply(record, { preserveNote = false, preserveReview = false } = {}) {
        feedback = record || null; revision = record?.revision || 0;
        if (!preserveNote) note.value = record?.note || '';
        if (historyButton) historyButton.disabled = !record;
        if (review && !preserveReview) review.value = record?.response_revision === responseRevision ? record.review_status : 'unreviewed';
        saved.textContent = record ? `Saved ${new Date(record.updated_at).toLocaleString()} · ${record.authorName || 'Teacher'} · Note revision ${revision}${canReview && record.response_revision && record.response_revision !== responseRevision ? ' · Note refers to a different submission revision' : ''}` : 'No saved teacher note.';
    }
    apply(feedback);
    const save = action('Save teacher note', async () => {
        if (!isCurrent() || save.disabled || !note.reportValidity()) return;
        const id = ++generation; save.disabled = true; reload.disabled = true; status.textContent = 'Saving...';
        const submitted = { note: note.value, reviewStatus: review?.value || 'unreviewed' };
        try {
            const record = await repository.saveStudentFeedback({ assignmentId, studentId, activityType,
                ...submitted, responseRevision,
                expectedRevision: revision });
            if (!current(id)) return;
            const edits = { preserveNote: note.value !== submitted.note,
                preserveReview: Boolean(review && review.value !== submitted.reviewStatus) };
            apply(record, edits);
            status.textContent = edits.preserveNote || edits.preserveReview
                ? 'Teacher note saved. Your newer edits are not saved yet.' : 'Teacher note saved.';
            onSaved(record);
        } catch (error) {
            if (current(id)) status.textContent = error.message || 'Could not save. Your draft is still here.';
        } finally { if (current(id)) { save.disabled = false; reload.disabled = false; } }
    }, true);
    const reload = action('Load saved note', async () => {
        if (!isCurrent() || reload.disabled) return;
        const id = ++generation; reload.disabled = true; save.disabled = true; status.textContent = 'Loading saved note...';
        const draft = { note: note.value, reviewStatus: review?.value };
        try {
            const records = await repository.assignmentFeedback(assignmentId);
            if (!current(id)) return;
            const edits = { preserveNote: note.value !== draft.note,
                preserveReview: Boolean(review && review.value !== draft.reviewStatus) };
            apply(records.find(f => f.student_id === studentId && f.activity_type === activityType), edits);
            status.textContent = edits.preserveNote || edits.preserveReview
                ? 'Loaded saved note. Your newer edits are not saved yet.'
                : 'Loaded saved note. Reload the answers before reviewing a changed submission.';
        } catch (error) { if (current(id)) status.textContent = error.message || 'Could not load saved note.'; }
        finally { if (current(id)) { reload.disabled = false; save.disabled = false; } }
    });
    controls.append(save, reload);
    historyButton = action('View latest 20 note revisions', async event => {
        if (!isCurrent()) return;
        const button = event.currentTarget; const historyRequest = ++historyGeneration; button.disabled = true;
        try {
            const history = await repository.studentFeedbackHistory(studentId, assignmentId, activityType);
            if (!isCurrent() || historyRequest !== historyGeneration) return;
            const nextHistory = node('div', undefined, 'student-feedback-history');
            for (const row of history) nextHistory.append(node('p', `${new Date(row.updated_at).toLocaleString()} · ${row.authorName || 'Teacher'} · Revision ${row.revision} · ${kind === 'spark' ? ({unreviewed:'Awaiting review',reviewed:'Reviewed and accepted',needs_revision:'Needs revision'}[row.review_status] || 'Review unavailable') : 'Teacher note'}`), node('p', row.note));
            if (historyHost) historyHost.replaceWith(nextHistory); else host.append(nextHistory);
            historyHost = nextHistory; button.disabled = false; button.textContent = 'Refresh latest 20 note revisions';
        } catch (error) { if (isCurrent() && historyRequest === historyGeneration) { status.textContent = error.message || 'Could not load history.'; button.disabled = false; } }
    });
    historyButton.disabled = !feedback; host.append(historyButton);
    return host;
}
