import {
    calculateClassReleaseDate,
    calculateVocabularyPlacement,
    normalizeSchoolCalendar
} from '../services/vocabularyApi.js';
import { MONTH_INDEX } from './studentActivityConstants.js';

export class StudentActivitySchedule {
    constructor(activities) {
        this.activities = activities;
    }

    getCurrentTrimesterKey(...args) {
        return this.activities.getCurrentTrimesterKey(...args);
    }

    getVocabSchedule(vocab, date = new Date()) {
        let assignedDate = vocab.assignedDate || '';
        let month = String(vocab.month || '').trim().toLowerCase();
        let week = Number.parseInt(vocab.week, 10);

        if (assignedDate) {
            const placement = calculateVocabularyPlacement(assignedDate, this.activities.schoolCalendar);
            month = placement?.month || month;
            week = Number.parseInt(placement?.week, 10) || week;
        }

        const searchableText = `${vocab.id || ''} ${vocab.name || ''} ${vocab.path || ''}`.toLowerCase();
        if (!month) {
            month = Object.keys(MONTH_INDEX).find(key => searchableText.includes(key)) || '';
        }
        if (!Number.isFinite(week)) {
            const weekMatch = searchableText.match(/week[\s_-]*(\d{1,2})/);
            week = weekMatch ? Number.parseInt(weekMatch[1], 10) : 0;
        }

        if (!month && week > 0) {
            month = this.getMonthFromTrimesterWeek(this.getVocabTrimesterKey(vocab), week);
        }

        if (!month) {
            month = this.getFallbackMonthForTrimester(this.getVocabTrimesterKey(vocab));
        }

        let dueDate = null;
        if (assignedDate) {
            const releaseDate = calculateClassReleaseDate(
                assignedDate,
                this.activities.schoolCalendar,
                this.activities.sm?.studentProfile
            );
            dueDate = new Date(`${releaseDate || assignedDate}T12:00:00`);
        } else if (Number.isFinite(week) && week > 0) {
            dueDate = this.getVocabularyWeekStartDate(vocab, month, week, date);
        }

        if (!dueDate && month && Number.isFinite(week) && week > 0) {
            const year = date.getFullYear();
            dueDate = new Date(year, MONTH_INDEX[month], 1 + ((week - 1) * 7), 12);
        }

        return {
            month,
            week: Number.isFinite(week) ? week : 0,
            dueDate,
            label: [month ? month[0].toUpperCase() + month.slice(1) : '', week ? `Week ${week}` : '']
                .filter(Boolean)
                .join(' ')
        };
    }

    getMonthFromTrimesterWeek(trimester, week) {
        const key = this.getTrimesterKey(trimester);
        if (key === 'IT') {
            if (week <= 4) return 'march';
            if (week <= 8) return 'april';
            return 'may';
        }
        if (key === 'IIT') {
            if (week <= 4) return 'june';
            if (week <= 8) return 'july';
            return 'august';
        }
        if (key === 'IIIT') {
            if (week <= 4) return 'september';
            if (week <= 8) return 'october';
            if (week <= 12) return 'november';
            return 'december';
        }
        return '';
    }

    getFallbackMonthForTrimester(trimester) {
        const key = this.getTrimesterKey(trimester);
        if (key === 'IT') return 'may';
        if (key === 'IIT') return 'august';
        if (key === 'IIIT') return 'december';
        return '';
    }

    getTrimesterKey(trimester) {
        const normalized = String(trimester || '').trim().toUpperCase();
        if (normalized === '1' || normalized === 'IT' || normalized === 'T1') return 'IT';
        if (normalized === '2' || normalized === 'IIT' || normalized === 'T2') return 'IIT';
        if (normalized === '3' || normalized === 'IIIT' || normalized === 'T3') return 'IIIT';
        return 'other';
    }

    getVocabTrimesterKey(vocab) {
        if (vocab?.assignedDate) {
            const placement = calculateVocabularyPlacement(vocab.assignedDate, this.activities.schoolCalendar);
            if (placement?.trimester) return placement.trimester;
        }

        return this.getTrimesterKey(vocab?.trimester);
    }

    getTrimesterLabel(trimester) {
        const key = this.getTrimesterKey(trimester);
        if (key === 'IT') return 'IT';
        if (key === 'IIT') return 'IIT';
        if (key === 'IIIT') return 'IIIT';
        return 'Other Units';
    }

    getTrimesterOrder(trimester) {
        const order = {
            IT: 1,
            IIT: 2,
            IIIT: 3,
            other: 99
        };

        return order[this.getTrimesterKey(trimester)] || order.other;
    }

    formatUnitCount(count) {
        return `${count} ${count === 1 ? 'unit' : 'units'}`;
    }

    formatMonthSummary(monthGroups) {
        return Array.from(monthGroups.entries())
            .sort(([monthA], [monthB]) => this.getMonthOrder(monthA) - this.getMonthOrder(monthB))
            .map(([monthKey, monthVocabs]) => `${this.getMonthLabel(monthKey)}: ${monthVocabs.length}`)
            .join(' · ');
    }

    buildVocabularyTrimesterGroups(vocabs = []) {
        return vocabs.reduce((groups, vocab) => {
            const trimesterKey = this.getVocabTrimesterKey(vocab);
            if (!groups.has(trimesterKey)) groups.set(trimesterKey, []);
            groups.get(trimesterKey).push(vocab);
            return groups;
        }, new Map());
    }

    buildVocabularyMonthGroups(vocabs = []) {
        return vocabs.reduce((groups, vocab) => {
            const monthKey = this.getVocabCalendarMonthKey(vocab);
            if (!groups.has(monthKey)) groups.set(monthKey, []);
            groups.get(monthKey).push(vocab);
            return groups;
        }, new Map());
    }

    normalizeMonthKey(month) {
        const value = String(month || '').trim().toLowerCase();
        const aliases = {
            january: 'january',
            jan: 'january',
            february: 'february',
            feb: 'february',
            march: 'march',
            mar: 'march',
            april: 'april',
            apr: 'april',
            may: 'may',
            june: 'june',
            jun: 'june',
            july: 'july',
            jul: 'july',
            august: 'august',
            aug: 'august',
            september: 'september',
            sept: 'september',
            sep: 'september',
            october: 'october',
            oct: 'october',
            november: 'november',
            nov: 'november',
            december: 'december',
            dec: 'december'
        };

        return aliases[value] || 'other';
    }

    getMonthLabel(monthKey) {
        const labels = {
            january: 'January',
            february: 'February',
            march: 'March',
            april: 'April',
            may: 'May',
            june: 'June',
            july: 'July',
            august: 'August',
            september: 'September',
            october: 'October',
            november: 'November',
            december: 'December',
            other: 'Other'
        };

        return labels[monthKey] || labels.other;
    }

    getMonthOrder(monthKey) {
        if (monthKey in MONTH_INDEX) return MONTH_INDEX[monthKey] + 1;
        return 99;
    }

    compareVocabularySchedule(a, b) {
        const scheduleA = this.getVocabSchedule(a);
        const scheduleB = this.getVocabSchedule(b);
        const dateA = scheduleA.dueDate?.getTime?.() || 0;
        const dateB = scheduleB.dueDate?.getTime?.() || 0;

        if (dateA !== dateB) {
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateA - dateB;
        }

        if (scheduleA.week !== scheduleB.week) {
            return (scheduleA.week || 99) - (scheduleB.week || 99);
        }

        return String(a.name || '').localeCompare(String(b.name || ''));
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
