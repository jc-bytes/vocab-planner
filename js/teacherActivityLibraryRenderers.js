import { $, createElement, escapeHtml } from './main.js';
import { getSubjectBySlug } from './services/vocabularyApi.js';
import { getTeacherActivityWorkspaceSummary } from './teacherActivitySummaries.js';

export function renderTeacherActivityLibraryBrowser(manager, container = $('#activity-library-list')) {
    if (!container) return;

    container.classList.remove('vocab-grid');
    container.classList.add('teacher-library-browser');
    container.innerHTML = '';

    const subjectGroups = manager.buildActivityLibraryGroups();
    const selectedSubject = manager.activityDrilldown.subject;
    const selectedGrade = manager.activityDrilldown.grade;
    const selectedMonth = manager.activityDrilldown.month;
    const selectedWeek = manager.activityDrilldown.week;

    if (!selectedSubject || !subjectGroups.has(selectedSubject)) {
        manager.resetActivityLibraryDrilldown();
        renderTeacherActivitySubjectPicker(manager, container, subjectGroups);
        return;
    }

    const gradeGroups = subjectGroups.get(selectedSubject);
    if (!selectedGrade || !gradeGroups.has(selectedGrade)) {
        manager.activityDrilldown.grade = null;
        manager.activityDrilldown.month = null;
        manager.activityDrilldown.week = null;
        renderTeacherActivityGradePicker(manager, container, selectedSubject, gradeGroups);
        return;
    }

    const monthGroups = manager.buildActivityMonthWeekGroups(gradeGroups.get(selectedGrade));
    if (!selectedMonth || !monthGroups.has(selectedMonth)) {
        manager.activityDrilldown.month = null;
        manager.activityDrilldown.week = null;
        renderTeacherActivityMonthPicker(manager, container, selectedSubject, selectedGrade, monthGroups);
        return;
    }

    const weekGroups = monthGroups.get(selectedMonth);
    if (!selectedWeek || !weekGroups.has(selectedWeek)) {
        manager.activityDrilldown.week = null;
        renderTeacherActivityWeekPicker(manager, container, selectedSubject, selectedGrade, selectedMonth, weekGroups);
        return;
    }

    renderTeacherActivityClassBrowser(
        manager,
        container,
        selectedSubject,
        selectedGrade,
        selectedMonth,
        selectedWeek,
        weekGroups.get(selectedWeek)
    );
}

export function renderTeacherActivityLibraryBreadcrumb(manager, container, selectedSubject = null, selectedGrade = null, selectedMonth = null, selectedWeek = null) {
    const nav = createElement('div', 'teacher-library-breadcrumb');

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
                manager.activityDrilldown = { subject: selectedSubject, grade: null, month: null, week: null };
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
        const gradeNode = selectedMonth || selectedWeek
            ? manager.createLibraryBreadcrumbButton(gradeLabel, () => {
                manager.activityDrilldown = { subject: selectedSubject, grade: selectedGrade, month: null, week: null };
                manager.updateActivityRoute();
                manager.renderActivityLibraryBrowser();
                manager.refreshIcons();
            })
            : createElement('span', 'teacher-library-breadcrumb-current', gradeLabel);
        nav.appendChild(gradeNode);
    }

    if (selectedMonth) {
        nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
        const monthLabel = manager.getTeacherMonthLabel(selectedMonth);
        const monthNode = selectedWeek
            ? manager.createLibraryBreadcrumbButton(monthLabel, () => {
                manager.activityDrilldown = { subject: selectedSubject, grade: selectedGrade, month: selectedMonth, week: null };
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

    container.appendChild(nav);
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
                manager.activityDrilldown = { subject: subjectSlug, grade: null, month: null, week: null };
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
            const monthSummary = manager.formatActivityMonthSummary(manager.buildActivityMonthWeekGroups(activityItems));
            const card = manager.createLibraryChoiceCard({
                title: `${manager.formatActivityGroupGradeLabel(grade)} ${subject.name}`,
                count: manager.formatActivityCount(activityItems.length),
                meta: monthSummary || manager.formatActivityTemplateSummary(activityItems),
                icon: 'chevron-right',
                color: subject.color
            });
            card.addEventListener('click', () => {
                manager.activityDrilldown = { subject: selectedSubject, grade, month: null, week: null };
                manager.updateActivityRoute();
                manager.renderActivityLibraryBrowser();
                manager.refreshIcons();
            });
            grid.appendChild(card);
        });

    container.appendChild(grid);
}

export function renderTeacherActivityMonthPicker(manager, container, selectedSubject, selectedGrade, monthGroups) {
    renderTeacherActivityLibraryBreadcrumb(manager, container, selectedSubject, selectedGrade);

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
                manager.activityDrilldown = { subject: selectedSubject, grade: selectedGrade, month: monthKey, week: null };
                manager.updateActivityRoute();
                manager.renderActivityLibraryBrowser();
                manager.refreshIcons();
            });
            grid.appendChild(card);
        });

    container.appendChild(grid);
}

export function renderTeacherActivityWeekPicker(manager, container, selectedSubject, selectedGrade, selectedMonth, weekGroups) {
    renderTeacherActivityLibraryBreadcrumb(manager, container, selectedSubject, selectedGrade, selectedMonth);

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

export function renderTeacherActivityClassBrowser(manager, container, selectedSubject, selectedGrade, selectedMonth, selectedWeek, activityItems) {
    renderTeacherActivityLibraryBreadcrumb(manager, container, selectedSubject, selectedGrade, selectedMonth, selectedWeek);

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
    const canvasMeta = updatedLabel ? `${canvasSummary} · Updated ${updatedLabel}` : canvasSummary;

    const assignBtnHtml = `
        <button class="assign-activity-btn" type="button" title="Assign Activity" aria-label="Assign ${escapeHtml(normalized.title || 'activity')}">
            <i data-lucide="send"></i>
            <span>Assign</span>
        </button>
    `;
    let deleteBtnHtml = '';
    if (type === 'local' || type === 'cloud') {
        const label = type === 'cloud' ? 'Delete Cloud Activity' : 'Delete Draft Activity';
        deleteBtnHtml = `<button class="delete-activity-btn" title="${label}" aria-label="${label}"><i data-lucide="trash-2"></i></button>`;
    }

    card.innerHTML = `
        <div class="badge" style="background:${badge.color};">${badge.text}</div>
        <div class="subject-badge" style="--subject-color:${escapeHtml(subject.color)};">${escapeHtml(subject.name)}</div>
        <h3>${escapeHtml(normalized.title || 'Untitled Activity')}</h3>
        <small style="color:var(--text-muted)">${escapeHtml(classLabel)}</small>
        <small style="color:var(--text-muted)">${escapeHtml(manager.getActivityTypeLabel(normalized.activityType))} · ${escapeHtml(templateLabel)}</small>
        <small style="color:var(--text-muted)">${escapeHtml(canvasMeta)}</small>
        <small style="color:var(--text-muted)">${normalized.estimatedMinutes ? `${escapeHtml(String(normalized.estimatedMinutes))} min` : 'No time estimate'}</small>
        ${assignBtnHtml}
        ${deleteBtnHtml}
    `;

    card.addEventListener('click', (event) => {
        if (event.target.closest('.delete-activity-btn, .assign-activity-btn')) return;
        manager.loadActivityObject(normalized, type);
    });
    card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        card.click();
    });

    if (type === 'local' || type === 'cloud') {
        card.querySelector('.assign-activity-btn')?.addEventListener('click', (event) => {
            event.stopPropagation();
            manager.openActivityAssignmentModal(normalized);
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
