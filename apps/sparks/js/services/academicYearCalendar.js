import { calculateCalendarWeekCount } from './schoolCalendar.js';
import { parseUtcDateOnly } from './dateOnly.js';

export const ACADEMIC_TRIMESTERS = [['IT', 'Trimester 1'], ['IIT', 'Trimester 2'], ['IIIT', 'Trimester 3']];

export function getAcademicYearCalendar(calendar, year) {
    if (String(calendar?.schoolYear) === String(year)) return calendar;
    return calendar?.academicYears?.[String(year)] || null;
}

export function withAcademicYearCalendar(calendar = {}, year, dates) {
    const trimesters = {};
    let previousEnd = '';
    for (const [key, label] of ACADEMIC_TRIMESTERS) {
        const { startDate = '', endDate = '' } = dates[key] || {};
        if (!parseUtcDateOnly(startDate) || !parseUtcDateOnly(endDate)) throw new Error(`${label} needs a valid start and end date.`);
        if (startDate > endDate) throw new Error(`${label} must end on or after its start date.`);
        if (previousEnd && startDate <= previousEnd) throw new Error(`${label} must start after the previous trimester ends.`);
        trimesters[key] = { startDate, endDate, weekCount: calculateCalendarWeekCount(startDate, endDate) };
        previousEnd = endDate;
    }
    const academicYears = { ...calendar.academicYears };
    if (calendar.schoolYear && calendar.trimesters) academicYears[String(calendar.schoolYear)] = { schoolYear: String(calendar.schoolYear), trimesters: calendar.trimesters };
    academicYears[String(year)] = { schoolYear: String(year), trimesters };
    return {
        ...calendar,
        ...(!calendar.schoolYear || String(calendar.schoolYear) === String(year) ? { schoolYear: String(year), trimesters } : {}),
        academicYears
    };
}
