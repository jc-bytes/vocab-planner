import {
    MONTH_ORDER,
    MONTH_TRIMESTER,
    THIS_WEEK_SECTION,
    TRIMESTER_LABELS
} from './studentClassroomActivityBrowserConstants.js';

export const studentClassroomActivityPlanningMethods = {
    normalizeClassroomDrilldown(route = {}) {
        if (route.section === THIS_WEEK_SECTION) {
            return {
                section: THIS_WEEK_SECTION,
                trimester: null,
                month: null,
                week: null
            };
        }

        return {
            section: null,
            trimester: route.trimester || null,
            month: route.month || null,
            week: route.week || null
        };
    },

    navigateToClassroomFolder(drilldown = {}) {
        const normalized = this.normalizeClassroomDrilldown(drilldown);
        this.sm.studentClassroomActivityDrilldown = normalized;
        this.sm.navigateTo({
            view: 'classroom-activities',
            ...normalized
        });
    },

    formatAssignmentCount(count) {
        return `${count} ${count === 1 ? 'activity' : 'activities'}`;
    },

    getTrimesterLabel(trimesterKey) {
        return TRIMESTER_LABELS[trimesterKey] || TRIMESTER_LABELS.other;
    },

    getTrimesterOrder(trimesterKey) {
        return { IT: 1, IIT: 2, IIIT: 3, other: 99 }[trimesterKey] || 99;
    },

    getMonthLabel(monthKey) {
        if (!monthKey || monthKey === 'unscheduled') return 'Unscheduled';
        return String(monthKey)
            .split('-')
            .map(part => part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : '')
            .filter(Boolean)
            .join('-');
    },

    getMonthOrder(monthKey) {
        const parts = String(monthKey || '').split('-').filter(Boolean);
        const firstMonth = parts[0] || '';
        const secondMonth = parts[1] || '';
        const firstOrder = MONTH_ORDER[firstMonth] || 99;
        const secondOrder = MONTH_ORDER[secondMonth] || firstOrder;
        return firstOrder + (secondOrder > firstOrder ? 0.5 : 0);
    },

    formatWeekLabelFromKey(weekKey) {
        if (!weekKey || weekKey === 'unscheduled') return 'Unscheduled';
        const match = String(weekKey).match(/^week-(\d+)(?:-(\d+))?$/);
        if (!match) return 'Week';
        return match[2] ? `Weeks ${match[1]}-${match[2]}` : `Week ${match[1]}`;
    },

    getAssignmentPlanningPlacement(assignment = {}) {
        const label = String(assignment.weekLabel || '').trim();
        const monthMatch = label.match(/^([A-Za-z]+(?:-[A-Za-z]+)?)/);
        const month = monthMatch ? monthMatch[1].toLowerCase() : 'unscheduled';
        const firstMonth = month.split('-')[0];
        const trimester = MONTH_TRIMESTER[firstMonth] || 'other';
        const weekMatch = label.match(/\bWeeks?\s+(\d+)(?:\s*-\s*(\d+))?/i);
        const weekStart = weekMatch ? Number.parseInt(weekMatch[1], 10) : 99;
        const weekEnd = weekMatch?.[2] ? Number.parseInt(weekMatch[2], 10) : null;
        const week = weekMatch
            ? `week-${weekStart}${weekEnd ? `-${weekEnd}` : ''}`
            : 'unscheduled';

        return {
            trimester,
            month,
            week,
            weekOrder: Number.isFinite(weekStart) ? weekStart : 99,
            weekLabel: weekMatch
                ? (weekEnd ? `Weeks ${weekStart}-${weekEnd}` : `Week ${weekStart}`)
                : 'Unscheduled'
        };
    },

    getCurrentClassroomWindow(date = new Date()) {
        const currentDate = date instanceof Date && !Number.isNaN(date.getTime())
            ? date
            : new Date();
        const month = Object.entries(MONTH_ORDER)
            .find(([, order]) => order === currentDate.getMonth() + 1)?.[0] || 'unscheduled';
        const trimester = this.sm.activities?.getCurrentTrimesterKey?.(currentDate)
            || MONTH_TRIMESTER[month]
            || 'other';

        return {
            date: currentDate,
            trimester,
            month,
            monthOrder: currentDate.getMonth() + 1
        };
    },

    getDateOnlyStart(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    },

    getClassroomAssignmentStartDate(assignment = {}, date = new Date()) {
        const placement = this.getAssignmentPlanningPlacement(assignment);
        const weekNumber = Number.parseInt(placement.weekOrder, 10);
        const firstPlacementMonth = String(placement.month || '').split('-')[0];
        const monthIndex = (MONTH_ORDER[firstPlacementMonth] || 0) - 1;
        const activities = this.sm.activities;

        if (
            placement.trimester === 'other'
            || !Number.isFinite(weekNumber)
            || weekNumber <= 0
            || !Number.isFinite(monthIndex)
            || monthIndex < 0
        ) {
            return null;
        }

        const trimesterDate = activities?.getTrimesterWeekStartDate?.(placement.trimester, weekNumber, date);
        const alignedTrimesterDate = activities?.alignDateToLabelMonth?.(trimesterDate, firstPlacementMonth) || trimesterDate;
        if (
            alignedTrimesterDate instanceof Date
            && !Number.isNaN(alignedTrimesterDate.getTime())
            && alignedTrimesterDate.getMonth() === monthIndex
        ) {
            return alignedTrimesterDate;
        }

        const monthWeekDate = activities?.getMonthWeekStartDate?.(firstPlacementMonth, weekNumber, placement.trimester, date);
        if (monthWeekDate instanceof Date && !Number.isNaN(monthWeekDate.getTime())) {
            return monthWeekDate;
        }

        return new Date(date.getFullYear(), monthIndex, 1 + ((weekNumber - 1) * 7), 12);
    },

    isAssignmentInCurrentClassroomWindow(assignment = {}, date = new Date()) {
        const window = this.getCurrentClassroomWindow(date);
        const placement = this.getAssignmentPlanningPlacement(assignment);

        if (placement.trimester === 'other') return true;
        if (placement.trimester !== window.trimester) return false;

        const scheduledStart = this.getClassroomAssignmentStartDate(assignment, date);
        if (scheduledStart) {
            const assignmentStart = this.getDateOnlyStart(scheduledStart);
            const currentStart = this.getDateOnlyStart(window.date);
            if (assignmentStart && currentStart) {
                return assignmentStart <= currentStart;
            }
        }

        const firstPlacementMonth = String(placement.month || '').split('-')[0];
        const assignmentMonthOrder = MONTH_ORDER[firstPlacementMonth] || this.getMonthOrder(placement.month);
        if (!Number.isFinite(assignmentMonthOrder) || assignmentMonthOrder >= 99) {
            return true;
        }

        return assignmentMonthOrder <= window.monthOrder;
    },

    filterClassroomAssignmentsForCurrentWindow(assignments = [], date = new Date()) {
        return assignments.filter(assignment => this.isAssignmentInCurrentClassroomWindow(assignment, date));
    },

    buildClassroomTrimesterGroups(assignments = []) {
        return assignments.reduce((groups, assignment) => {
            const placement = this.getAssignmentPlanningPlacement(assignment);
            if (!groups.has(placement.trimester)) groups.set(placement.trimester, []);
            groups.get(placement.trimester).push(assignment);
            return groups;
        }, new Map());
    },

    buildClassroomMonthGroups(assignments = []) {
        return assignments.reduce((groups, assignment) => {
            const placement = this.getAssignmentPlanningPlacement(assignment);
            if (!groups.has(placement.month)) groups.set(placement.month, []);
            groups.get(placement.month).push(assignment);
            return groups;
        }, new Map());
    },

    buildClassroomWeekGroups(assignments = []) {
        return assignments.reduce((groups, assignment) => {
            const placement = this.getAssignmentPlanningPlacement(assignment);
            if (!groups.has(placement.week)) groups.set(placement.week, []);
            groups.get(placement.week).push(assignment);
            return groups;
        }, new Map());
    },

    formatClassroomMonthSummary(monthGroups) {
        const labels = Array.from(monthGroups.keys())
            .sort((monthA, monthB) => this.getMonthOrder(monthA) - this.getMonthOrder(monthB))
            .map(month => this.getMonthLabel(month));
        const visible = labels.slice(0, 3).join(' · ');
        return labels.length > 3 ? `${visible} · +${labels.length - 3} more` : visible;
    },

    formatClassroomWeekSummary(weekGroups) {
        const labels = Array.from(weekGroups.keys())
            .sort((weekA, weekB) => {
                const placementA = this.getAssignmentPlanningPlacement(weekGroups.get(weekA)?.[0]);
                const placementB = this.getAssignmentPlanningPlacement(weekGroups.get(weekB)?.[0]);
                return placementA.weekOrder - placementB.weekOrder;
            })
            .map(week => this.formatWeekLabelFromKey(week));
        const visible = labels.slice(0, 3).join(' · ');
        return labels.length > 3 ? `${visible} · +${labels.length - 3} more` : visible;
    },

    formatClassroomStatusSummary(assignments = []) {
        const submitted = assignments.filter(assignment => {
            const submission = this.getSubmissionForAssignment(assignment.id);
            return submission?.id && submission.status === 'submitted';
        }).length;
        const open = assignments.length - submitted;
        if (submitted && open) return `${open} open · ${submitted} submitted`;
        if (submitted) return 'Submitted';
        return 'Open work';
    }
};
