import { normalizeSchoolCalendar } from '../services/vocabularyApi.js';
import { MONTH_INDEX } from './studentActivityConstants.js';

export class StudentActivityAvailability {
    constructor(schedule) {
        this.schedule = schedule;
        this.activities = schedule.activities;
    }

    getCurrentTrimesterKey(...args) {
        return this.schedule.getCurrentTrimesterKey(...args);
    }

    getMonthFromTrimesterWeek(...args) {
        return this.schedule.getMonthFromTrimesterWeek(...args);
    }

    getTrimesterKey(...args) {
        return this.schedule.getTrimesterKey(...args);
    }

    getVocabSchedule(...args) {
        return this.schedule.getVocabSchedule(...args);
    }

    getVocabTrimesterKey(...args) {
        return this.schedule.getVocabTrimesterKey(...args);
    }

    normalizeMonthKey(...args) {
        return this.schedule.normalizeMonthKey(...args);
    }

    getCurrentScheduleWindow(date = new Date()) {
        const currentDate = date instanceof Date && !Number.isNaN(date.getTime())
            ? date
            : new Date();
        const monthKey = this.getMonthKeyFromIndex(currentDate.getMonth());

        return {
            date: currentDate,
            trimester: this.getCurrentTrimesterKey(currentDate),
            month: monthKey,
            monthIndex: currentDate.getMonth()
        };
    }

    getDateOnlyStart(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    }

    getMonthKeyFromIndex(monthIndex) {
        return Object.entries(MONTH_INDEX)
            .find(([, index]) => index === monthIndex)?.[0] || 'other';
    }

    getSchoolWeekMajorityMonth(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'other';
        const counts = new Map();

        for (let offset = 0; offset < 5; offset += 1) {
            const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset, 12);
            const monthKey = this.getMonthKeyFromIndex(candidate.getMonth());
            counts.set(monthKey, (counts.get(monthKey) || 0) + 1);
        }

        return Array.from(counts.entries())
            .sort(([, countA], [, countB]) => countB - countA)[0]?.[0] || this.getMonthKeyFromIndex(date.getMonth());
    }

    getVocabCalendarMonthKey(vocab, date = new Date()) {
        const schedule = this.getVocabSchedule(vocab, date);
        if (schedule.dueDate instanceof Date && !Number.isNaN(schedule.dueDate.getTime())) {
            return this.getSchoolWeekMajorityMonth(schedule.dueDate);
        }
        return this.normalizeMonthKey(schedule.month);
    }

    filterStudentAvailableVocabulary(vocabs = [], date = new Date()) {
        return vocabs.filter(vocab => this.isStudentVocabularyAvailable(vocab, date));
    }

    isStudentVocabularyAvailable(vocab, date = new Date()) {
        const currentWindow = this.getCurrentScheduleWindow(date);
        const currentMonthStart = new Date(
            currentWindow.date.getFullYear(),
            currentWindow.monthIndex,
            1,
            12
        );
        const schedule = this.getVocabSchedule(vocab, date);
        const trimesterKey = this.getVocabTrimesterKey(vocab);
        const monthKey = this.getVocabCalendarMonthKey(vocab, date);
        const monthIndex = MONTH_INDEX[monthKey];

        if (trimesterKey !== 'other' && trimesterKey !== currentWindow.trimester) {
            return false;
        }

        if (schedule.dueDate instanceof Date && !Number.isNaN(schedule.dueDate.getTime())) {
            const scheduleStart = this.getDateOnlyStart(schedule.dueDate);
            const currentStart = this.getDateOnlyStart(currentWindow.date);
            if (scheduleStart && currentStart) {
                if (!Number.isFinite(monthIndex)) return scheduleStart <= currentStart;

                const calendar = normalizeSchoolCalendar(this.activities.schoolCalendar, date);
                const schoolYear = Number.parseInt(calendar.schoolYear, 10) || date.getFullYear();
                const scheduledMonthStart = new Date(schedule.dueDate.getFullYear() || schoolYear, monthIndex, 1, 12);
                return scheduleStart <= currentStart && scheduledMonthStart <= currentMonthStart;
            }
        }

        if (!Number.isFinite(monthIndex)) {
            return true;
        }

        const calendar = normalizeSchoolCalendar(this.activities.schoolCalendar, date);
        const schoolYear = Number.parseInt(calendar.schoolYear, 10) || date.getFullYear();
        const scheduledYear = schedule.dueDate instanceof Date && !Number.isNaN(schedule.dueDate.getTime())
            ? schedule.dueDate.getFullYear()
            : schoolYear;
        const scheduledMonthStart = new Date(scheduledYear, monthIndex, 1, 12);

        return scheduledMonthStart <= currentMonthStart;
    }

    getTrimesterWeekStartDate(trimester, week, date = new Date()) {
        const trimesterKey = this.getTrimesterKey(trimester);
        const weekNumber = Number.parseInt(week, 10);
        if (!Number.isFinite(weekNumber) || weekNumber <= 0 || trimesterKey === 'other') {
            return null;
        }

        const calendar = normalizeSchoolCalendar(this.activities.schoolCalendar, date);
        const startDate = this.parseLocalDateOnly(calendar.trimesters?.[trimesterKey]?.startDate);
        if (!startDate) return null;

        return new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            startDate.getDate() + ((weekNumber - 1) * 7),
            12
        );
    }

    getVocabularyWeekStartDate(vocab, month, week, date = new Date()) {
        if (this.usesTrimesterWeekDate(vocab)) {
            const trimesterWeekStart = this.getTrimesterWeekStartDate(this.getVocabTrimesterKey(vocab), week, date);
            return this.alignDateToLabelMonth(trimesterWeekStart, month) || trimesterWeekStart;
        }

        return this.getMonthWeekStartDate(month, week, this.getVocabTrimesterKey(vocab), date);
    }

    usesTrimesterWeekDate(vocab) {
        const grades = Array.isArray(vocab?.grades) ? vocab.grades : [vocab?.grade];
        const numericGrades = grades
            .map(grade => Number.parseInt(grade, 10))
            .filter(Number.isFinite);

        if (numericGrades.some(grade => grade >= 7)) return true;
        return numericGrades.includes(6) && this.getVocabTrimesterKey(vocab) === 'IIT';
    }

    getMonthWeekStartDate(month, week, trimester, date = new Date()) {
        const monthIndex = MONTH_INDEX[month];
        const weekNumber = Number.parseInt(week, 10);
        if (!Number.isFinite(monthIndex) || !Number.isFinite(weekNumber) || weekNumber <= 0) {
            return null;
        }

        const calendar = normalizeSchoolCalendar(this.activities.schoolCalendar, date);
        const year = Number.parseInt(calendar.schoolYear, 10) || date.getFullYear();
        const range = calendar.trimesters?.[this.getTrimesterKey(trimester)];
        const rangeStart = this.parseLocalDateOnly(range?.startDate);
        const rangeEnd = this.parseLocalDateOnly(range?.endDate);
        let firstActiveDay = new Date(year, monthIndex, 1, 12);

        if (rangeStart && firstActiveDay < rangeStart) {
            firstActiveDay = rangeStart;
        }
        if (rangeEnd && firstActiveDay > rangeEnd) {
            return null;
        }

        firstActiveDay = this.advanceToWeekday(firstActiveDay);
        if (firstActiveDay.getMonth() !== monthIndex) return null;

        return new Date(
            firstActiveDay.getFullYear(),
            firstActiveDay.getMonth(),
            firstActiveDay.getDate() + ((weekNumber - 1) * 7),
            12
        );
    }

    alignDateToLabelMonth(date, month) {
        const monthIndex = MONTH_INDEX[month];
        if (!(date instanceof Date) || Number.isNaN(date.getTime()) || !Number.isFinite(monthIndex)) {
            return null;
        }
        if (date.getMonth() === monthIndex && this.isWeekday(date)) return date;

        for (let offset = 1; offset <= 6; offset += 1) {
            const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset, 12);
            if (candidate.getMonth() === monthIndex && this.isWeekday(candidate)) {
                return candidate;
            }
        }

        return date;
    }

    advanceToWeekday(date) {
        let candidate = date;
        while (!this.isWeekday(candidate)) {
            candidate = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate() + 1, 12);
        }
        return candidate;
    }

    isWeekday(date) {
        const day = date.getDay();
        return day >= 1 && day <= 5;
    }

    parseLocalDateOnly(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
        const [year, month, day] = String(value).split('-').map(Number);
        const date = new Date(year, month - 1, day, 12);
        if (
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day
        ) {
            return null;
        }
        return date;
    }

}
