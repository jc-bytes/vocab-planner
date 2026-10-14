import { buildAssignmentCompletionReport } from './teacherAssignmentCompletionModel.js';
import { node, action, selectField } from './teacherAssignmentUi.js';
import { openAssignmentExport } from './teacherAssignmentExport.js';
import { createStudentFeedbackEditor } from './teacherStudentFeedbackEditor.js';
import { assignmentStatus } from './teacherAssignmentResults.js';

const activityName = type => String(type).replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

// The RPC supplies immutable requirements and verified evidence. Rendering never awards credit.
export async function showVocabularyCompletion({ root, assignment, repository, signal, isCurrent, className, onDialog, onWordHuntReview }) {
    const facts = await repository.assignmentCompletion(assignment.id, { signal });
    if (!isCurrent()) return;
    let report = buildAssignmentCompletionReport(facts);
    const summary = node('p'); summary.setAttribute('role', 'status');
    const toolbar = node('div', undefined, 'teacher-workspace-toolbar');
    const searchLabel = node('label', 'Find student', 'teacher-workspace-field');
    const search = node('input'); search.type = 'search'; searchLabel.append(search); toolbar.append(searchLabel);
    const progress = selectField(toolbar, 'Completion', 'completion', [['all', 'All completion states'], ...['Complete', 'In progress', 'Not started', 'Unavailable', 'No required work'].map(value => [value, value])]);
    const scope = selectField(toolbar, 'Roster', 'roster', [['active', 'Current class members'], ['historical', 'Former members with saved work']]);
    const content = node('section', undefined, 'teacher-workspace-list'); content.setAttribute('aria-label', 'Vocabulary completion');
    const editors = new Map();
    function editor(student, type, feedback) {
        const key = JSON.stringify([student.studentId, type]);
        if (!editors.has(key)) editors.set(key, createStudentFeedbackEditor({ repository, assignmentId: assignment.id, studentId: student.studentId,
            activityType: type, kind: 'vocabulary', feedback, isCurrent,
            onSaved: saved => {
                const person = facts.students.find(value => value.studentId === student.studentId);
                person.feedback = (person.feedback || []).filter(value => value.activity_type !== saved.activity_type);
                person.feedback.push(saved);
                report = buildAssignmentCompletionReport(facts);
            } }));
        return editors.get(key);
    }
    const visibleStudents = () => report.students.filter(student => student.enrolled === (scope.value === 'active')
        && (progress.value === 'all' || student.status === progress.value)
        && student.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));
    function render() {
        if (!isCurrent()) return;
        const counts = report.summary;
        summary.textContent = `${counts.complete} of ${counts.active} current class members complete · ${counts.inProgress} in progress · ${counts.notStarted} not started${counts.unavailable ? ` · ${counts.unavailable} unavailable` : ''}${counts.noRequiredWork ? ` · ${counts.noRequiredWork} with no required work` : ''}`;
        content.replaceChildren();
        const students = visibleStudents();
        if (!report.requirementsKnown) content.append(node('p', 'The published requirements are unavailable. Saved activity evidence is shown without a vocabulary completion total.'));
        if (!students.length) { content.append(node('p', 'No students match these filters.')); return; }
        for (const student of students) {
            const row = node('article', undefined, 'teacher-workspace-row teacher-completion-row');
            const heading = node('div', undefined, 'teacher-workspace-summary');
            heading.append(node('h4', student.name), node('p', `${student.status}${student.totalRequired === null ? '' : ` · ${student.completedRequired}/${student.totalRequired} required activities`}`));
            if (student.remaining?.length) heading.append(node('p', `Remaining: ${student.remaining.map(activityName).join(', ')}`));
            if (student.lastWorkedAt) heading.append(node('p', `Last work ${new Date(student.lastWorkedAt).toLocaleString()}`));
            if (!student.enrolled) heading.append(node('p', 'Historical evidence. Excluded from current class totals.'));
            const details = node('details'); details.append(node('summary', 'Activity details'));
            const list = node('div', undefined, 'teacher-completion-activities');
            for (const activity of student.activities) {
                const item = node('section');
                item.append(node('h5', `${activityName(activity.type)} · ${activity.required === null ? 'Requirement unavailable' : activity.required ? 'Required' : 'Optional'}`), node('p', activity.status));
                if (activity.score !== null) item.append(node('p', `Activity score: ${activity.score}`));
                if (activity.accuracy !== null) item.append(node('p', `Answer accuracy: ${activity.accuracy}%`));
                const note = node('details'); note.append(node('summary', activity.feedback?.note ? 'Teacher note: saved' : 'Teacher note'),
                    editor(student, activity.type, activity.feedback));
                item.append(note);
                list.append(item);
            }
            if (!student.activities.length) list.append(node('p', 'No activity evidence.'));
            const general = node('details'); general.append(node('summary', 'Assignment note'), editor(student, '',
                facts.students.find(value => value.studentId === student.studentId)?.feedback?.find(value => value.activity_type === '')));
            list.append(general);
            details.append(list); row.append(heading, details); content.append(row);
        }
    }
    toolbar.append(action('Export results', () => {
        if (!isCurrent()) return;
        const selected = new Set(visibleStudents().map(student => student.studentId));
        onDialog(openAssignmentExport({ rows: report.exportRows.filter(row => selected.has(row.studentId)), kind: 'vocabulary-completion', className,
            assignmentTitle: assignment.title, isCurrent, onClose: () => onDialog(null) }));
    }));
    if (onWordHuntReview) toolbar.append(action('Browse Word Hunt evidence', () => {
        if (isCurrent()) onWordHuntReview();
    }));
    for (const field of [progress, scope]) field.addEventListener('change', render);
    search.addEventListener('input', render);
    const published = facts.assignment;
    const lifecycle = published.content?.activitySettings?.retiredWeeklySet ? 'Retired' : published.withdrawn ? 'Withdrawn'
        : published.archived ? 'Historical' : assignmentStatus({ release_at: published.releaseAt, close_at: published.closeAt });
    root.append(node('p', `Assignment: ${lifecycle}`), summary, toolbar, content); render();
}
