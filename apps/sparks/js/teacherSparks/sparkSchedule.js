import { timestampMillis } from '../services/dateUtils.js';
import { normalizeSparkDate } from '../sparkModel.js';

export function compareSparkSchedule(a, b) {
    const dateCompare = String(b.scheduledDate || '').localeCompare(String(a.scheduledDate || ''));
    if (dateCompare !== 0) return dateCompare;
    return timestampMillis(b.updatedAt) - timestampMillis(a.updatedAt);
}

export function compareSparkScheduleAscending(a, b) {
    const dateCompare = String(a.scheduledDate || '9999-12-31').localeCompare(String(b.scheduledDate || '9999-12-31'));
    if (dateCompare !== 0) return dateCompare;
    return timestampMillis(b.updatedAt) - timestampMillis(a.updatedAt);
}

function parseDateValue(value) {
    const normalized = normalizeSparkDate(value);
    if (!normalized) return null;
    const [year, month, day] = normalized.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

function toDateValue(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDays(value, days) {
    const date = parseDateValue(value);
    if (!date) return '';
    date.setUTCDate(date.getUTCDate() + days);
    return toDateValue(date);
}

export function getWeekBounds(value) {
    const date = parseDateValue(value);
    if (!date) return { start: '', end: '' };
    const day = date.getUTCDay() || 7;
    const start = toDateValue(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day + 1)));
    return { start, end: addDays(start, 6) };
}

export function getMonthValue(value) {
    return normalizeSparkDate(value).slice(0, 7);
}

export function formatShortDate(value) {
    const date = parseDateValue(value);
    if (!date) return 'No date';
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric'
    }).format(date);
}

export function formatMonthLabel(value) {
    const monthValue = String(value || '').trim();
    if (!/^\d{4}-\d{2}$/.test(monthValue)) return 'No month';
    const [year, month] = monthValue.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        month: 'long',
        year: 'numeric'
    }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function isInDateRange(value, start, end) {
    const normalized = normalizeSparkDate(value);
    return normalized && normalized >= start && normalized <= end;
}

export function isDuplicateScheduledDateError(error) {
    const text = String(error?.message || error || '').toLowerCase();
    return error?.code === '23505'
        || text.includes('weekly_sparks_unique_scheduled_date_idx')
        || text.includes('weekly_sparks_unique_subject_scheduled_date_idx')
        || (text.includes('duplicate key') && text.includes('scheduled_date'));
}
