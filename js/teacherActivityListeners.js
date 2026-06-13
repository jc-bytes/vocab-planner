import { $, $$, closeModal as closeDialog, createElement, openModal } from './main.js';
import { ACTIVITY_TEMPLATE_OPTIONS } from './classroomActivityRegistry.js';

function getTemplateCategoryIcon(label = '') {
    const normalized = label.toLowerCase();
    if (normalized.includes('map') || normalized.includes('diagram')) return 'git-branch';
    if (normalized.includes('structured')) return 'file-text';
    if (normalized.includes('card')) return 'columns-3';
    if (normalized.includes('spreadsheet') || normalized.includes('data')) return 'table-2';
    if (normalized.includes('image')) return 'image';
    if (normalized.includes('artifact')) return 'paperclip';
    if (normalized.includes('flowchart')) return 'workflow';
    return 'sparkles';
}

function renderActivityTemplatePicker(manager) {
    const container = $('#activity-template-picker');
    if (!container || container.dataset.rendered === 'true') return;

    container.innerHTML = '';
    const templatesByType = ACTIVITY_TEMPLATE_OPTIONS.reduce((groups, template) => {
        const type = template.type || '';
        if (!groups.has(type)) groups.set(type, []);
        groups.get(type).push(template);
        return groups;
    }, new Map());

    const categories = [
        { id: 'all', label: 'All formats', icon: 'sparkles' },
        ...Array.from(templatesByType.keys()).map((type) => {
            const label = manager.getActivityTypeLabel(type);
            return {
                id: type,
                label,
                icon: getTemplateCategoryIcon(label)
            };
        })
    ];

    const sidebar = createElement('aside', 'activity-template-sidebar');
    const searchWrap = createElement('label', 'activity-template-search');
    const searchIcon = createElement('i');
    searchIcon.dataset.lucide = 'search';
    const searchInput = createElement('input');
    searchInput.id = 'activity-template-search';
    searchInput.type = 'search';
    searchInput.placeholder = 'Search formats';
    searchWrap.append(searchIcon, searchInput);

    const nav = createElement('div', 'activity-template-category-list');
    const content = createElement('div', 'activity-template-results');
    const status = createElement('p', 'activity-template-empty', 'No matching formats.');
    status.hidden = true;

    let activeCategory = 'all';

    function makeTemplateOption(template, typeLabel) {
        const option = createElement('button', 'activity-template-option');
        const preview = createElement('span', 'activity-template-preview');
        const previewIcon = createElement('i');
        previewIcon.dataset.lucide = getTemplateCategoryIcon(typeLabel);
        preview.appendChild(previewIcon);

        const title = createElement('strong', '', template.label);
        const description = createElement('span', '', template.description || '');
        const meta = createElement('small', '', typeLabel);

        option.type = 'button';
        option.dataset.activityTemplateId = template.id;
        option.append(preview, title, description, meta);
        option.addEventListener('click', () => {
            closeDialog('#activity-template-modal');
            manager.startNewActivity(template.id);
        });
        return option;
    }

    function renderTemplateGroup(type, templates) {
        const typeLabel = manager.getActivityTypeLabel(type);
        const group = createElement('section', 'activity-template-group');
        const heading = createElement('h4', '', typeLabel);
        const grid = createElement('div', 'activity-template-grid');

        templates.forEach((template) => {
            grid.appendChild(makeTemplateOption(template, typeLabel));
        });

        group.append(heading, grid);
        return group;
    }

    function updateResults() {
        const query = searchInput.value.trim().toLowerCase();
        content.innerHTML = '';
        let visibleCount = 0;

        templatesByType.forEach((templates, type) => {
            if (activeCategory !== 'all' && activeCategory !== type) return;
            const filteredTemplates = templates.filter((template) => {
                const haystack = `${template.label} ${template.description || ''} ${manager.getActivityTypeLabel(type)}`.toLowerCase();
                return !query || haystack.includes(query);
            });
            if (filteredTemplates.length === 0) return;
            visibleCount += filteredTemplates.length;
            content.appendChild(renderTemplateGroup(type, filteredTemplates));
        });

        status.hidden = visibleCount > 0;
        if (visibleCount === 0) {
            content.appendChild(status);
        }
        manager.refreshIcons?.();
    }

    categories.forEach((category) => {
        const button = createElement('button', 'activity-template-category');
        const icon = createElement('i');
        icon.dataset.lucide = category.icon;
        const label = createElement('span', '', category.label);
        button.type = 'button';
        button.dataset.activityTemplateCategory = category.id;
        button.append(icon, label);
        button.addEventListener('click', () => {
            activeCategory = category.id;
            nav.querySelectorAll('.activity-template-category').forEach((categoryButton) => {
                const isActive = categoryButton.dataset.activityTemplateCategory === activeCategory;
                categoryButton.classList.toggle('is-active', isActive);
                categoryButton.setAttribute('aria-pressed', String(isActive));
            });
            updateResults();
        });
        if (category.id === activeCategory) {
            button.classList.add('is-active');
            button.setAttribute('aria-pressed', 'true');
        } else {
            button.setAttribute('aria-pressed', 'false');
        }
        nav.appendChild(button);
    });

    searchInput.addEventListener('input', updateResults);

    sidebar.append(searchWrap, nav);
    container.append(sidebar, content);
    updateResults();
    container.dataset.rendered = 'true';
    manager.refreshIcons?.();
}

function bindActivityWorkflowTabs(manager) {
    $$('.activity-workflow-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            manager.setActivityWorkflowTab(tab.dataset.activityTab || 'assign');
        });
        tab.addEventListener('keydown', (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            const tabs = Array.from($$('.activity-workflow-tab'));
            const currentIndex = tabs.indexOf(tab);
            let nextIndex = currentIndex;
            if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
            if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = tabs.length - 1;
            event.preventDefault();
            tabs[nextIndex]?.focus();
            manager.setActivityWorkflowTab(tabs[nextIndex]?.dataset.activityTab || 'assign');
        });
    });
}

function bindActivityEditorTabs(manager) {
    $$('.activity-editor-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            manager.setActivityEditorTab(tab.dataset.activityEditorTab || 'settings');
        });
        tab.addEventListener('keydown', (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            const tabs = Array.from($$('.activity-editor-tab'));
            const currentIndex = tabs.indexOf(tab);
            let nextIndex = currentIndex;
            if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
            if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = tabs.length - 1;
            event.preventDefault();
            tabs[nextIndex]?.focus();
            manager.setActivityEditorTab(tabs[nextIndex]?.dataset.activityEditorTab || 'settings');
        });
    });
}

function bindActivityNavigation(manager) {
    document.addEventListener('click', (event) => {
        if (!event.target.closest('#create-activity-btn')) return;
        renderActivityTemplatePicker(manager);
        $('#activity-template-picker [data-activity-template-category="all"]')?.click();
        const search = $('#activity-template-search');
        if (search) {
            search.value = '';
            search.dispatchEvent(new Event('input'));
        }
        openModal('#activity-template-modal', { initialFocus: '#activity-template-search' });
    });

    $('#close-activity-template-modal')?.addEventListener('click', () => {
        closeDialog('#activity-template-modal');
    });

    $('#back-to-activities')?.addEventListener('click', () => {
        if (!manager.ensureAuthenticated(false)) return;
        manager.triggerActivityAutoSave({ syncEditor: true });
        manager.activityMode = 'assign';
        manager.showActivityLibrary();
    });

    $('#back-to-activity-assignments')?.addEventListener('click', () => {
        if (!manager.ensureAuthenticated(false)) return;
        manager.activityMode = 'review';
        manager.showActivityLibrary();
    });
}

function bindActivityReview(manager) {
    $('#test-activity-as-student-btn')?.addEventListener('click', () => {
        manager.openActivityStudentPreview(manager.activeActivityAssignment || manager.activity);
    });

    $('#refresh-activity-assignment-review-btn')?.addEventListener('click', () => {
        if (!manager.activeActivityAssignment?.id) return;
        manager.showActivityAssignmentReview(manager.activeActivityAssignment.id, { forceRefresh: true });
    });

    $('#update-published-activity-assignment-btn')?.addEventListener('click', () => {
        manager.updatePublishedActivityAssignmentFromSource();
    });

    $('#activity-review-prev-student-btn')?.addEventListener('click', () => {
        manager.showAdjacentActivityReviewStudent(-1);
    });

    $('#activity-review-next-student-btn')?.addEventListener('click', () => {
        manager.showAdjacentActivityReviewStudent(1);
    });
}

function bindActivityAssignmentModal(manager) {
    $('#assign-activity-toolbar-btn')?.addEventListener('click', () => {
        manager.openActivityAssignmentModal(manager.activity);
    });

    $('#activity-assignment-form')?.addEventListener('submit', (event) => {
        manager.saveActivityAssignment(event);
    });

    $('#cancel-activity-assignment-btn')?.addEventListener('click', () => {
        closeDialog('#activity-assignment-modal');
    });

    $('#close-activity-assignment-modal')?.addEventListener('click', () => {
        closeDialog('#activity-assignment-modal');
    });
}

function bindActivityEditorActions(manager) {
    $('#test-current-activity-as-student-btn')?.addEventListener('click', () => {
        manager.openActivityStudentPreview(manager.activity);
    });

    $('#save-activity-update-btn')?.addEventListener('click', () => {
        manager.publishActivity({ asNew: false });
    });

    $('#save-activity-new-version-btn')?.addEventListener('click', () => {
        manager.publishActivity({ asNew: true });
    });

    $('#activity-canvas-focus-btn')?.addEventListener('click', () => {
        manager.toggleActivityCanvasFocus();
    });

    $('#export-activity-btn')?.addEventListener('click', () => {
        manager.exportActivityJson();
    });

    [
        '#activity-title',
        '#activity-description',
        '#activity-grades',
        '#activity-estimated-minutes',
        '#activity-teacher-instructions',
        '#activity-student-instructions',
        '#activity-materials',
        '#activity-student-output',
        '#activity-makeup-instructions'
    ].forEach(selector => {
        $(selector)?.addEventListener('input', () => manager.triggerActivityAutoSave());
    });

    [
        '#activity-subject',
        '#activity-assessment-purpose'
    ].forEach(selector => {
        $(selector)?.addEventListener('change', () => manager.triggerActivityAutoSave());
    });

    $('#activity-type')?.addEventListener('change', () => {
        manager.handleActivityTypeSelectChange();
    });
}

export function initTeacherActivityListeners(manager) {
    bindActivityWorkflowTabs(manager);
    bindActivityEditorTabs(manager);
    bindActivityNavigation(manager);
    bindActivityReview(manager);
    bindActivityAssignmentModal(manager);
    bindActivityEditorActions(manager);
    manager.initActivityStudentPreview();
}
