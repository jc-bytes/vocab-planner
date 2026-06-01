export const studentClassroomActivityDateMethods = {
    formatDueDate(value) {
        if (!value) return 'No due date';
        return `Due ${this.formatDateOnly(value)}`;
    },

    formatDateOnly(value) {
        if (!value) return '';
        const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    },

    formatAvailableDate(value) {
        if (!value) return 'Visible now';
        const label = this.formatDateOnly(value);
        return label ? `Visible ${label}` : 'Visible now';
    },

    dueDateEndMillis(value) {
        if (!value) return 0;
        const parsed = Date.parse(`${String(value).slice(0, 10)}T23:59:59`);
        return Number.isNaN(parsed) ? 0 : parsed;
    },

    timestampToMillis(value) {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        if (typeof value.toDate === 'function') return value.toDate().getTime();
        if (value.seconds !== undefined) return Number(value.seconds) * 1000;
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    },

    isAssignmentAvailable(assignment = {}) {
        if (!assignment.availableFrom) return true;
        const start = Date.parse(`${String(assignment.availableFrom).slice(0, 10)}T00:00:00`);
        return Number.isNaN(start) || start <= Date.now();
    },

    getLateState(assignment = {}, submission = null) {
        const dueMillis = this.dueDateEndMillis(assignment.dueDate);
        if (!dueMillis) {
            return { isLate: false, isExcused: false, label: '', className: '' };
        }

        const submittedMillis = this.timestampToMillis(submission?.submittedAt);
        const isSubmittedLate = submittedMillis > 0 && submittedMillis > dueMillis;
        const isOpenLate = !submittedMillis && Date.now() > dueMillis;
        const isLate = isSubmittedLate || isOpenLate;
        const isExcused = Boolean(submission?.lateOverride);

        if (isExcused) {
            return {
                isLate,
                isExcused: true,
                label: 'Excused',
                className: 'is-excused',
                reason: submission?.lateOverrideReason || ''
            };
        }

        return {
            isLate,
            isExcused: false,
            label: isLate ? 'Late' : '',
            className: isLate ? 'is-late' : ''
        };
    },

    getAssignmentSortValue(assignment) {
        if (assignment.dueDate) {
            const due = Date.parse(`${assignment.dueDate}T12:00:00`);
            if (!Number.isNaN(due)) return due;
        }
        const updated = assignment.updatedAt;
        if (updated?.toDate) return updated.toDate().getTime();
        if (updated?.seconds !== undefined) return Number(updated.seconds) * 1000;
        const parsed = Date.parse(updated || assignment.createdAt || '');
        return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
    },

    dateOnlyStartMillis(value) {
        if (!value) return 0;
        const parsed = Date.parse(`${String(value).slice(0, 10)}T00:00:00`);
        return Number.isNaN(parsed) ? 0 : parsed;
    },

    getCurrentWeekBounds(date = new Date()) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const daysSinceMonday = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - daysSinceMonday);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start: start.getTime(), end: end.getTime() };
    },

    isAssignmentInCurrentWeek(assignment, bounds = this.getCurrentWeekBounds()) {
        const availableMillis = this.dateOnlyStartMillis(assignment.availableFrom);
        const dueMillis = this.dueDateEndMillis(assignment.dueDate);

        if (availableMillis && dueMillis) {
            return availableMillis <= bounds.end && dueMillis >= bounds.start;
        }

        if (dueMillis) {
            return dueMillis >= bounds.start && dueMillis <= bounds.end;
        }

        if (availableMillis) {
            return availableMillis >= bounds.start && availableMillis <= bounds.end;
        }

        return false;
    },

    getThisWeekAssignments(assignments = []) {
        const bounds = this.getCurrentWeekBounds();
        return assignments.filter(assignment => this.isAssignmentInCurrentWeek(assignment, bounds));
    }
};
