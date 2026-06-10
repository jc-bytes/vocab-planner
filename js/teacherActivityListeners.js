import { $, $$, closeModal as closeDialog } from './main.js';
import { DEFAULT_ACTIVITY_TEMPLATE_ID } from './classroomActivityRegistry.js';

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
    $('#create-activity-btn')?.addEventListener('click', () => {
        const templateId = $('#activity-template-select')?.value || DEFAULT_ACTIVITY_TEMPLATE_ID;
        manager.startNewActivity(templateId);
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
