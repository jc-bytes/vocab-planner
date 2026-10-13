import {
    addUtcDateOnlyDays,
    formatUtcDateOnly,
    parseUtcDateOnly
} from '../services/dateOnly.js';
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

export function getWeekBounds(value) {
    const date = parseUtcDateOnly(value);
    if (!date) return { start: '', end: '' };
    const day = date.getUTCDay() || 7;
    const start = formatUtcDateOnly(new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() - day + 1
    )));
    return { start, end: addUtcDateOnlyDays(start, 6) };
}

export function getMonthValue(value) {
    return normalizeSparkDate(value).slice(0, 7);
}

export function formatShortDate(value) {
    const date = parseUtcDateOnly(value);
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
