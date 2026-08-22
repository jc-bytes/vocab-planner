import { getPanamaDateValue, timestampMillis } from '../services/dateUtils.js';
import { normalizeSparkGradeQuestions, SPARK_GRADE_LEVELS } from '../sparkModel.js';
import { SPARK_TYPE_FILTERS, SPARK_TYPE_META, SPARK_VIEW_TABS } from './sparkLibraryConfig.js';
import {
    compareSparkSchedule,
    compareSparkScheduleAscending,
    formatShortDate,
    getMonthValue,
    getWeekBounds,
    isInDateRange
} from './sparkSchedule.js';

export const teacherSparkLibraryModelMethods = {
getSparkLibraryData() {
        const today = getPanamaDateValue();
        const scheduled = this.weeklySparkItems
            .filter(spark => spark.status === 'scheduled')
            .sort(compareSparkScheduleAscending);
        const currentAndPrevious = scheduled
            .filter(spark => spark.scheduledDate && spark.scheduledDate <= today)
            .sort(compareSparkSchedule);
        const currentSpark = currentAndPrevious[0] || null;
        const currentId = currentSpark?.id || '';
        const weekBounds = getWeekBounds(today);
        const weekSparks = scheduled.filter(spark => isInDateRange(spark.scheduledDate, weekBounds.start, weekBounds.end));
        const nextSparks = scheduled
            .filter(spark => spark.scheduledDate && spark.scheduledDate > today)
            .slice(0, 4);
        const drafts = this.weeklySparkItems
            .filter(spark => spark.status === 'draft')
            .sort((a, b) => timestampMillis(b.updatedAt) - timestampMillis(a.updatedAt));
        const archived = this.weeklySparkItems
            .filter(spark => spark.status === 'archived')
            .sort(compareSparkSchedule);
        const activeSparks = this.weeklySparkItems
            .filter(spark => spark.status !== 'archived')
            .sort(compareSparkScheduleAscending);
        const monthOptions = Array.from(new Set(scheduled
            .map(spark => getMonthValue(spark.scheduledDate))
            .filter(Boolean)))
            .sort();
        const todayMonth = getMonthValue(today);
        if (!monthOptions.includes(this.weeklySparkMonth)) {
            const nextMonth = monthOptions.find(month => month >= todayMonth);
            this.weeklySparkMonth = monthOptions.includes(todayMonth)
                ? todayMonth
                : nextMonth || getMonthValue(currentSpark?.scheduledDate) || monthOptions[0] || todayMonth;
        }
        if (!SPARK_TYPE_FILTERS.some(type => type.id === this.weeklySparkTypeFilter)) {
            this.weeklySparkTypeFilter = 'all';
        }
        if (!SPARK_VIEW_TABS.some(tab => tab.id === this.weeklySparkActiveView)) {
            this.weeklySparkActiveView = 'week';
        }

        const selectedMonthSparks = scheduled.filter(spark => getMonthValue(spark.scheduledDate) === this.weeklySparkMonth);
        const sparkOfMonth = selectedMonthSparks.find(spark => spark.id === currentId)
            || selectedMonthSparks.find(spark => spark.scheduledDate >= today)
            || selectedMonthSparks[0]
            || null;
        const typeCounts = activeSparks.reduce((counts, spark) => {
            counts[spark.sparkType] = (counts[spark.sparkType] || 0) + 1;
            return counts;
        }, {});

        return {
            today,
            weekBounds,
            scheduled,
            currentSpark,
            currentId,
            weekSparks,
            nextSparks,
            drafts,
            archived,
            activeSparks,
            monthOptions,
            selectedMonthSparks,
            sparkOfMonth,
            typeCounts
        };
    },

groupSparksByWeek(sparks) {
        const groups = new Map();
        sparks.forEach(spark => {
            const bounds = getWeekBounds(spark.scheduledDate);
            const key = bounds.start || 'unscheduled';
            if (!groups.has(key)) {
                groups.set(key, { ...bounds, items: [] });
            }
            groups.get(key).items.push(spark);
        });
        return Array.from(groups.values())
            .map(group => ({
                ...group,
                items: group.items.sort(compareSparkScheduleAscending)
            }))
            .sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));
    },

formatSparkStatusLabel(status) {
        if (status === 'scheduled') return 'Scheduled';
        if (status === 'archived') return 'Archived';
        return 'Draft';
    },

formatSparkDateLabel(spark) {
        if (!spark.scheduledDate) return 'No scheduled date';
        return `Starts ${formatShortDate(spark.scheduledDate)}`;
    },

getSparkTypeLabel(sparkType) {
        return (SPARK_TYPE_META[sparkType] || SPARK_TYPE_META.cool_fact).label;
    },

getSparkGradeQuestionEntries(spark) {
        const questions = normalizeSparkGradeQuestions(spark?.gradeQuestions);
        return SPARK_GRADE_LEVELS
            .map(grade => [grade, questions[grade] || ''])
            .filter(([, question]) => question);
    },

selectSparkView(view) {
        if (!SPARK_VIEW_TABS.some(tab => tab.id === view)) return;
        this.weeklySparkActiveView = view;
        this.refreshSparkLibrarySurface();
    },

selectSparkTypeFilter(type) {
        if (!SPARK_TYPE_FILTERS.some(item => item.id === type)) return;
        this.weeklySparkTypeFilter = type;
        this.weeklySparkActiveView = 'types';
        this.refreshSparkLibrarySurface();
    },

selectSparkMonth(month) {
        if (!/^\d{4}-\d{2}$/.test(String(month || ''))) return;
        this.weeklySparkMonth = month;
        this.weeklySparkActiveView = 'month';
        this.refreshSparkLibrarySurface();
    },

shiftSparkMonth(offset) {
        const data = this.getSparkLibraryData();
        if (data.monthOptions.length === 0) return;
        const currentIndex = Math.max(0, data.monthOptions.indexOf(this.weeklySparkMonth));
        const nextIndex = Math.min(data.monthOptions.length - 1, Math.max(0, currentIndex + offset));
        this.weeklySparkMonth = data.monthOptions[nextIndex];
        this.weeklySparkActiveView = 'month';
        this.refreshSparkLibrarySurface();
    },

findSparkById(id) {
        return this.weeklySparkItems.find(spark => spark.id === id) || null;
    },
};

