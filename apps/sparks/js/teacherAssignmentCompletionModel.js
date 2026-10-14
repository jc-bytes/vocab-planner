import { verifiedActivityComplete, vocabularyRequirements } from './verifiedAssignmentProgress.js';
export { verifiedActivityComplete } from './verifiedAssignmentProgress.js';
const number = value => value === null || value === undefined || value === ''
    ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : -Infinity;
const latestTime = (...values) => values.filter(value => timestamp(value) !== -Infinity)
    .sort((a, b) => timestamp(b) - timestamp(a))[0] ?? null;
const activityTime = progress => latestTime(progress?.updatedAt, progress?.updated_at,
    progress?.latestAttempt?.startedAt, progress?.latestAttempt?.finishedAt);

/** Present the paginated facts from teacher_assignment_completion_v1 without inventing evidence. */
export function buildAssignmentCompletionReport({ assignment = {}, students = [] } = {}) {
    const configured = vocabularyRequirements(assignment.content);
    const requirementsKnown = assignment.kind === 'vocabulary' && configured !== null;
    const requiredActivities = requirementsKnown ? configured : [];
    const required = new Set(requiredActivities);
    const summary = { active: 0, totalRequired: 0, complete: 0, inProgress: 0,
        notStarted: 0, unavailable: 0, noRequiredWork: 0 };
    const rows = students.map(student => {
        const recorded = new Map();
        for (const progress of student.progress || []) {
            const type = progress.activity ?? progress.activity_type;
            if (typeof type !== 'string' || !type) continue;
            const previous = recorded.get(type);
            if (!previous || timestamp(progress.updatedAt ?? progress.updated_at) >= timestamp(previous.updatedAt ?? previous.updated_at)) {
                recorded.set(type, progress);
            }
        }
        const activities = [...new Set([...requiredActivities, ...recorded.keys()])].map(type => {
            const progress = recorded.get(type);
            return { type, required: requirementsKnown ? required.has(type) : null,
                status: verifiedActivityComplete(progress) ? 'Complete' : progress ? 'In progress' : 'Not started',
                score: number(progress?.score), accuracy: number(progress?.accuracy),
                updatedAt: activityTime(progress),
                verified: progress?.verified === true,
                feedback: (student.feedback || []).find(item => item.activity_type === type) || null };
        });
        const completedRequired = requirementsKnown ? activities.filter(activity => activity.required && activity.status === 'Complete').length : null;
        const totalRequired = requirementsKnown ? requiredActivities.length : null;
        const remaining = requirementsKnown ? activities.filter(activity => activity.required && activity.status !== 'Complete').map(activity => activity.type) : null;
        const status = !requirementsKnown ? 'Unavailable' : totalRequired === 0 ? 'No required work'
            : completedRequired === totalRequired ? 'Complete'
                : activities.some(activity => activity.required && activity.status !== 'Not started') ? 'In progress' : 'Not started';
        const lastWorkedAt = latestTime(...activities.map(activity => activity.updatedAt));
        const enrolled = student.enrolled === true;
        if (enrolled) {
            summary.active++;
            if (requirementsKnown) summary.totalRequired += totalRequired;
            summary[({ Complete: 'complete', 'In progress': 'inProgress', 'Not started': 'notStarted',
                Unavailable: 'unavailable', 'No required work': 'noRequiredWork' })[status]]++;
        }
        return { studentId: student.studentId, name: student.name, email: student.email, enrolled,
            activities, completedRequired, totalRequired, remaining, status, lastWorkedAt,
            // Existing vocabulary feedback consists of notes, not a completion approval policy.
            reviewStatus: 'Not required' };
    });
    if (summary.unavailable) summary.totalRequired = null;
    const exportRows = rows.flatMap(student => (student.activities.length ? student.activities : [null]).map(activity => ({
        studentId: student.studentId, name: student.name, enrolled: student.enrolled,
        completionStatus: student.status, completedRequired: student.completedRequired,
        totalRequired: student.totalRequired, remaining: student.remaining, reviewStatus: student.reviewStatus,
        activity: activity?.type ?? '', required: activity?.required ?? null,
        status: activity?.status ?? student.status, score: activity?.score ?? null,
        accuracy: activity?.accuracy ?? null, updatedAt: activity?.updatedAt ?? null
    })));
    return { assignment, requirementsKnown, requiredActivities, students: rows, summary, exportRows };
}
