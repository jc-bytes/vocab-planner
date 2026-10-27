import { readingReviewStatus } from './teacherStudentFeedbackModel.js';

// Load only response metadata for the queue, then read decisions only for
// assignments that actually have submissions. Never download answer bodies here.
export async function loadAssignmentReviewQueue(repository, assignments, { signal } = {}) {
    const ids = assignments.filter(a => a.kind === 'spark').map(a => a.id);
    if (!ids.length) return new Map();
    const responses = await repository.listReviewResponses(ids, { signal });
    const allowed = new Set(ids), groups = new Map(), counts = new Map();
    for (const response of responses) {
        if (!allowed.has(response.assignment_id)) continue;
        const rows = groups.get(response.assignment_id) || [];
        rows.push(response); groups.set(response.assignment_id, rows);
    }
    const entries = [...groups];
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(4, entries.length) }, async () => {
        while (next < entries.length) {
            signal?.throwIfAborted();
            const [id, rows] = entries[next++];
            const feedback = await repository.assignmentFeedback(id, { signal });
            signal?.throwIfAborted();
            const count = rows.filter(response => readingReviewStatus(response,
                feedback.find(f => f.student_id === response.student_id && f.activity_type === '')) === 'Needs review').length;
            if (count) counts.set(id, count);
        }
    }));
    return counts;
}

export function assignmentListTab(assignment, ownClass, now = Date.now()) {
    if (ownClass?.archived || assignment.withdrawn || (assignment.close_at && new Date(assignment.close_at).getTime() <= now)) return 'history';
    return new Date(assignment.release_at).getTime() > now ? 'scheduled' : 'current';
}
