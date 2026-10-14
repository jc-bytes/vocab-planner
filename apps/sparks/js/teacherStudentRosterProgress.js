import { buildStudentProfileModel } from './teacherStudentProfileModel.js';
import { verifiedActivityComplete, vocabularyRequirements } from './verifiedAssignmentProgress.js';

export function releasedVocabularyAssignments(assignments, classes, now = Date.now()) {
    const year = new Date(now).getFullYear();
    const activeClasses = new Set(classes.filter(c => !c.archived && Number(c.school_year) === year).map(c => c.id));
    return assignments.filter(a => a.kind === 'vocabulary' && !a.withdrawn
        && activeClasses.has(a.class_id) && Number.isFinite(Date.parse(a.release_at)) && Date.parse(a.release_at) <= now);
}

export function buildStudentRosterProgress(student, { assignments = [], rosters = {}, now = Date.now() } = {}) {
    const profile = buildStudentProfileModel(student, { now });
    let required = 0, completed = 0, overdue = 0;
    for (const assignment of assignments) {
        if (!(rosters[assignment.class_id] || []).some(s => s.studentId === student.id)) continue;
        const settings = assignment.content?.activitySettings;
        if (settings?.retiredWeeklySet) continue;
        const activities = vocabularyRequirements(assignment.content);
        if (activities === null) {
            return { ...recordedProgress(profile), required: null, completed: null, pending: null, overdue: null };
        }
        const scores = student.units?.[`assignment:${assignment.id}`]?.scores || {};
        for (const activity of activities) {
            required += 1;
            const progress = scores[activity];
            if (verifiedActivityComplete(progress)) completed += 1;
            else if (assignment.due_at && Date.parse(assignment.due_at) < now) overdue += 1;
        }
    }
    return { ...recordedProgress(profile), required, completed, pending: required - completed, overdue };
}

function recordedProgress(profile) {
    const recent = profile.activities.filter(a => Number.isFinite(a.latestAccuracy)).slice(0, 10);
    // Use latest-attempt accuracy, rather than lifetime or best-run accuracy.
    const accuracies = recent.map(a => a.latestAccuracy).filter(Number.isFinite);
    return {
        lastActive: profile.lastActive,
        accuracy: accuracies.length ? Math.round(accuracies.reduce((sum, n) => sum + n, 0) / accuracies.length) : null
    };
}
