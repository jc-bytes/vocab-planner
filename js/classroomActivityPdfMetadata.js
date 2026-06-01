import { ReportGenerator } from './reportGenerator.js';

function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value.seconds !== undefined) return new Date(Number(value.seconds) * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateOnly(value) {
    if (!value) return 'Not set';
    const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
        ? new Date(`${value.slice(0, 10)}T12:00:00`)
        : toDate(value);
    if (!date || Number.isNaN(date.getTime())) return 'Not set';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value) {
    const date = toDate(value);
    if (!date) return '';
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

export function formatSubmittedStatus(submission = {}) {
    if (submission.status === 'submitted') {
        const submittedAt = formatDateTime(submission.submittedAt || submission.submitted_at);
        return submittedAt ? `Submitted on ${submittedAt}` : 'Submitted';
    }

    return 'Draft';
}

function slugForFilename(value, fallback = 'item') {
    const slug = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || fallback;
}

function getIsoDate(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

export function buildDownloadFileName(assignment = {}, studentProfile = {}) {
    const { fullName } = ReportGenerator.getStudentInfo(studentProfile);
    return [
        'classroom-activity',
        slugForFilename(assignment.title, 'activity'),
        slugForFilename(fullName, 'student'),
        getIsoDate()
    ].join('-') + '.pdf';
}
