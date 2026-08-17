import { getCurrentSchoolYear } from './supabaseValues.js';

export { getCurrentSchoolYear };

export const SCHOOL_CALENDAR_SETTINGS_KEY = 'schoolCalendar';

export const SCHOOL_CALENDAR_LOCAL_KEY = 'dev_school_calendar';

const MONTH_KEYS = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december'
];

export const SCHOOL_WEEKDAYS = Object.freeze([
    { value: 1, key: 'monday', shortLabel: 'Mon' },
    { value: 2, key: 'tuesday', shortLabel: 'Tue' },
    { value: 3, key: 'wednesday', shortLabel: 'Wed' },
    { value: 4, key: 'thursday', shortLabel: 'Thu' },
    { value: 5, key: 'friday', shortLabel: 'Fri' }
]);

const DEFAULT_SCHOOL_CALENDARS = Object.freeze({
    '2026': Object.freeze({
        trimesters: Object.freeze({
            IT: Object.freeze({ startDate: '2026-03-02', endDate: '2026-05-29', weekCount: 13 }),
            IIT: Object.freeze({ startDate: '2026-06-08', endDate: '2026-09-04', weekCount: 13 }),
            IIIT: Object.freeze({ startDate: '2026-09-14', endDate: '2026-12-11', weekCount: 13 })
        })
    })
});

function parseDateOnly(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }
    return date;
}

function toDateOnly(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const date = parseDateOnly(value);
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
}

function addDaysDateOnly(date, days) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const result = new Date(date.getTime());
    result.setUTCDate(result.getUTCDate() + Number(days || 0));
    return result.toISOString().slice(0, 10);
}

function normalizeWeekCount(value) {
    const weekCount = Number.parseInt(String(value || ''), 10);
    return Number.isInteger(weekCount) && weekCount > 0 ? weekCount : '';
}

export function getMonthKeyFromDate(value) {
    const date = parseDateOnly(value);
    return date ? MONTH_KEYS[date.getUTCMonth()] : '';
}

export function calculateCalendarEndDateFromWeekCount(startDate, weekCount) {
    const start = parseDateOnly(startDate);
    const weeks = normalizeWeekCount(weekCount);
    if (!start || !weeks) return '';
    return addDaysDateOnly(start, ((weeks - 1) * 7) + 4);
}

export function calculateCalendarWeekCount(startDate, endDate) {
    const start = parseDateOnly(startDate);
    const end = parseDateOnly(endDate);
    if (!start || !end || end < start) return '';

    const daysSinceStart = Math.floor((end.getTime() - start.getTime()) / 86400000);
    return Math.floor(daysSinceStart / 7) + 1;
}

export function calculateCalendarWeekRange(startDate, weekNumber) {
    const start = parseDateOnly(startDate);
    const week = normalizeWeekCount(weekNumber);
    if (!start || !week) return { startDate: '', endDate: '' };

    const weekStartDate = addDaysDateOnly(start, (week - 1) * 7);
    const weekStart = parseDateOnly(weekStartDate);
    return {
        startDate: weekStartDate,
        endDate: addDaysDateOnly(weekStart, 4)
    };
}

export function getDefaultSchoolCalendar(date = new Date()) {
    const schoolYear = getCurrentSchoolYear(date);
    const defaults = DEFAULT_SCHOOL_CALENDARS[schoolYear]?.trimesters || {};

    return {
        schoolYear,
        trimesters: {
            IT: { startDate: defaults.IT?.startDate || '', endDate: defaults.IT?.endDate || '', weekCount: defaults.IT?.weekCount || '' },
            IIT: { startDate: defaults.IIT?.startDate || '', endDate: defaults.IIT?.endDate || '', weekCount: defaults.IIT?.weekCount || '' },
            IIIT: { startDate: defaults.IIIT?.startDate || '', endDate: defaults.IIIT?.endDate || '', weekCount: defaults.IIIT?.weekCount || '' }
        }
    };
}

function normalizeTrimesterRange(sourceRange = {}, fallbackRange = {}) {
    const startDate = toDateOnly(sourceRange.startDate) || fallbackRange.startDate || '';
    const sourceWeekCount = normalizeWeekCount(sourceRange.weekCount || sourceRange.weeks);
    const endDate = toDateOnly(sourceRange.endDate)
        || calculateCalendarEndDateFromWeekCount(startDate, sourceWeekCount)
        || fallbackRange.endDate
        || '';
    const weekCount = sourceWeekCount
        || calculateCalendarWeekCount(startDate, endDate)
        || fallbackRange.weekCount
        || '';

    return { startDate, endDate, weekCount };
}

function normalizeClassWeekday(value) {
    const numeric = Number.parseInt(String(value), 10);
    if (numeric >= 1 && numeric <= 5) return numeric;

    const normalized = String(value || '').trim().toLowerCase();
    const aliases = {
        mon: 1, monday: 1,
        tue: 2, tues: 2, tuesday: 2,
        wed: 3, wednesday: 3,
        thu: 4, thur: 4, thurs: 4, thursday: 4,
        fri: 5, friday: 5
    };
    return aliases[normalized] || null;
}

export function normalizeClassSchedules(classSchedules = []) {
    const byClass = new Map();

    (Array.isArray(classSchedules) ? classSchedules : []).forEach(schedule => {
        const grade = String(schedule?.grade ?? schedule?.gradeLevel ?? '').match(/\d+/)?.[0] || '';
        const section = String(schedule?.section ?? schedule?.group ?? '').trim().toUpperCase();
        const weekdays = [...new Set((Array.isArray(schedule?.weekdays) ? schedule.weekdays : [])
            .map(normalizeClassWeekday)
            .filter(Boolean))].sort((a, b) => a - b);

        if (!grade || !section || weekdays.length === 0) return;
        byClass.set(`${grade}:${section}`, { grade, section, weekdays });
    });

    return Array.from(byClass.values()).sort((a, b) => (
        Number(a.grade) - Number(b.grade) || a.section.localeCompare(b.section)
    ));
}

export function getStudentClassSchedule(calendar, profile = {}) {
    const grade = String(profile.grade ?? profile.gradeLevel ?? profile.grade_level ?? '').match(/\d+/)?.[0] || '';
    const section = String(profile.group ?? profile.section ?? profile.sectionLetter ?? profile.section_letter ?? '')
        .trim()
        .toUpperCase();
    if (!grade || !section) return null;

    return normalizeClassSchedules(calendar?.classSchedules)
        .find(schedule => schedule.grade === grade && schedule.section === section) || null;
}

export function calculateClassReleaseDate(assignedDate, calendar, profile = {}) {
    const assigned = parseDateOnly(assignedDate);
    if (!assigned) return '';

    const schedule = getStudentClassSchedule(calendar, profile);
    if (!schedule) return toDateOnly(assignedDate);

    for (let offset = 0; offset < 7; offset += 1) {
        const candidate = new Date(assigned.getTime());
        candidate.setUTCDate(candidate.getUTCDate() + offset);
        if (schedule.weekdays.includes(candidate.getUTCDay())) {
            return candidate.toISOString().slice(0, 10);
        }
    }

    return toDateOnly(assignedDate);
}

export function normalizeSchoolCalendar(calendar, fallbackDate = new Date()) {
    const source = calendar && typeof calendar === 'object' ? calendar : {};
    const schoolYear = String(source.schoolYear || getCurrentSchoolYear(fallbackDate));
    const fallbackYear = /^\d{4}$/.test(schoolYear)
        ? Number(schoolYear)
        : Number(getCurrentSchoolYear(fallbackDate));
    const fallback = getDefaultSchoolCalendar(new Date(fallbackYear, 0, 1, 12));
    const sourceTrimesters = source.trimesters && typeof source.trimesters === 'object'
        ? source.trimesters
        : {};

    return {
        schoolYear,
        classSchedules: normalizeClassSchedules(source.classSchedules || source.class_schedules),
        trimesters: {
            IT: normalizeTrimesterRange(sourceTrimesters.IT, fallback.trimesters.IT),
            IIT: normalizeTrimesterRange(sourceTrimesters.IIT, fallback.trimesters.IIT),
            IIIT: normalizeTrimesterRange(sourceTrimesters.IIIT, fallback.trimesters.IIIT)
        }
    };
}

export function calculateVocabularyPlacement(assignedDate, calendar) {
    const date = parseDateOnly(assignedDate);
    if (!date) return null;

    const normalizedCalendar = normalizeSchoolCalendar(calendar, date);
    const month = getMonthKeyFromDate(assignedDate);

    for (const trimester of ['IT', 'IIT', 'IIIT']) {
        const range = normalizedCalendar.trimesters[trimester];
        const startDate = parseDateOnly(range.startDate);
        const endDate = parseDateOnly(range.endDate);

        if (!startDate || !endDate || date < startDate || date > endDate) continue;

        const daysSinceStart = Math.floor((date.getTime() - startDate.getTime()) / 86400000);
        return {
            assignedDate: toDateOnly(assignedDate),
            trimester,
            month,
            week: Math.floor(daysSinceStart / 7) + 1
        };
    }

    return {
        assignedDate: toDateOnly(assignedDate),
        month,
        trimester: '',
        week: ''
    };
}

export function getCurrentTrimesterFromCalendar(date = new Date(), calendar = null) {
    const dateOnly = toDateOnly(date);
    const placement = calculateVocabularyPlacement(dateOnly, calendar);
    return placement?.trimester || '';
}

