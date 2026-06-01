import { $, createElement, escapeHtml } from './main.js';
import { getSubjectBySlug } from './services/vocabularyApi.js';

export function renderTeacherActivityAssignmentBrowser(manager, container = $('#activity-assignment-list')) {
    if (!container) return;

    container.classList.remove('vocab-grid');
    container.classList.add('teacher-library-browser');
    container.innerHTML = '';

    const subjectGroups = manager.buildActivityAssignmentGroups();
    if (subjectGroups.size === 0) {
        container.innerHTML = '<p class="teacher-empty-state">No activities assigned yet.</p>';
        return;
    }

    const selectedSubject = manager.activityDrilldown.subject;
    const selectedGrade = manager.activityDrilldown.grade;

    if (!selectedSubject || !subjectGroups.has(selectedSubject)) {
        manager.resetActivityLibraryDrilldown();
        renderTeacherActivityAssignmentSubjectPicker(manager, container, subjectGroups);
        return;
    }

    const gradeGroups = subjectGroups.get(selectedSubject);
    if (!selectedGrade || !gradeGroups.has(selectedGrade)) {
        manager.activityDrilldown.grade = null;
        renderTeacherActivityAssignmentGradePicker(manager, container, selectedSubject, gradeGroups);
        return;
    }

    renderTeacherActivityAssignmentClassBrowser(manager, container, selectedSubject, selectedGrade, gradeGroups.get(selectedGrade));
}

export function renderTeacherActivityAssignmentBreadcrumb(manager, container, selectedSubject = null, selectedGrade = null) {
    const nav = createElement('div', 'teacher-library-breadcrumb');

    const subjectsButton = manager.createLibraryBreadcrumbButton('Subjects', () => {
        manager.resetActivityLibraryDrilldown();
        manager.updateActivityRoute();
        manager.renderActivityAssignmentBrowser();
        manager.refreshIcons();
    });
    nav.appendChild(subjectsButton);

    if (selectedSubject) {
        nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
        const subject = getSubjectBySlug(manager.getSubjects(), selectedSubject);
        const subjectNode = selectedGrade
            ? manager.createLibraryBreadcrumbButton(subject.name, () => {
                manager.activityDrilldown = { subject: selectedSubject, grade: null };
                manager.updateActivityRoute();
                manager.renderActivityAssignmentBrowser();
                manager.refreshIcons();
            })
            : createElement('span', 'teacher-library-breadcrumb-current', subject.name);
        nav.appendChild(subjectNode);
    }

    if (selectedGrade) {
        nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
        const subject = getSubjectBySlug(manager.getSubjects(), selectedSubject);
        nav.appendChild(createElement(
            'span',
            'teacher-library-breadcrumb-current',
            `${manager.formatActivityGroupGradeLabel(selectedGrade)} ${subject.name}`
        ));
    }

    container.appendChild(nav);
}

export function renderTeacherActivityAssignmentSubjectPicker(manager, container, subjectGroups) {
    renderTeacherActivityAssignmentBreadcrumb(manager, container);

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
            const assignments = Array.from(gradeGroups.values()).flat();
            const gradeSummary = Array.from(gradeGroups.keys())
                .sort((gradeA, gradeB) => manager.compareActivityGroupGrades(gradeA, gradeB))
                .map(grade => manager.formatActivityGroupGradeLabel(grade))
                .join(' · ');
            const card = manager.createLibraryChoiceCard({
                title: subject.name,
                count: manager.formatActivityAssignmentCount(assignments.length),
                meta: gradeSummary,
                icon: 'chevron-right',
                color: subject.color
            });
            card.addEventListener('click', () => {
                manager.activityDrilldown = { subject: subjectSlug, grade: null };
                manager.updateActivityRoute();
                manager.renderActivityAssignmentBrowser();
                manager.refreshIcons();
            });
            grid.appendChild(card);
        });

    container.appendChild(grid);
}

export function renderTeacherActivityAssignmentGradePicker(manager, container, selectedSubject, gradeGroups) {
    renderTeacherActivityAssignmentBreadcrumb(manager, container, selectedSubject);

    const subject = getSubjectBySlug(manager.getSubjects(), selectedSubject);
    const grid = createElement('div', 'teacher-library-choice-grid');
    Array.from(gradeGroups.entries())
        .sort(([gradeA], [gradeB]) => manager.compareActivityGroupGrades(gradeA, gradeB))
        .forEach(([grade, assignments]) => {
            const card = manager.createLibraryChoiceCard({
                title: `${manager.formatActivityGroupGradeLabel(grade)} ${subject.name}`,
                count: manager.formatActivityAssignmentCount(assignments.length),
                meta: manager.formatAssignmentReviewSummary(assignments),
                icon: 'chevron-right',
                color: subject.color
            });
            card.addEventListener('click', () => {
                manager.activityDrilldown = { subject: selectedSubject, grade };
                manager.updateActivityRoute();
                manager.renderActivityAssignmentBrowser();
                manager.refreshIcons();
            });
            grid.appendChild(card);
        });

    container.appendChild(grid);
}

export function renderTeacherActivityAssignmentClassBrowser(manager, container, selectedSubject, selectedGrade, assignments) {
    renderTeacherActivityAssignmentBreadcrumb(manager, container, selectedSubject, selectedGrade);

    const grid = createElement('div', 'vocab-grid trimester-vocab-grid teacher-assignment-grid compact-vocab-grid');
    assignments
        .slice()
        .sort((a, b) => manager.getActivityAssignmentSortValue(b) - manager.getActivityAssignmentSortValue(a))
        .forEach(assignment => createTeacherActivityAssignmentCard(manager, grid, assignment));

    container.appendChild(grid);
}

function getTeacherAssignmentCueItems(manager, assignment, isScheduled) {
    const cues = [];
    const dueMillis = manager.dueDateEndMillis(assignment.dueDate || assignment.due_date);
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    if (isScheduled) {
        cues.push({ label: 'Not visible yet', className: 'teacher-card-cue-scheduled' });
    }

    if (dueMillis && dueMillis < now) {
        cues.push({ label: 'Past due', className: 'teacher-card-cue-danger' });
    } else if (dueMillis && dueMillis - now <= dayMs) {
        cues.push({ label: 'Due today', className: 'teacher-card-cue-warning' });
    } else if (dueMillis && dueMillis - now <= 3 * dayMs) {
        cues.push({ label: 'Due soon', className: 'teacher-card-cue-warning' });
    }

    return cues;
}

export function createTeacherActivityAssignmentCard(manager, container, assignment) {
    const normalized = manager.normalizeActivityAssignment(assignment);
    const card = createElement('div', 'card teacher-vocab-card teacher-activity-card activity-assignment-card');
    card.dataset.assignmentId = normalized.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Review ${normalized.title || 'assigned activity'}`);

    const subject = manager.getSubjectForActivity(normalized);
    const target = manager.formatAssignmentTarget(normalized);
    const schedule = manager.formatAssignmentWindow(normalized);
    const statusLabel = normalized.status === 'archived' ? 'Archived' : 'Active';
    const isScheduled = manager.isAssignmentScheduled(normalized);
    const cueItems = getTeacherAssignmentCueItems(manager, normalized, isScheduled);
    const cueHtml = cueItems.length
        ? `<div class="teacher-card-cue-row">${cueItems.map(cue => (
            `<span class="teacher-card-cue ${cue.className}">${escapeHtml(cue.label)}</span>`
        )).join('')}</div>`
        : '';
    card.classList.toggle('is-scheduled', isScheduled);

    card.innerHTML = `
        <div class="teacher-card-badge-row">
            <div class="badge" style="background:${normalized.status === 'archived' ? 'var(--text-muted)' : 'var(--success-color)'};">${escapeHtml(statusLabel)}</div>
        </div>
        <h3>${escapeHtml(normalized.title || 'Untitled Assignment')}</h3>
        <small class="teacher-card-primary-meta">${escapeHtml(target)}</small>
        ${cueHtml}
        <div class="teacher-card-actions">
            <span class="teacher-pick-action"><i data-lucide="clipboard-check"></i> Review</span>
        </div>
        <details class="teacher-card-details">
            <summary>Details</summary>
            <div class="teacher-card-detail-list">
                <span>${escapeHtml(schedule)}</span>
                <span>${escapeHtml(subject.name)}</span>
                ${isScheduled ? '<span class="teacher-card-warning">Not visible to students yet</span>' : ''}
                <button class="delete-activity-assignment-btn teacher-card-danger-action" type="button" title="Delete Assignment" aria-label="Delete ${escapeHtml(normalized.title || 'assignment')}">
                    <i data-lucide="trash-2"></i>
                    <span>Delete</span>
                </button>
            </div>
        </details>
    `;

    card.addEventListener('click', (event) => {
        if (event.target.closest('.delete-activity-assignment-btn, .teacher-card-details')) return;
        manager.showActivityAssignmentReview(normalized.id);
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
    card.querySelector('.delete-activity-assignment-btn')?.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (!confirm(`Delete assignment "${normalized.title}" and its submissions? This cannot be undone.`)) return;
        await manager.deleteActivityAssignment(normalized.id);
    });

    container.appendChild(card);
}
