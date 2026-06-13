import { createElement, escapeHtml } from '../main.js';
import { THIS_WEEK_SECTION } from './studentClassroomActivityBrowserConstants.js';

const CLASSROOM_CARD_TEXT_LIMIT = 160;

function getStudentAssignmentStatusLabel(status = '') {
    if (status === 'not-started') return 'Not started';
    if (status === 'draft') return 'In progress';
    if (status === 'submitted') return 'Submitted';
    return String(status || 'Not started').replace(/-/g, ' ');
}

function getStudentAssignmentActionLabel(status = '') {
    if (status === 'submitted') return 'Review';
    if (status === 'draft') return 'Continue';
    return 'Start';
}

function getCompactClassroomText(value = '', fallback = '') {
    const text = String(value || fallback || '').trim();
    if (text.length <= CLASSROOM_CARD_TEXT_LIMIT) return text;
    return `${text.slice(0, CLASSROOM_CARD_TEXT_LIMIT - 3).trim()}...`;
}

export const studentClassroomActivityBrowserRenderMethods = {
    getClassroomActivityViewMode() {
        return this.sm.studentClassroomActivityViewMode === 'rows' ? 'rows' : 'cards';
    },

    setClassroomActivityViewMode(mode) {
        this.sm.studentClassroomActivityViewMode = mode === 'rows' ? 'rows' : 'cards';
        localStorage.setItem('student_classroom_activity_view_mode', this.sm.studentClassroomActivityViewMode);
        this.renderList(this.sm.studentClassroomActivityDrilldown || {});
    },

    renderClassroomViewControls() {
        const container = document.getElementById('classroom-view-toggle');
        if (!container) return;
        const currentMode = this.getClassroomActivityViewMode();
        container.innerHTML = `
            <button class="vocab-view-toggle-btn ${currentMode === 'cards' ? 'is-active' : ''}" type="button" data-classroom-view-mode="cards" aria-pressed="${currentMode === 'cards'}" aria-label="Show cards">
                <i data-lucide="layout-grid"></i><span>Cards</span>
            </button>
            <button class="vocab-view-toggle-btn ${currentMode === 'rows' ? 'is-active' : ''}" type="button" data-classroom-view-mode="rows" aria-pressed="${currentMode === 'rows'}" aria-label="Show rows">
                <i data-lucide="list"></i><span>Rows</span>
            </button>
        `;
        container.querySelectorAll('[data-classroom-view-mode]').forEach(button => {
            button.addEventListener('click', () => this.setClassroomActivityViewMode(button.dataset.classroomViewMode));
        });
    },

    createClassroomBreadcrumbButton(label, onClick) {
        const button = createElement('button', 'teacher-library-crumb-btn', label);
        button.type = 'button';
        button.addEventListener('click', onClick);
        return button;
    },

    renderClassroomBreadcrumb(container, drilldown = {}) {
        const host = document.getElementById('classroom-context-breadcrumb') || container;
        host.innerHTML = '';
        const nav = createElement('div', 'teacher-library-breadcrumb');
        nav.appendChild(this.createClassroomBreadcrumbButton('Activities', () => {
            this.navigateToClassroomFolder({});
        }));

        if (drilldown.section === THIS_WEEK_SECTION) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-current', 'This Week'));
            host.appendChild(nav);
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

        host.appendChild(nav);
    },

    createClassroomChoiceCard({ title, count, meta, icon }) {
        const card = createElement('button', 'teacher-library-choice-card student-classroom-folder-card');
        card.type = 'button';

        const text = createElement('span', 'teacher-library-choice-text');
        text.appendChild(createElement('strong', null, title));
        text.appendChild(createElement('span', 'teacher-library-choice-count', count));
        if (meta) {
            text.appendChild(createElement('small', 'student-classroom-folder-meta', meta));
            card.title = meta;
        }
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

        const visibleAssignments = this.filterClassroomAssignmentsForCurrentWindow(assignments);
        const thisWeekAssignments = this.getThisWeekAssignments(visibleAssignments);
        const trimesterGroups = this.buildClassroomTrimesterGroups(visibleAssignments);
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
                const placementA = this.getAssignmentCalendarPlacement(weekGroups.get(weekA)?.[0]);
                const placementB = this.getAssignmentCalendarPlacement(weekGroups.get(weekB)?.[0]);
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

    createClassroomActivityRowList(headers = []) {
        const list = createElement('div', 'student-vocab-row-list student-classroom-row-list');
        const header = createElement('div', 'student-vocab-row student-vocab-row-header student-classroom-row');
        header.setAttribute('aria-hidden', 'true');
        header.appendChild(createElement('strong', null, headers[0] || 'Name'));
        headers.slice(1).forEach(label => header.appendChild(createElement('span', null, label)));
        header.appendChild(createElement('i'));
        list.appendChild(header);
        return list;
    },

    createClassroomActivityRow(assignment) {
        const savedSubmission = this.getSubmissionForAssignment(assignment.id);
        const submission = savedSubmission?.id ? savedSubmission : null;
        const status = submission?.status || 'not-started';
        const placement = this.getAssignmentCalendarPlacement(assignment);
        const row = createElement('button', 'student-vocab-row student-classroom-row');
        row.type = 'button';
        row.dataset.assignmentId = assignment.id;
        row.innerHTML = `
            <strong>${escapeHtml(assignment.title || 'Classroom Activity')}</strong>
            <span>${escapeHtml(this.getMonthLabel(placement.month))}</span>
            <span>${escapeHtml(placement.weekLabel || this.formatWeekLabelFromKey(placement.week))}</span>
            <span class="student-vocab-purpose">${escapeHtml(getStudentAssignmentStatusLabel(status))}</span>
            <i data-lucide="chevron-right"></i>
        `;
        row.addEventListener('click', () => {
            this.sm.navigateTo({ view: 'classroom-activity', assignmentId: assignment.id });
        });
        return row;
    },

    renderClassroomAssignmentRows(container, assignments, emptyText = 'No activities here yet.') {
        if (assignments.length === 0) {
            container.appendChild(createElement('p', 'student-empty-state', emptyText));
            return;
        }

        const list = this.createClassroomActivityRowList(['Name', 'Month', 'Week', 'Status']);
        assignments
            .slice()
            .sort((a, b) => this.getAssignmentSortValue(a) - this.getAssignmentSortValue(b))
            .forEach(assignment => list.appendChild(this.createClassroomActivityRow(assignment)));
        container.appendChild(list);
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

        this.renderClassroomViewControls();
        const breadcrumbHost = document.getElementById('classroom-context-breadcrumb');
        if (breadcrumbHost) breadcrumbHost.innerHTML = '';

        const selectedSubjectSlug = String(this.sm.selectedSubjectSlug || 'technology');
        const visibleAssignments = this.filterClassroomAssignmentsForCurrentWindow(assignments)
            .filter(assignment => String(assignment.subjectSlug || 'technology') === selectedSubjectSlug);
        const drilldown = this.normalizeClassroomDrilldown(route);
        this.sm.studentClassroomActivityDrilldown = drilldown;

        if (visibleAssignments.length === 0) {
            this.renderClassroomBreadcrumb(container);
            container.appendChild(createElement('p', 'student-empty-state', 'No current activities are available yet.'));
            return;
        }

        if (drilldown.section === THIS_WEEK_SECTION) {
            this.renderClassroomBreadcrumb(container, drilldown);
            const renderer = this.getClassroomActivityViewMode() === 'rows'
                ? this.renderClassroomAssignmentRows
                : this.renderClassroomAssignmentGrid;
            renderer.call(
                this,
                container,
                this.getThisWeekAssignments(visibleAssignments),
                'No activities for this week.'
            );
            return;
        }

        const trimesterGroups = this.buildClassroomTrimesterGroups(visibleAssignments);
        if (!drilldown.trimester || !trimesterGroups.has(drilldown.trimester)) {
            const currentTrimester = this.getCurrentClassroomWindow().trimester;
            if (trimesterGroups.has(currentTrimester)) {
                this.sm.studentClassroomActivityDrilldown = {
                    section: null,
                    trimester: currentTrimester,
                    month: null,
                    week: null
                };
                if (this.getClassroomActivityViewMode() === 'rows') {
                    this.renderClassroomBreadcrumb(container, { trimester: currentTrimester });
                    this.renderClassroomAssignmentRows(container, trimesterGroups.get(currentTrimester));
                } else {
                    this.renderClassroomMonthPicker(container, currentTrimester, trimesterGroups.get(currentTrimester));
                }
                return;
            }

            this.sm.studentClassroomActivityDrilldown = {
                section: null,
                trimester: null,
                month: null,
                week: null
            };
            if (this.getClassroomActivityViewMode() === 'rows') {
                this.renderClassroomBreadcrumb(container);
                this.renderClassroomAssignmentRows(container, visibleAssignments);
            } else {
                this.renderClassroomOverview(container, visibleAssignments);
            }
            return;
        }

        const trimesterAssignments = trimesterGroups.get(drilldown.trimester);
        const monthGroups = this.buildClassroomMonthGroups(trimesterAssignments);
        if (this.getClassroomActivityViewMode() === 'rows' && !drilldown.month) {
            this.sm.studentClassroomActivityDrilldown = {
                section: null,
                trimester: drilldown.trimester,
                month: null,
                week: null
            };
            this.renderClassroomBreadcrumb(container, { trimester: drilldown.trimester });
            this.renderClassroomAssignmentRows(container, trimesterAssignments);
            return;
        }

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
        if (this.getClassroomActivityViewMode() === 'rows') {
            this.renderClassroomAssignmentRows(container, weekGroups.get(drilldown.week));
        } else {
            this.renderClassroomAssignmentGrid(container, weekGroups.get(drilldown.week));
        }
    },

    renderAssignmentCard(container, assignment) {
        const savedSubmission = this.getSubmissionForAssignment(assignment.id);
        const submission = savedSubmission?.id ? savedSubmission : null;
        const status = submission?.status || 'not-started';
        const lateState = this.getLateState(assignment, submission);
        const statusLabel = getStudentAssignmentStatusLabel(status);
        const actionLabel = getStudentAssignmentActionLabel(status);
        const dueLabel = this.formatDueDate(assignment.dueDate);
        const contextLabel = assignment.weekLabel || 'Classroom activity';
        const fallbackDetail = assignment.description || assignment.studentInstructions || 'Open the classroom activity.';
        const description = getCompactClassroomText(assignment.description, fallbackDetail);
        const instructions = getCompactClassroomText(assignment.studentInstructions, fallbackDetail);
        const hasDescription = Boolean(assignment.description);
        const hasInstructions = Boolean(assignment.studentInstructions);
        const card = createElement('article', `card student-classroom-activity-card status-${status} ${lateState.className}`);
        card.dataset.assignmentId = assignment.id;
        card.innerHTML = `
            <div class="student-classroom-card-main">
                <span class="student-activity-card-topline">
                    <span class="student-activity-status">${escapeHtml(statusLabel)}</span>
                    <span class="student-activity-due-chip">${escapeHtml(dueLabel)}</span>
                    ${lateState.label ? `<span class="student-activity-late-label ${escapeHtml(lateState.className)}">${escapeHtml(lateState.label)}</span>` : ''}
                </span>
                <h3>${escapeHtml(assignment.title)}</h3>
                <small class="student-activity-context">${escapeHtml(contextLabel)}</small>
                <button class="student-classroom-card-open" type="button">${escapeHtml(actionLabel)}</button>
            </div>
            <details class="student-classroom-card-details">
                <summary>Details</summary>
                <div class="student-classroom-card-detail-copy">
                    ${hasDescription ? `<span><strong>Description</strong>${escapeHtml(description)}</span>` : ''}
                    ${hasInstructions ? `<span><strong>Instructions</strong>${escapeHtml(instructions)}</span>` : ''}
                    ${!hasDescription && !hasInstructions ? `<span>${escapeHtml(fallbackDetail)}</span>` : ''}
                </div>
            </details>
        `;
        const openAssignment = () => {
            this.sm.navigateTo({ view: 'classroom-activity', assignmentId: assignment.id });
        };
        card.querySelector('.student-classroom-card-open')?.addEventListener('click', (event) => {
            event.stopPropagation();
            openAssignment();
        });
        card.querySelector('.student-classroom-card-details')?.addEventListener('click', event => {
            event.stopPropagation();
        });
        card.querySelector('.student-classroom-card-details')?.addEventListener('keydown', event => {
            event.stopPropagation();
        });
        card.addEventListener('click', (event) => {
            if (event.target.closest('.student-classroom-card-details, .student-classroom-card-open')) return;
            openAssignment();
        });
        container.appendChild(card);
    }
};
