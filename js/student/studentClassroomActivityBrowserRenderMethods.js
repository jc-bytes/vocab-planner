import { createElement, escapeHtml } from '../main.js';
import { THIS_WEEK_SECTION } from './studentClassroomActivityBrowserConstants.js';

export const studentClassroomActivityBrowserRenderMethods = {
    createClassroomBreadcrumbButton(label, onClick) {
        const button = createElement('button', 'teacher-library-crumb-btn', label);
        button.type = 'button';
        button.addEventListener('click', onClick);
        return button;
    },

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
    },

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
    },

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
    },

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
    },

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
    },

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
    },

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
    },

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
};
