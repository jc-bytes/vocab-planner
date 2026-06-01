import { $, createElement, escapeHtml, notifications } from '../main.js';

const THIS_WEEK_SECTION = 'this-week';
const MONTH_ORDER = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12
};
const MONTH_TRIMESTER = {
    march: 'IT',
    april: 'IT',
    may: 'IT',
    june: 'IIT',
    july: 'IIT',
    august: 'IIT',
    september: 'IIIT',
    october: 'IIIT',
    november: 'IIIT',
    december: 'IIIT'
};
const TRIMESTER_LABELS = {
    IT: 'I Trimester',
    IIT: 'II Trimester',
    IIIT: 'III Trimester',
    other: 'Other'
};

class StudentClassroomActivityBrowserMethods {
    formatDueDate(value) {
        if (!value) return 'No due date';
        return `Due ${this.formatDateOnly(value)}`;
    }

    formatDateOnly(value) {
        if (!value) return '';
        const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    formatAvailableDate(value) {
        if (!value) return 'Visible now';
        const label = this.formatDateOnly(value);
        return label ? `Visible ${label}` : 'Visible now';
    }

    dueDateEndMillis(value) {
        if (!value) return 0;
        const parsed = Date.parse(`${String(value).slice(0, 10)}T23:59:59`);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    timestampToMillis(value) {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        if (typeof value.toDate === 'function') return value.toDate().getTime();
        if (value.seconds !== undefined) return Number(value.seconds) * 1000;
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    isAssignmentAvailable(assignment = {}) {
        if (!assignment.availableFrom) return true;
        const start = Date.parse(`${String(assignment.availableFrom).slice(0, 10)}T00:00:00`);
        return Number.isNaN(start) || start <= Date.now();
    }

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
    }

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
    }

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
    }

    navigateToClassroomFolder(drilldown = {}) {
        const normalized = this.normalizeClassroomDrilldown(drilldown);
        this.sm.studentClassroomActivityDrilldown = normalized;
        this.sm.navigateTo({
            view: 'classroom-activities',
            ...normalized
        });
    }

    formatAssignmentCount(count) {
        return `${count} ${count === 1 ? 'activity' : 'activities'}`;
    }

    getTrimesterLabel(trimesterKey) {
        return TRIMESTER_LABELS[trimesterKey] || TRIMESTER_LABELS.other;
    }

    getTrimesterOrder(trimesterKey) {
        return { IT: 1, IIT: 2, IIIT: 3, other: 99 }[trimesterKey] || 99;
    }

    getMonthLabel(monthKey) {
        if (!monthKey || monthKey === 'unscheduled') return 'Unscheduled';
        return String(monthKey)
            .split('-')
            .map(part => part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : '')
            .filter(Boolean)
            .join('-');
    }

    getMonthOrder(monthKey) {
        const parts = String(monthKey || '').split('-').filter(Boolean);
        const firstMonth = parts[0] || '';
        const secondMonth = parts[1] || '';
        const firstOrder = MONTH_ORDER[firstMonth] || 99;
        const secondOrder = MONTH_ORDER[secondMonth] || firstOrder;
        return firstOrder + (secondOrder > firstOrder ? 0.5 : 0);
    }

    formatWeekLabelFromKey(weekKey) {
        if (!weekKey || weekKey === 'unscheduled') return 'Unscheduled';
        const match = String(weekKey).match(/^week-(\d+)(?:-(\d+))?$/);
        if (!match) return 'Week';
        return match[2] ? `Weeks ${match[1]}-${match[2]}` : `Week ${match[1]}`;
    }

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
    }

    buildClassroomTrimesterGroups(assignments = []) {
        return assignments.reduce((groups, assignment) => {
            const placement = this.getAssignmentPlanningPlacement(assignment);
            if (!groups.has(placement.trimester)) groups.set(placement.trimester, []);
            groups.get(placement.trimester).push(assignment);
            return groups;
        }, new Map());
    }

    buildClassroomMonthGroups(assignments = []) {
        return assignments.reduce((groups, assignment) => {
            const placement = this.getAssignmentPlanningPlacement(assignment);
            if (!groups.has(placement.month)) groups.set(placement.month, []);
            groups.get(placement.month).push(assignment);
            return groups;
        }, new Map());
    }

    buildClassroomWeekGroups(assignments = []) {
        return assignments.reduce((groups, assignment) => {
            const placement = this.getAssignmentPlanningPlacement(assignment);
            if (!groups.has(placement.week)) groups.set(placement.week, []);
            groups.get(placement.week).push(assignment);
            return groups;
        }, new Map());
    }

    formatClassroomMonthSummary(monthGroups) {
        const labels = Array.from(monthGroups.keys())
            .sort((monthA, monthB) => this.getMonthOrder(monthA) - this.getMonthOrder(monthB))
            .map(month => this.getMonthLabel(month));
        const visible = labels.slice(0, 3).join(' · ');
        return labels.length > 3 ? `${visible} · +${labels.length - 3} more` : visible;
    }

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
    }

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

    dateOnlyStartMillis(value) {
        if (!value) return 0;
        const parsed = Date.parse(`${String(value).slice(0, 10)}T00:00:00`);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    getCurrentWeekBounds(date = new Date()) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const daysSinceMonday = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - daysSinceMonday);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start: start.getTime(), end: end.getTime() };
    }

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
    }

    getThisWeekAssignments(assignments = []) {
        const bounds = this.getCurrentWeekBounds();
        return assignments.filter(assignment => this.isAssignmentInCurrentWeek(assignment, bounds));
    }

    createClassroomBreadcrumbButton(label, onClick) {
        const button = createElement('button', 'teacher-library-crumb-btn', label);
        button.type = 'button';
        button.addEventListener('click', onClick);
        return button;
    }

    renderClassroomBreadcrumb(container, drilldown = {}) {
        const nav = createElement('div', 'teacher-library-breadcrumb');
        nav.appendChild(this.createClassroomBreadcrumbButton('Activities', () => {
            this.navigateToClassroomFolder({});
        }));

        if (drilldown.section === THIS_WEEK_SECTION) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-current', 'This Week'));
            container.appendChild(nav);
            return;
        }

        if (drilldown.trimester) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const trimesterLabel = this.getTrimesterLabel(drilldown.trimester);
            const trimesterNode = drilldown.month || drilldown.week
                ? this.createClassroomBreadcrumbButton(trimesterLabel, () => {
                    this.navigateToClassroomFolder({ trimester: drilldown.trimester });
                })
                : createElement('span', 'teacher-library-breadcrumb-current', trimesterLabel);
            nav.appendChild(trimesterNode);
        }

        if (drilldown.month) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const monthLabel = this.getMonthLabel(drilldown.month);
            const monthNode = drilldown.week
                ? this.createClassroomBreadcrumbButton(monthLabel, () => {
                    this.navigateToClassroomFolder({
                        trimester: drilldown.trimester,
                        month: drilldown.month
                    });
                })
                : createElement('span', 'teacher-library-breadcrumb-current', monthLabel);
            nav.appendChild(monthNode);
        }

        if (drilldown.week) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-current', this.formatWeekLabelFromKey(drilldown.week)));
        }

        container.appendChild(nav);
    }

    createClassroomChoiceCard({ title, count, meta, icon }) {
        const card = createElement('button', 'teacher-library-choice-card student-classroom-folder-card');
        card.type = 'button';

        const text = createElement('span', 'teacher-library-choice-text');
        text.appendChild(createElement('strong', null, title));
        text.appendChild(createElement('span', 'teacher-library-choice-count', count));
        if (meta) text.appendChild(createElement('small', null, meta));
        card.appendChild(text);

        if (icon) {
            const iconEl = createElement('i');
            iconEl.setAttribute('data-lucide', icon);
            card.appendChild(iconEl);
        }

        return card;
    }

    renderClassroomOverview(container, assignments) {
        this.renderClassroomBreadcrumb(container);

        const thisWeekAssignments = this.getThisWeekAssignments(assignments);
        const trimesterGroups = this.buildClassroomTrimesterGroups(assignments);
        const grid = createElement('div', 'teacher-library-choice-grid');

        const thisWeekCard = this.createClassroomChoiceCard({
            title: 'This Week',
            count: this.formatAssignmentCount(thisWeekAssignments.length),
            meta: 'Current work',
            icon: 'calendar-days'
        });
        thisWeekCard.addEventListener('click', () => {
            this.navigateToClassroomFolder({ section: THIS_WEEK_SECTION });
        });
        grid.appendChild(thisWeekCard);

        Array.from(trimesterGroups.entries())
            .sort(([trimesterA], [trimesterB]) => this.getTrimesterOrder(trimesterA) - this.getTrimesterOrder(trimesterB))
            .forEach(([trimesterKey, trimesterAssignments]) => {
                const monthGroups = this.buildClassroomMonthGroups(trimesterAssignments);
                const card = this.createClassroomChoiceCard({
                    title: this.getTrimesterLabel(trimesterKey),
                    count: this.formatAssignmentCount(trimesterAssignments.length),
                    meta: this.formatClassroomMonthSummary(monthGroups),
                    icon: 'chevron-right'
                });
                card.addEventListener('click', () => {
                    this.navigateToClassroomFolder({ trimester: trimesterKey });
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderClassroomMonthPicker(container, selectedTrimester, assignments) {
        this.renderClassroomBreadcrumb(container, { trimester: selectedTrimester });

        const monthGroups = this.buildClassroomMonthGroups(assignments);
        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(monthGroups.entries())
            .sort(([monthA], [monthB]) => this.getMonthOrder(monthA) - this.getMonthOrder(monthB))
            .forEach(([monthKey, monthAssignments]) => {
                const weekGroups = this.buildClassroomWeekGroups(monthAssignments);
                const card = this.createClassroomChoiceCard({
                    title: this.getMonthLabel(monthKey),
                    count: this.formatAssignmentCount(monthAssignments.length),
                    meta: this.formatClassroomWeekSummary(weekGroups),
                    icon: 'chevron-right'
                });
                card.addEventListener('click', () => {
                    this.navigateToClassroomFolder({
                        trimester: selectedTrimester,
                        month: monthKey
                    });
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderClassroomWeekPicker(container, selectedTrimester, selectedMonth, assignments) {
        this.renderClassroomBreadcrumb(container, {
            trimester: selectedTrimester,
            month: selectedMonth
        });

        const weekGroups = this.buildClassroomWeekGroups(assignments);
        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(weekGroups.entries())
            .sort(([weekA], [weekB]) => {
                const placementA = this.getAssignmentPlanningPlacement(weekGroups.get(weekA)?.[0]);
                const placementB = this.getAssignmentPlanningPlacement(weekGroups.get(weekB)?.[0]);
                return placementA.weekOrder - placementB.weekOrder;
            })
            .forEach(([weekKey, weekAssignments]) => {
                const card = this.createClassroomChoiceCard({
                    title: this.formatWeekLabelFromKey(weekKey),
                    count: this.formatAssignmentCount(weekAssignments.length),
                    meta: this.formatClassroomStatusSummary(weekAssignments),
                    icon: 'chevron-right'
                });
                card.addEventListener('click', () => {
                    this.navigateToClassroomFolder({
                        trimester: selectedTrimester,
                        month: selectedMonth,
                        week: weekKey
                    });
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderClassroomAssignmentGrid(container, assignments, emptyText = 'No activities here yet.') {
        if (assignments.length === 0) {
            container.appendChild(createElement('p', 'student-empty-state', emptyText));
            return;
        }

        const grid = createElement('div', 'student-classroom-activity-grid');
        assignments
            .slice()
            .sort((a, b) => this.getAssignmentSortValue(a) - this.getAssignmentSortValue(b))
            .forEach(assignment => this.renderAssignmentCard(grid, assignment));
        container.appendChild(grid);
    }

    renderClassroomActivityBrowser(container, assignments, route = {}) {
        container.classList.remove('vocab-grid');
        container.classList.add('teacher-library-browser');
        container.innerHTML = '';

        const drilldown = this.normalizeClassroomDrilldown(route);
        this.sm.studentClassroomActivityDrilldown = drilldown;

        if (drilldown.section === THIS_WEEK_SECTION) {
            this.renderClassroomBreadcrumb(container, drilldown);
            this.renderClassroomAssignmentGrid(
                container,
                this.getThisWeekAssignments(assignments),
                'No activities for this week.'
            );
            return;
        }

        const trimesterGroups = this.buildClassroomTrimesterGroups(assignments);
        if (!drilldown.trimester || !trimesterGroups.has(drilldown.trimester)) {
            this.sm.studentClassroomActivityDrilldown = {
                section: null,
                trimester: null,
                month: null,
                week: null
            };
            this.renderClassroomOverview(container, assignments);
            return;
        }

        const trimesterAssignments = trimesterGroups.get(drilldown.trimester);
        const monthGroups = this.buildClassroomMonthGroups(trimesterAssignments);
        if (!drilldown.month || !monthGroups.has(drilldown.month)) {
            this.sm.studentClassroomActivityDrilldown = {
                section: null,
                trimester: drilldown.trimester,
                month: null,
                week: null
            };
            this.renderClassroomMonthPicker(container, drilldown.trimester, trimesterAssignments);
            return;
        }

        const monthAssignments = monthGroups.get(drilldown.month);
        const weekGroups = this.buildClassroomWeekGroups(monthAssignments);
        if (!drilldown.week || !weekGroups.has(drilldown.week)) {
            this.sm.studentClassroomActivityDrilldown = {
                section: null,
                trimester: drilldown.trimester,
                month: drilldown.month,
                week: null
            };
            this.renderClassroomWeekPicker(container, drilldown.trimester, drilldown.month, monthAssignments);
            return;
        }

        this.renderClassroomBreadcrumb(container, drilldown);
        this.renderClassroomAssignmentGrid(container, weekGroups.get(drilldown.week));
    }

    async renderList(route = {}) {
        this.sm.cleanupActivity();
        this.sm.currentVocab = null;
        this.sm.switchView('student-classroom-activities-view');
        const list = $('#student-classroom-activities-list');
        if (!list) return;

        list.innerHTML = '<div class="loading-spinner">Loading activities...</div>';
        try {
            const [assignments] = await Promise.all([
                this.loadAssignments(),
                this.loadSubmissions()
            ]);
            list.innerHTML = '';

            if (assignments.length === 0) {
                list.innerHTML = '<p class="student-empty-state">No classroom activities assigned yet.</p>';
                return;
            }

            this.renderClassroomActivityBrowser(list, assignments, route);
            this.sm.updateHeader();
            if (window.lucide) window.lucide.createIcons();
        } catch (error) {
            console.error('Failed to load classroom activities:', error);
            list.innerHTML = '<p class="student-empty-state">Could not load classroom activities.</p>';
            notifications.error('Could not load classroom activities.');
        }
    }

    renderAssignmentCard(container, assignment) {
        const savedSubmission = this.getSubmissionForAssignment(assignment.id);
        const submission = savedSubmission?.id ? savedSubmission : null;
        const status = submission?.status || 'not-started';
        const lateState = this.getLateState(assignment, submission);
        const card = createElement('button', `card student-classroom-activity-card status-${status} ${lateState.className}`);
        card.type = 'button';
        card.dataset.assignmentId = assignment.id;
        card.innerHTML = `
            <span class="student-activity-status">${escapeHtml(status === 'not-started' ? 'Not started' : status)}</span>
            <h3>${escapeHtml(assignment.title)}</h3>
            <p>${escapeHtml(assignment.description || assignment.studentInstructions || 'Open the canvas activity.')}</p>
            <span class="student-activity-date-stack">
                ${assignment.weekLabel ? `<small>${escapeHtml(assignment.weekLabel)}</small>` : ''}
                <small>${escapeHtml(this.formatDueDate(assignment.dueDate))}</small>
                ${lateState.label ? `<span class="student-activity-late-label ${escapeHtml(lateState.className)}">${escapeHtml(lateState.label)}</span>` : ''}
            </span>
        `;
        card.addEventListener('click', () => {
            this.sm.navigateTo({ view: 'classroom-activity', assignmentId: assignment.id });
        });
        container.appendChild(card);
    }
}

export function installStudentClassroomActivityBrowserMethods(StudentClassroomActivities) {
    for (const name of Object.getOwnPropertyNames(StudentClassroomActivityBrowserMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentClassroomActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentClassroomActivityBrowserMethods.prototype, name)
        );
    }
}
