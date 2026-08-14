import {
    calculateClassReleaseDate,
    calculateVocabularyPlacement
} from '../services/vocabularyApi.js';
import { MONTH_INDEX } from './studentActivityConstants.js';
import { StudentActivityAvailability } from './studentActivityAvailability.js';

export class StudentActivitySchedule {
    constructor(activities) {
        this.activities = activities;
        this.availability = new StudentActivityAvailability(this);
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

    getTrimesterShortLabel(trimester) {
        return this.getTrimesterLabel(trimester);
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
        return this.availability.getCurrentScheduleWindow(date);
    }

    getDateOnlyStart(date) {
        return this.availability.getDateOnlyStart(date);
    }

    getMonthKeyFromIndex(monthIndex) {
        return this.availability.getMonthKeyFromIndex(monthIndex);
    }

    getSchoolWeekMajorityMonth(date) {
        return this.availability.getSchoolWeekMajorityMonth(date);
    }

    getVocabCalendarMonthKey(vocab, date = new Date()) {
        return this.availability.getVocabCalendarMonthKey(vocab, date);
    }

    filterStudentAvailableVocabulary(vocabs = [], date = new Date()) {
        return this.availability.filterStudentAvailableVocabulary(vocabs, date);
    }

    isStudentVocabularyAvailable(vocab, date = new Date()) {
        return this.availability.isStudentVocabularyAvailable(vocab, date);
    }

    getTrimesterWeekStartDate(trimester, week, date = new Date()) {
        return this.availability.getTrimesterWeekStartDate(trimester, week, date);
    }

    getVocabularyWeekStartDate(vocab, month, week, date = new Date()) {
        return this.availability.getVocabularyWeekStartDate(vocab, month, week, date);
    }

    usesTrimesterWeekDate(vocab) {
        return this.availability.usesTrimesterWeekDate(vocab);
    }

    getMonthWeekStartDate(month, week, trimester, date = new Date()) {
        return this.availability.getMonthWeekStartDate(month, week, trimester, date);
    }

    alignDateToLabelMonth(date, month) {
        return this.availability.alignDateToLabelMonth(date, month);
    }

    advanceToWeekday(date) {
        return this.availability.advanceToWeekday(date);
    }

    isWeekday(date) {
        return this.availability.isWeekday(date);
    }

    parseLocalDateOnly(value) {
        return this.availability.parseLocalDateOnly(value);
    }

}
