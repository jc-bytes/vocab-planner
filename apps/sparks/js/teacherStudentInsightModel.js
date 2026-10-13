import { readingReviewStatus, assignmentFeedback } from './teacherStudentFeedbackModel.js';
const date = value => value ? Date.parse(value) : NaN;
const number = value => value === null || value === undefined || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
export function buildStudentInsight({ assignments = [] } = {}, now = Date.now()) {
    const summary = { required: 0, completed: 0, notStarted: 0, inProgress: 0, review: 0, needsRevision: 0, overdue: 0, unknown: 0 };
    const work = assignments.map(assignment => {
        const current = !assignment.archived && assignment.enrolled && !assignment.withdrawn
            && date(assignment.releaseAt) <= now && !assignment.content?.activitySettings?.retiredWeeklySet;
        const lifecycle = assignment.content?.activitySettings?.retiredWeeklySet ? 'Retired' : assignment.withdrawn ? 'Withdrawn' : assignment.archived || !assignment.enrolled ? 'Historical'
            : date(assignment.releaseAt) > now ? 'Scheduled' : date(assignment.closeAt) < now ? 'Closed' : 'Available';
        const configured = assignment.content?.activitySettings?.requiredActivities;
        const checkMode = assignment.content?.checkMode ?? assignment.content?.check_mode;
        const readingRequired = assignment.kind === 'spark' && checkMode === 'required';
        const known = assignment.kind === 'spark' ? readingRequired : Array.isArray(configured);
        const required = new Set(Array.isArray(configured) ? configured : []);
        const recorded = new Map((assignment.progress || []).map(p => [p.activity_type, p]));
        const activities = assignment.kind === 'spark' ? [] : [...new Set([...required, ...recorded.keys()])].map(type => {
            const progress = recorded.get(type);
            const complete = progress?.verified === true && (progress.is_complete === true || number(progress.score) >= 100);
            return { type, required: required.has(type), progress,
                status: complete ? 'Completed' : progress ? 'In progress' : 'Not started' };
        });
        const response = assignment.response;
        const readingStatus = !response && !readingRequired ? 'No check submitted' : readingReviewStatus(response, assignmentFeedback(assignment));
        const requiredWork = assignment.kind === 'spark' ? readingRequired ? [{ status: readingStatus }] : [] : activities.filter(a => a.required);
        if (current) {
            if (!known) summary.unknown++;
            for (const item of requiredWork) {
                summary.required++;
                if (item.status === 'Completed') summary.completed++;
                else {
                    if (item.status === 'Not started') summary.notStarted++;
                    if (item.status === 'In progress') summary.inProgress++;
                    if (item.status === 'Needs review') summary.review++;
                    if (item.status === 'Needs revision') summary.needsRevision++;
                    if (item.status !== 'Needs review' && date(assignment.dueAt) < now) summary.overdue++;
                }
            }
        }
        return { ...assignment, current, lifecycle, known, activities, readingStatus, readingRequired,
            overdue: current && date(assignment.dueAt) < now && requiredWork.some(a => a.status !== 'Completed' && a.status !== 'Needs review') };
    });
    return { work, summary };
}
export function attemptTiming(attempt) {
    const seconds = number(attempt.activeSeconds);
    // Older untimed attempts stored zero without running the timer.
    if (seconds === null || seconds === 0 && !attempt.timeLimitSeconds) return 'Time unavailable';
    const duration = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
    return `${duration(seconds)} foreground time${attempt.timeLimitSeconds ? ` / ${duration(attempt.timeLimitSeconds)} limit` : ''}`;
}
export function comparableTrend(attempts = []) {
    const finished = attempts.filter(a => a.captureQuality === 'complete' && a.finishedAt && number(a.accuracy) !== null && a.metricLabel);
    if (finished.length < 2 || finished[0].metricLabel !== finished[1].metricLabel) return null;
    return { latest: number(finished[0].accuracy), previous: number(finished[1].accuracy), label: finished[0].metricLabel };
}

export function activityAttention(activity) {
    const p = activity.progress || {}, latest = p.latestAttempt;
    const reasons = [];
    if (activity.status !== 'Completed' && Number(p.finished_runs) >= 3) reasons.push(`${p.finished_runs} finished runs without verified completion`);
    if (latest?.finishedAt && number(latest.accuracy) !== null && Number(latest.attemptedActions) >= 3 && Number(latest.accuracy) < 60) {
        reasons.push(`Latest accuracy ${latest.accuracy}% over ${latest.attemptedActions} actions${latest.metricLabel ? ` (${latest.metricLabel})` : ''}`);
    }
    if (latest?.isLate) reasons.push('Latest attempt exceeded its activity time limit');
    return reasons;
}
export function capturedAnswerRows(activityType, attempt, content = {}) {
    const state = attempt.state || {};
    if (activityType === 'quiz' && Array.isArray(state.questions)) {
        return state.questions.map((q, index) => {
            const answer = state.selectedAnswers?.[index];
            return { prompt: q.word || `Question ${index + 1}`, answer: answer?.selected ?? null,
                expected: answer?.correct ?? q.correctAnswer ?? null, correct: typeof answer?.isCorrect === 'boolean' ? answer.isCorrect : null };
        });
    }
    if (activityType === 'flashcards' && state.attemptsByCard && Array.isArray(content.words)) {
        return Object.entries(state.attemptsByCard).filter(([index, count]) => content.words[index] && Number(count) > 0).map(([index, count]) => ({
            prompt: content.words[index].word, answer: `${count} checks recorded`, expected: null,
            correct: Array.isArray(state.firstAttemptCorrectCards) ? state.firstAttemptCorrectCards.includes(Number(index)) : null
        }));
    }
    return [];
}
