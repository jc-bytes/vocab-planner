import { readingReviewStatus } from './teacherStudentFeedbackModel.js';
// Shared review/export model. Missing work stays missing rather than becoming a zero.
export function assignmentResultRows(kind, records, roster, feedback = []) {
    const people = new Map(roster.map(s => [s.studentId, s]));
    const rows = records.map(record => {
        const studentId = record.studentId || record.student_id;
        const review = feedback.find(f => f.student_id === studentId && f.activity_type === (kind === 'spark' ? '' : record.activity));
        const reviewedStatus = kind === 'spark' ? readingReviewStatus(record, review) : null;
        return {
            feedback: review || null,
            responseRevision: record.revision ?? null,
            studentId,
            name: record.name || people.get(studentId)?.name || 'Former class member',
            activity: kind === 'spark' ? 'Spark' : record.activity,
            status: kind === 'spark' ? review && review.review_status !== 'unreviewed' ? reviewedStatus : 'Submitted' : record.complete ? 'Complete' : 'In progress',
            score: kind === 'spark' ? (record.evaluation?.automaticTotal > 0 ? record.evaluation.correct ?? '' : '') : record.score ?? '',
            accuracy: kind === 'spark' ? '' : record.accuracy ?? '',
            response: kind === 'spark' ? record.response || '' : '',
            automaticTotal: kind === 'spark' && record.evaluation?.automaticTotal > 0 ? record.evaluation.automaticTotal : '',
            needsTeacherReview: kind === 'spark' ? reviewedStatus === 'Needs review' : false,
            updatedAt: record.updatedAt || record.submitted_at || ''
        };
    });
    const submitted = new Set(rows.map(r => r.studentId));
    for (const student of roster) if (!submitted.has(student.studentId)) {
        rows.push({ studentId: student.studentId, name: student.name, activity: '', status: 'No work submitted',
            feedback: feedback.find(f => f.student_id === student.studentId && f.activity_type === '') || null, responseRevision: null,
            score: '', accuracy: '', response: '', automaticTotal: '', updatedAt: '' });
    }
    return rows;
}
export function csvCell(value) {
    const text = String(value ?? '');
    // Neutralize formula prefixes, including when preceded by whitespace.
    return `"${(/^[\s]*[=+@\-]|^[\t\r\n]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
}
export function assignmentResultsCsv({ rows, studentIds, kind, includeDates = true, className, assignmentTitle }) {
    const selected = new Set(studentIds);
    const columns = ['Class', 'Assignment', 'Student ID', 'Student', 'Status', ...(kind === 'spark'
        ? ['Response', 'Automatic correct', 'Automatic total', 'Written review needed']
        : ['Activity', 'Score', 'Accuracy']), ...(includeDates ? ['Updated at'] : [])];
    const data = rows.filter(row => selected.has(row.studentId)).map(row => [className, assignmentTitle, row.studentId, row.name, row.status,
        ...(kind === 'spark' ? [row.response, row.score, row.automaticTotal, row.status === 'No work submitted' ? '' : row.needsTeacherReview ? 'Yes' : 'No'] : [row.activity, row.score, row.accuracy]),
        ...(includeDates ? [row.updatedAt] : [])]);
    return '\uFEFF' + [columns, ...data].map(row => row.map(csvCell).join(',')).join('\r\n');
}
export function assignmentStatus(assignment, now = Date.now()) {
    if (assignment.withdrawn) return 'Withdrawn';
    if (new Date(assignment.release_at).getTime() > now) return 'Scheduled';
    if (assignment.close_at && new Date(assignment.close_at).getTime() <= now) return 'Closed';
    return 'Available';
}
