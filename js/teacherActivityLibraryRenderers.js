import { $, createElement, escapeHtml } from './main.js';
import { getSubjectBySlug } from './services/vocabularyApi.js';
import { getTeacherActivityWorkspaceSummary } from './teacherActivitySummaries.js';

function renderTeacherActivityPendingRoute(manager, container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, selectedWeek) {
    renderTeacherActivityLibraryBreadcrumb(manager, container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, selectedWeek);
    container.appendChild(createElement('div', 'loading-spinner', 'Loading activities...'));
}

function getTeacherActivityViewDepth(drilldown = {}) {
    if (drilldown.week) return 'week';
    if (drilldown.month) return 'month';
    if (drilldown.trimester) return 'trimester';
    if (drilldown.grade) return 'grade';
    if (drilldown.subject) return 'subject';
    return 'root';
}

function getDefaultTeacherActivityViewMode(depth = getTeacherActivityViewDepth()) {
    return depth === 'week' ? 'rows' : 'cards';
}

function getTeacherActivityViewMode(manager, drilldown = manager.activityDrilldown || {}) {
    const depth = getTeacherActivityViewDepth(drilldown);
    const savedMode = manager.teacherActivityViewModes?.[depth];
    return savedMode === 'rows' || savedMode === 'cards'
        ? savedMode
        : getDefaultTeacherActivityViewMode(depth);
}

function setTeacherActivityViewMode(manager, mode) {
    const depth = getTeacherActivityViewDepth(manager.activityDrilldown || {});
    manager.teacherActivityViewModes = {
        ...(manager.teacherActivityViewModes || {}),
        [depth]: mode === 'rows' ? 'rows' : 'cards'
    };
    localStorage.setItem('teacher_activity_view_modes', JSON.stringify(manager.teacherActivityViewModes));
    manager.renderActivityLibraryBrowser();
    manager.refreshIcons();
}

function renderTeacherActivityViewControls(manager) {
    const container = $('#teacher-activity-view-toggle');
    if (!container) return;
    const currentMode = getTeacherActivityViewMode(manager);
    container.innerHTML = `
        <button class="vocab-view-toggle-btn ${currentMode === 'cards' ? 'is-active' : ''}" type="button" data-teacher-activity-view-mode="cards" aria-pressed="${currentMode === 'cards'}" aria-label="Show cards">
            <i data-lucide="layout-grid"></i><span>Cards</span>
        </button>
        <button class="vocab-view-toggle-btn ${currentMode === 'rows' ? 'is-active' : ''}" type="button" data-teacher-activity-view-mode="rows" aria-pressed="${currentMode === 'rows'}" aria-label="Show rows">
            <i data-lucide="list"></i><span>Rows</span>
        </button>
    `;
    container.querySelectorAll('[data-teacher-activity-view-mode]').forEach(button => {
        button.addEventListener('click', () => setTeacherActivityViewMode(manager, button.dataset.teacherActivityViewMode));
    });
}

export function renderTeacherActivityLibraryBrowser(manager, container = $('#activity-library-list')) {
    if (!container) return;

    container.classList.remove('vocab-grid');
    container.classList.add('teacher-library-browser');
    container.innerHTML = '';

    const subjectGroups = manager.buildActivityLibraryGroups();
    const selectedSubject = manager.activityDrilldown.subject;
    const selectedGrade = manager.activityDrilldown.grade;
    const selectedTrimester = manager.activityDrilldown.trimester;
    const selectedMonth = manager.activityDrilldown.month;
    const selectedWeek = manager.activityDrilldown.week;
    const isWaitingForFreshData = manager.activityLibraryRefreshing
        || manager.activityLibraryStale
        || !manager.activityLibraryLoaded;

    if (!selectedSubject || !subjectGroups.has(selectedSubject)) {
        if (selectedSubject && isWaitingForFreshData) {
            renderTeacherActivityPendingRoute(manager, container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, selectedWeek);
            return;
        }
        manager.resetActivityLibraryDrilldown();
        if (getTeacherActivityViewMode(manager, {}) === 'rows') {
            renderTeacherActivityLibraryBreadcrumb(manager, container);
            renderTeacherActivityRows(manager, container, manager.activityLibraryItems || []);
        } else {
            renderTeacherActivitySubjectPicker(manager, container, subjectGroups);
        }
        return;
    }

    const gradeGroups = subjectGroups.get(selectedSubject);
    if (!selectedGrade || !gradeGroups.has(selectedGrade)) {
        if (selectedGrade && isWaitingForFreshData) {
            renderTeacherActivityPendingRoute(manager, container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, selectedWeek);
            return;
        }
        manager.activityDrilldown.grade = null;
        manager.activityDrilldown.trimester = null;
        manager.activityDrilldown.month = null;
        manager.activityDrilldown.week = null;
        if (getTeacherActivityViewMode(manager, { subject: selectedSubject }) === 'rows') {
            renderTeacherActivityLibraryBreadcrumb(manager, container, selectedSubject);
            renderTeacherActivityRows(manager, container, getTeacherActivityItemsForDrilldown(manager, { subject: selectedSubject }));
        } else {
            renderTeacherActivityGradePicker(manager, container, selectedSubject, gradeGroups);
        }
        return;
    }

    const trimesterGroups = manager.buildActivityTrimesterGroups(gradeGroups.get(selectedGrade));
    if (!selectedTrimester || !trimesterGroups.has(selectedTrimester)) {
        if (selectedTrimester && isWaitingForFreshData) {
            renderTeacherActivityPendingRoute(manager, container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, selectedWeek);
            return;
        }
        manager.activityDrilldown.trimester = null;
        manager.activityDrilldown.month = null;
        manager.activityDrilldown.week = null;
        if (getTeacherActivityViewMode(manager, { subject: selectedSubject, grade: selectedGrade }) === 'rows') {
            renderTeacherActivityLibraryBreadcrumb(manager, container, selectedSubject, selectedGrade);
            renderTeacherActivityRows(manager, container, getTeacherActivityItemsForDrilldown(manager, {
                subject: selectedSubject,
                grade: selectedGrade
            }));
        } else {
            renderTeacherActivityTrimesterPicker(manager, container, selectedSubject, selectedGrade, trimesterGroups);
        }
        return;
    }

    const monthGroups = manager.buildActivityMonthWeekGroups(trimesterGroups.get(selectedTrimester));
    if (!selectedMonth || !monthGroups.has(selectedMonth)) {
        if (selectedMonth && isWaitingForFreshData) {
            renderTeacherActivityPendingRoute(manager, container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, selectedWeek);
            return;
        }
        manager.activityDrilldown.month = null;
        manager.activityDrilldown.week = null;
        if (getTeacherActivityViewMode(manager, { subject: selectedSubject, grade: selectedGrade, trimester: selectedTrimester }) === 'rows') {
            renderTeacherActivityLibraryBreadcrumb(manager, container, selectedSubject, selectedGrade, selectedTrimester);
            renderTeacherActivityRows(manager, container, trimesterGroups.get(selectedTrimester));
        } else {
            renderTeacherActivityMonthPicker(manager, container, selectedSubject, selectedGrade, selectedTrimester, monthGroups);
        }
        return;
    }

    const weekGroups = monthGroups.get(selectedMonth);
    if (!selectedWeek || !weekGroups.has(selectedWeek)) {
        if (selectedWeek && isWaitingForFreshData) {
            renderTeacherActivityPendingRoute(manager, container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, selectedWeek);
            return;
        }
        manager.activityDrilldown.week = null;
        if (getTeacherActivityViewMode(manager, {
            subject: selectedSubject,
            grade: selectedGrade,
            trimester: selectedTrimester,
            month: selectedMonth
        }) === 'rows') {
            renderTeacherActivityLibraryBreadcrumb(manager, container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth);
            renderTeacherActivityRows(manager, container, Array.from(weekGroups.values()).flat());
        } else {
            renderTeacherActivityWeekPicker(manager, container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, weekGroups);
        }
        return;
    }

    renderTeacherActivityClassBrowser(
        manager,
        container,
        selectedSubject,
        selectedGrade,
        selectedTrimester,
        selectedMonth,
        selectedWeek,
        weekGroups.get(selectedWeek)
    );
}

function getTeacherActivityItemsForDrilldown(manager, drilldown = {}) {
    const subject = drilldown.subject || null;
    const grade = drilldown.grade || null;
    const trimester = drilldown.trimester || null;
    const month = drilldown.month || null;
    const week = drilldown.week || null;

    return (manager.activityLibraryItems || []).filter(({ activity }) => {
        const normalized = manager.normalizeActivity(activity);
        if (subject && normalized.subjectSlug !== subject) return false;
        if (grade && !manager.getActivityGroupGrades(normalized).includes(grade)) return false;
        if (trimester && manager.getActivityTrimesterKey(normalized) !== trimester) return false;
        if (month && manager.getActivityMonthKey(normalized) !== month) return false;
        if (week && manager.getActivityWeekKey(normalized) !== week) return false;
        return true;
    });
}

function createTeacherActivityRowList(headers = []) {
    const list = createElement('div', 'student-vocab-row-list teacher-activity-row-list');
    const header = createElement('div', 'student-vocab-row student-vocab-row-header teacher-activity-row');
    header.setAttribute('aria-hidden', 'true');
    header.appendChild(createElement('strong', null, headers[0] || 'Name'));
    headers.slice(1).forEach(label => header.appendChild(createElement('span', null, label)));
    header.appendChild(createElement('i'));
    list.appendChild(header);
    return list;
}

function compareTeacherActivityRowOrder(manager, itemA, itemB, drilldown = manager.activityDrilldown || {}) {
    const activityA = manager.normalizeActivity(itemA.activity);
    const activityB = manager.normalizeActivity(itemB.activity);

    if (!drilldown.subject) {
        const subjectCompare = getSubjectBySlug(manager.getSubjects(), activityA.subjectSlug).name
            .localeCompare(getSubjectBySlug(manager.getSubjects(), activityB.subjectSlug).name);
        if (subjectCompare) return subjectCompare;
    }

    if (!drilldown.grade) {
        const gradeCompare = manager.compareActivityGroupGrades(
            manager.getActivityGroupGrades(activityA)[0],
            manager.getActivityGroupGrades(activityB)[0]
        );
        if (gradeCompare) return gradeCompare;
    }

    if (!drilldown.trimester) {
        const trimesterCompare = manager.getTeacherTrimesterOrder(manager.getActivityTrimesterKey(activityA))
            - manager.getTeacherTrimesterOrder(manager.getActivityTrimesterKey(activityB));
        if (trimesterCompare) return trimesterCompare;
    }

    if (!drilldown.month) {
        const monthCompare = manager.getTeacherMonthOrder(manager.getActivityMonthKey(activityA))
            - manager.getTeacherMonthOrder(manager.getActivityMonthKey(activityB));
        if (monthCompare) return monthCompare;
    }

    if (!drilldown.week) {
        const weekCompare = manager.getActivityWeekOrder(manager.getActivityWeekKey(activityA))
            - manager.getActivityWeekOrder(manager.getActivityWeekKey(activityB));
        if (weekCompare) return weekCompare;
    }

    const minutesCompare = manager.inferActivitySlotMinutes(activityA) - manager.inferActivitySlotMinutes(activityB);
    if (minutesCompare) return minutesCompare;

    const typeCompare = manager.getActivityTypeLabel(activityA.activityType).localeCompare(manager.getActivityTypeLabel(activityB.activityType));
    if (typeCompare) return typeCompare;

    return manager.getActivitySortName(activityA).localeCompare(manager.getActivitySortName(activityB));
}

function createTeacherActivityRow(manager, { activity, type }, { showGrade = true } = {}) {
    const normalized = manager.normalizeActivity({ ...activity, source: type });
    const grades = normalized.grades.length
        ? normalized.grades.map(grade => manager.formatGradeLabel(grade)).join(', ')
        : 'Needs Grade';
    const trimester = manager.getTeacherTrimesterShortLabel(manager.getActivityTrimesterKey(normalized));
    const month = manager.getTeacherMonthShortLabel(manager.getActivityMonthKey(normalized));
    const week = manager.formatActivityWeekLabel(manager.getActivityWeekKey(normalized));
    const template = manager.getActivityTemplateLabel(normalized.activityData?.templateId);
    const minutes = normalized.estimatedMinutes || manager.inferActivitySlotMinutes(normalized);
    const row = createElement('button', 'student-vocab-row teacher-activity-row');
    row.type = 'button';
    row.classList.toggle('teacher-activity-row-has-grade', showGrade);
    row.innerHTML = `
        <strong>${escapeHtml(normalized.title || 'Untitled Activity')}</strong>
        ${showGrade ? `<span>${escapeHtml(grades)}</span>` : ''}
        <span>${escapeHtml(trimester)}</span>
        <span>${escapeHtml(month)}</span>
        <span>${escapeHtml(week)}</span>
        <span class="student-vocab-purpose">${escapeHtml(manager.getActivityTypeLabel(normalized.activityType))}</span>
        <span>${escapeHtml(template)}</span>
        <span>${escapeHtml(minutes && minutes !== 999 ? `${minutes}` : '-')}</span>
        <i data-lucide="chevron-right"></i>
    `;
    row.addEventListener('click', () => manager.loadActivityObject(normalized, type));
    return row;
}

function renderTeacherActivityRows(manager, container, activityItems = []) {
    if (!activityItems.length) {
        container.appendChild(createElement('p', 'teacher-empty-state', 'No activities here yet.'));
        return;
    }

    const showGrade = !manager.activityDrilldown?.grade;
    const headers = showGrade
        ? ['Name', 'Grade', 'Trimester', 'Month', 'Week', 'Type', 'Template', 'Min']
        : ['Name', 'Trimester', 'Month', 'Week', 'Type', 'Template', 'Min'];
    const list = createTeacherActivityRowList(headers);
    list.classList.toggle('teacher-activity-row-list-has-grade', showGrade);
    activityItems
        .slice()
        .sort((itemA, itemB) => compareTeacherActivityRowOrder(manager, itemA, itemB))
        .forEach(item => list.appendChild(createTeacherActivityRow(manager, item, { showGrade })));
    container.appendChild(list);
}

export function renderTeacherActivityLibraryBreadcrumb(manager, container, selectedSubject = null, selectedGrade = null, selectedTrimester = null, selectedMonth = null, selectedWeek = null) {
    const header = createElement('div', 'activity-library-header');
    const nav = createElement('div', 'teacher-library-breadcrumb');
    const actions = createElement('div', 'activity-library-actions');
    const viewToggle = createElement('div', 'vocab-view-toggle teacher-activity-view-toggle');
    const createButton = createElement('button', 'vocab-view-toggle-btn activity-create-toggle-btn');

    viewToggle.id = 'teacher-activity-view-toggle';
    viewToggle.setAttribute('aria-label', 'Activity view');

    createButton.id = 'create-activity-btn';
    createButton.type = 'button';
    createButton.innerHTML = '<i data-lucide="plus"></i><span>Create Activity</span>';

    const subjectsButton = manager.createLibraryBreadcrumbButton('Subjects', () => {
        manager.resetActivityLibraryDrilldown();
        manager.updateActivityRoute();
        manager.renderActivityLibraryBrowser();
        manager.refreshIcons();
    });
    nav.appendChild(subjectsButton);

    if (selectedSubject) {
        nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
        const subject = getSubjectBySlug(manager.getSubjects(), selectedSubject);
        const subjectNode = selectedGrade
            ? manager.createLibraryBreadcrumbButton(subject.name, () => {
                manager.activityDrilldown = { subject: selectedSubject, grade: null, trimester: null, month: null, week: null };
                manager.updateActivityRoute();
                manager.renderActivityLibraryBrowser();
                manager.refreshIcons();
            })
            : createElement('span', 'teacher-library-breadcrumb-current', subject.name);
        nav.appendChild(subjectNode);
    }

    if (selectedGrade) {
        nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
        const subject = getSubjectBySlug(manager.getSubjects(), selectedSubject);
        const gradeLabel = `${manager.formatActivityGroupGradeLabel(selectedGrade)} ${subject.name}`;
        const gradeNode = selectedTrimester || selectedMonth || selectedWeek
            ? manager.createLibraryBreadcrumbButton(gradeLabel, () => {
                manager.activityDrilldown = { subject: selectedSubject, grade: selectedGrade, trimester: null, month: null, week: null };
                manager.updateActivityRoute();
                manager.renderActivityLibraryBrowser();
                manager.refreshIcons();
            })
            : createElement('span', 'teacher-library-breadcrumb-current', gradeLabel);
        nav.appendChild(gradeNode);
    }

    if (selectedTrimester) {
        nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
        const trimesterLabel = manager.getTeacherTrimesterLabel(selectedTrimester);
        const trimesterNode = selectedMonth || selectedWeek
            ? manager.createLibraryBreadcrumbButton(trimesterLabel, () => {
                manager.activityDrilldown = {
                    subject: selectedSubject,
                    grade: selectedGrade,
                    trimester: selectedTrimester,
                    month: null,
                    week: null
                };
                manager.updateActivityRoute();
                manager.renderActivityLibraryBrowser();
                manager.refreshIcons();
            })
            : createElement('span', 'teacher-library-breadcrumb-current', trimesterLabel);
        nav.appendChild(trimesterNode);
    }

    if (selectedMonth) {
        nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
        const monthLabel = manager.getTeacherMonthLabel(selectedMonth);
        const monthNode = selectedWeek
            ? manager.createLibraryBreadcrumbButton(monthLabel, () => {
                manager.activityDrilldown = {
                    subject: selectedSubject,
                    grade: selectedGrade,
                    trimester: selectedTrimester,
                    month: selectedMonth,
                    week: null
                };
                manager.updateActivityRoute();
                manager.renderActivityLibraryBrowser();
                manager.refreshIcons();
            })
            : createElement('span', 'teacher-library-breadcrumb-current', monthLabel);
        nav.appendChild(monthNode);
    }

    if (selectedWeek) {
        nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
        nav.appendChild(createElement('span', 'teacher-library-breadcrumb-current', manager.formatActivityWeekLabel(selectedWeek)));
    }

    actions.append(viewToggle, createButton);
    header.append(nav, actions);
    container.appendChild(header);
    renderTeacherActivityViewControls(manager);
}

export function renderTeacherActivitySubjectPicker(manager, container, subjectGroups) {
    renderTeacherActivityLibraryBreadcrumb(manager, container);

    const grid = createElement('div', 'teacher-library-choice-grid');
    Array.from(subjectGroups.entries())
        .sort(([subjectA], [subjectB]) => {
            const metaA = getSubjectBySlug(manager.getSubjects(), subjectA);
            const metaB = getSubjectBySlug(manager.getSubjects(), subjectB);
            if (metaA.sortOrder !== metaB.sortOrder) return metaA.sortOrder - metaB.sortOrder;
            return metaA.name.localeCompare(metaB.name);
        })
        .forEach(([subjectSlug, gradeGroups]) => {
            const subject = getSubjectBySlug(manager.getSubjects(), subjectSlug);
            const activityItems = Array.from(gradeGroups.values()).flat();
            const gradeSummary = Array.from(gradeGroups.keys())
                .sort((gradeA, gradeB) => manager.compareActivityGroupGrades(gradeA, gradeB))
                .map(grade => manager.formatActivityGroupGradeLabel(grade))
                .join(' · ');
            const card = manager.createLibraryChoiceCard({
                title: subject.name,
                count: manager.formatActivityCount(activityItems.length),
                meta: gradeSummary,
                icon: 'chevron-right',
                color: subject.color
            });
            card.addEventListener('click', () => {
                manager.activityDrilldown = { subject: subjectSlug, grade: null, trimester: null, month: null, week: null };
                manager.updateActivityRoute();
                manager.renderActivityLibraryBrowser();
                manager.refreshIcons();
            });
            grid.appendChild(card);
        });

    container.appendChild(grid);
}

export function renderTeacherActivityGradePicker(manager, container, selectedSubject, gradeGroups) {
    renderTeacherActivityLibraryBreadcrumb(manager, container, selectedSubject);

    const subject = getSubjectBySlug(manager.getSubjects(), selectedSubject);
    const grid = createElement('div', 'teacher-library-choice-grid');
    Array.from(gradeGroups.entries())
        .sort(([gradeA], [gradeB]) => manager.compareActivityGroupGrades(gradeA, gradeB))
        .forEach(([grade, activityItems]) => {
            const trimesterSummary = manager.formatActivityTrimesterSummary(manager.buildActivityTrimesterGroups(activityItems));
            const card = manager.createLibraryChoiceCard({
                title: `${manager.formatActivityGroupGradeLabel(grade)} ${subject.name}`,
                count: manager.formatActivityCount(activityItems.length),
                meta: trimesterSummary || manager.formatActivityTemplateSummary(activityItems),
                icon: 'chevron-right',
                color: subject.color
            });
            card.addEventListener('click', () => {
                manager.activityDrilldown = { subject: selectedSubject, grade, trimester: null, month: null, week: null };
                manager.updateActivityRoute();
                manager.renderActivityLibraryBrowser();
                manager.refreshIcons();
            });
            grid.appendChild(card);
        });

    container.appendChild(grid);
}

export function renderTeacherActivityTrimesterPicker(manager, container, selectedSubject, selectedGrade, trimesterGroups) {
    renderTeacherActivityLibraryBreadcrumb(manager, container, selectedSubject, selectedGrade);

    const grid = createElement('div', 'teacher-library-choice-grid');
    Array.from(trimesterGroups.entries())
        .sort(([trimesterA], [trimesterB]) => manager.getTeacherTrimesterOrder(trimesterA) - manager.getTeacherTrimesterOrder(trimesterB))
        .forEach(([trimesterKey, activityItems]) => {
            const monthSummary = manager.formatActivityMonthSummary(manager.buildActivityMonthWeekGroups(activityItems));
            const card = manager.createLibraryChoiceCard({
                title: manager.getTeacherTrimesterLabel(trimesterKey),
                count: manager.formatActivityCount(activityItems.length),
                meta: monthSummary || manager.formatActivityTemplateSummary(activityItems),
                icon: 'chevron-right'
            });
            card.addEventListener('click', () => {
                manager.activityDrilldown = {
                    subject: selectedSubject,
                    grade: selectedGrade,
                    trimester: trimesterKey,
                    month: null,
                    week: null
                };
                manager.updateActivityRoute();
                manager.renderActivityLibraryBrowser();
                manager.refreshIcons();
            });
            grid.appendChild(card);
        });

    container.appendChild(grid);
}

export function renderTeacherActivityMonthPicker(manager, container, selectedSubject, selectedGrade, selectedTrimester, monthGroups) {
    renderTeacherActivityLibraryBreadcrumb(manager, container, selectedSubject, selectedGrade, selectedTrimester);

    const grid = createElement('div', 'teacher-library-choice-grid');
    Array.from(monthGroups.entries())
        .sort(([monthA], [monthB]) => manager.getTeacherMonthOrder(monthA) - manager.getTeacherMonthOrder(monthB))
        .forEach(([monthKey, weekGroups]) => {
            const activityItems = Array.from(weekGroups.values()).flat();
            const card = manager.createLibraryChoiceCard({
                title: manager.getTeacherMonthLabel(monthKey),
                count: manager.formatActivityCount(activityItems.length),
                meta: manager.formatActivityWeekSummary(weekGroups),
                icon: 'folder'
            });
            card.addEventListener('click', () => {
                manager.activityDrilldown = {
                    subject: selectedSubject,
                    grade: selectedGrade,
                    trimester: selectedTrimester,
                    month: monthKey,
                    week: null
                };
                manager.updateActivityRoute();
                manager.renderActivityLibraryBrowser();
                manager.refreshIcons();
            });
            grid.appendChild(card);
        });

    container.appendChild(grid);
}

export function renderTeacherActivityWeekPicker(manager, container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, weekGroups) {
    renderTeacherActivityLibraryBreadcrumb(manager, container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth);

    const grid = createElement('div', 'teacher-library-choice-grid');
    Array.from(weekGroups.entries())
        .sort(([weekA], [weekB]) => manager.getActivityWeekOrder(weekA) - manager.getActivityWeekOrder(weekB))
        .forEach(([weekKey, activityItems]) => {
            const card = manager.createLibraryChoiceCard({
                title: manager.formatActivityWeekLabel(weekKey),
                count: manager.formatActivityCount(activityItems.length),
                meta: manager.formatActivityTypeSummary(activityItems),
                icon: 'folder'
            });
            card.addEventListener('click', () => {
                manager.activityDrilldown = {
                    subject: selectedSubject,
                    grade: selectedGrade,
                    trimester: selectedTrimester,
                    month: selectedMonth,
                    week: weekKey
                };
                manager.updateActivityRoute();
                manager.renderActivityLibraryBrowser();
                manager.refreshIcons();
            });
            grid.appendChild(card);
        });

    container.appendChild(grid);
}

export function renderTeacherActivityClassBrowser(manager, container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, selectedWeek, activityItems) {
    renderTeacherActivityLibraryBreadcrumb(manager, container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, selectedWeek);

    if (getTeacherActivityViewMode(manager, {
        subject: selectedSubject,
        grade: selectedGrade,
        trimester: selectedTrimester,
        month: selectedMonth,
        week: selectedWeek
    }) === 'rows') {
        renderTeacherActivityRows(manager, container, activityItems);
        return;
    }

    const grid = createElement('div', 'vocab-grid trimester-vocab-grid teacher-assignment-grid');
    activityItems
        .slice()
        .sort((itemA, itemB) => manager.compareActivityPlacement(itemA.activity, itemB.activity))
        .forEach(({ activity, type }) => createTeacherActivityCard(manager, grid, activity, type));

    container.appendChild(grid);
}

export function createTeacherActivityCard(manager, container, activity, type) {
    const normalized = manager.normalizeActivity({ ...activity, source: type });
    const card = createElement('div', 'card teacher-vocab-card teacher-activity-card');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Open ${normalized.title || normalized.id || 'activity'}`);

    const badgeStyles = {
        local: { color: 'var(--accent-color)', text: 'Draft' },
        cloud: { color: 'var(--primary-hover)', text: 'Cloud' }
    };
    const badge = badgeStyles[type] || badgeStyles.local;
    const subject = manager.getSubjectForActivity(normalized);
    const grades = normalized.grades.length
        ? normalized.grades.map(grade => manager.formatGradeLabel(grade)).join(', ')
        : 'Needs grade';
    const classLabel = `${grades} · ${subject.name}`;
    const templateLabel = manager.getActivityTemplateLabel(normalized.activityData?.templateId);
    const canvasSummary = getTeacherActivityWorkspaceSummary(normalized);
    const updatedLabel = manager.formatActivityUpdatedLabel(normalized);
    const updatedMeta = updatedLabel ? `Updated ${updatedLabel}` : 'No update recorded';

    const assignBtnHtml = `
        <button class="assign-activity-btn" type="button" title="Assign Activity" aria-label="Assign ${escapeHtml(normalized.title || 'activity')}">
            <i data-lucide="send"></i>
            <span>Assign</span>
        </button>
    `;
    const testBtnHtml = `
        <button class="test-activity-btn" type="button" title="Test as Student" aria-label="Test ${escapeHtml(normalized.title || 'activity')} as student">
            <i data-lucide="play-circle"></i>
            <span>Test</span>
        </button>
    `;
    let deleteActionHtml = '';
    if (type === 'local' || type === 'cloud') {
        const label = type === 'cloud' ? 'Delete Cloud Activity' : 'Delete Draft Activity';
        deleteActionHtml = `
            <button class="delete-activity-btn teacher-card-danger-action" type="button" title="${label}" aria-label="${label}">
                <i data-lucide="trash-2"></i>
                <span>Delete</span>
            </button>
        `;
    }

    card.innerHTML = `
        <div class="teacher-card-badge-row">
            <div class="badge" style="background:${badge.color};">${badge.text}</div>
            <div class="subject-badge" style="--subject-color:${escapeHtml(subject.color)};">${escapeHtml(subject.name)}</div>
        </div>
        <h3>${escapeHtml(normalized.title || 'Untitled Activity')}</h3>
        <small class="teacher-card-primary-meta">${escapeHtml(classLabel)}</small>
        <small class="teacher-card-type-meta">${escapeHtml(manager.getActivityTypeLabel(normalized.activityType))} · ${escapeHtml(templateLabel)}</small>
        <div class="teacher-card-actions">
            <span class="teacher-pick-action"><i data-lucide="arrow-right"></i> Open</span>
            ${testBtnHtml}
            ${assignBtnHtml}
        </div>
        <details class="teacher-card-details">
            <summary>Details</summary>
            <div class="teacher-card-detail-list">
                <span>${escapeHtml(canvasSummary)}</span>
                <span>${escapeHtml(updatedMeta)}</span>
                <span>${normalized.estimatedMinutes ? `${escapeHtml(String(normalized.estimatedMinutes))} min estimate` : 'No time estimate'}</span>
                ${deleteActionHtml}
            </div>
        </details>
    `;

    card.addEventListener('click', (event) => {
        if (event.target.closest('.delete-activity-btn, .assign-activity-btn, .test-activity-btn, .teacher-card-details')) return;
        manager.loadActivityObject(normalized, type);
    });
    card.addEventListener('keydown', (event) => {
        if (event.target.closest('button, summary, .teacher-card-details')) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        card.click();
    });
    card.querySelector('.teacher-card-details')?.addEventListener('click', event => {
        event.stopPropagation();
    });
    card.querySelector('.teacher-card-details')?.addEventListener('keydown', event => {
        event.stopPropagation();
    });

    if (type === 'local' || type === 'cloud') {
        card.querySelector('.assign-activity-btn')?.addEventListener('click', (event) => {
            event.stopPropagation();
            manager.openActivityAssignmentModal(normalized);
        });

        card.querySelector('.test-activity-btn')?.addEventListener('click', (event) => {
            event.stopPropagation();
            manager.openActivityStudentPreview(normalized);
        });

        const deleteBtn = card.querySelector('.delete-activity-btn');
        deleteBtn?.addEventListener('click', async (event) => {
            event.stopPropagation();
            const label = type === 'cloud' ? 'cloud' : 'draft';
            if (!confirm(`Delete ${label} activity "${normalized.title}"? This cannot be undone.`)) return;
            if (type === 'cloud') {
                await manager.deleteCloudActivity(normalized.id);
            } else {
                manager.deleteLocalActivity(normalized.id);
            }
            await manager.loadActivityLibrary();
        });
    }

    container.appendChild(card);
}
