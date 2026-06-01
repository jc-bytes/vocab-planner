import { $, $$ } from './main.js';
import { STRUCTURED_RESPONSE_TYPE } from './activityStructuredResponse.js';
import { CARD_SORT_TYPE } from './activityCardSort.js';
import { SPREADSHEET_TABLE_TYPE } from './activitySpreadsheetTable.js';
import { IMAGE_HOTSPOT_TYPE } from './activityImageHotspot.js';
import { EXTERNAL_ARTIFACT_TYPE } from './activityExternalArtifact.js';
import { FLOWCHART_ALGORITHM_TYPE } from './activityFlowchartAlgorithm.js';
import {
    DEFAULT_SUBJECT_SLUG,
    normalizeSubjectSlug
} from './services/vocabularyApi.js';
import {
    DEFAULT_ACTIVITY_TEMPLATE_ID,
    DEFAULT_ACTIVITY_TYPE,
    createDefaultActivityData,
    getDefaultTemplateIdForType
} from './classroomActivityRegistry.js';

export function getSelectedTeacherActivityClassContext(manager) {
    const subjectSlug = manager.activityDrilldown.subject
        ? normalizeSubjectSlug(manager.activityDrilldown.subject)
        : DEFAULT_SUBJECT_SLUG;
    const grade = manager.activityDrilldown.grade && manager.activityDrilldown.grade !== 'needs-grade'
        ? manager.normalizeGradeLabel(manager.activityDrilldown.grade)
        : '';
    return { subjectSlug, grade };
}

export async function startNewTeacherActivity(manager, templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
    if (!manager.ensureAuthenticated()) return;
    manager.activity = manager.createDefaultActivity(templateId);
    manager.activityEditorTab = 'settings';
    manager.structuredBuilderMode = 'build';
    const classContext = manager.getSelectedActivityClassContext();
    manager.activity.subjectSlug = classContext.subjectSlug;
    manager.activity.grades = classContext.grade ? [classContext.grade] : [];
    manager.activity.source = 'local';
    manager.deletedActivityIds.delete(manager.activity.id);
    manager.saveActivityToLocal(manager.activity);
    manager.setActivitySaveStatus('Draft saved locally.', 'success');
    await manager.showActivityEditor();
}

export async function showTeacherActivityEditor(manager) {
    if (!manager.ensureAuthenticated(false)) return;
    if (!manager.activity?.id) {
        manager.activity = manager.createDefaultActivity();
    }
    manager.activity = manager.normalizeActivity(manager.activity);
    manager.setActivityCanvasFocus(false);
    manager.switchView('teacher-activity-editor-view');
    manager.updateActivityFormUI();
    await manager.mountActivityEditor();
    manager.setActivityEditorTab(manager.activityEditorTab || 'settings', { sync: false });
}

export function getTeacherActivityEditorTab(manager, tab = manager.activityEditorTab) {
    const allowedTabs = ['settings', 'instructions', 'build', 'preview'];
    return allowedTabs.includes(tab) ? tab : 'settings';
}

export function updateTeacherActivityFocusButtonLabel(manager) {
    const button = $('#activity-canvas-focus-btn');
    if (!button) return;
    const view = $('#teacher-activity-editor-view');
    const label = button.querySelector('span');
    const isFocused = view?.classList.contains('canvas-focus');
    const focusLabel = (
        manager.isStructuredActivity()
        || manager.isCardSortActivity()
        || manager.isSpreadsheetActivity()
        || manager.isImageHotspotActivity()
        || manager.isExternalArtifactActivity()
        || manager.isFlowchartActivity()
    )
        ? 'Focus Builder'
        : 'Focus Canvas';
    button.setAttribute('aria-pressed', isFocused ? 'true' : 'false');
    if (label) label.textContent = isFocused ? 'Show Tabs' : focusLabel;
}

export function setTeacherActivityEditorTab(manager, tab = 'settings', options = {}) {
    const activeTab = manager.getActivityEditorTab(tab);

    if (options.sync !== false && manager.activity?.id) {
        manager.syncActivityWorkspace();
        manager.readActivityFormIntoModel();
    }

    manager.activityEditorTab = activeTab;

    $$('.activity-editor-tab').forEach(button => {
        const isActive = button.dataset.activityEditorTab === activeTab;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        button.tabIndex = isActive ? 0 : -1;
    });

    $$('[data-activity-editor-panel]').forEach(panel => {
        const isActive = panel.dataset.activityEditorPanel === activeTab;
        panel.classList.toggle('hidden', !isActive);
        panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });

    const view = $('#teacher-activity-editor-view');
    if (activeTab !== 'build') {
        view?.classList.remove('canvas-focus');
    }

    if (activeTab === 'preview') {
        manager.renderActivityPreviewPanel();
    }

    manager.updateActivityFocusButtonLabel();

    if (activeTab === 'build') {
        window.requestAnimationFrame(() => {
            window.dispatchEvent(new Event('resize'));
        });
    }
}

export function updateTeacherActivityFormUI(manager) {
    if (!manager.activity?.id) return;
    const activity = manager.normalizeActivity(manager.activity);
    manager.activity = activity;
    const setValue = (selector, value) => {
        const field = $(selector);
        if (field) field.value = value ?? '';
    };

    setValue('#activity-id', activity.id);
    setValue('#activity-title', activity.title);
    setValue('#activity-description', activity.description);
    manager.updateActivitySubjectSelect();
    setValue('#activity-grades', activity.grades.join(', '));
    setValue('#activity-type', activity.activityType);
    setValue('#activity-assessment-purpose', activity.assessmentPurpose);
    setValue('#activity-estimated-minutes', activity.estimatedMinutes);
    setValue('#activity-teacher-instructions', activity.teacherInstructions);
    setValue('#activity-student-instructions', activity.studentInstructions);
    setValue('#activity-materials', activity.materials);
    setValue('#activity-student-output', activity.studentOutput);
    setValue('#activity-makeup-instructions', activity.makeupInstructions);
    manager.setActivitySaveStatus(activity.source === 'cloud' ? 'Loaded from cloud.' : 'Draft saved locally.', 'muted');
}

export function readTeacherActivityFormIntoModel(manager) {
    if (!manager.activity?.id) return;
    const valueOf = (selector) => $(selector)?.value ?? '';
    const grades = valueOf('#activity-grades')
        .split(',')
        .map(grade => manager.normalizeGradeLabel(grade))
        .filter(Boolean);
    const estimated = valueOf('#activity-estimated-minutes');

    manager.activity = manager.normalizeActivity({
        ...manager.activity,
        id: valueOf('#activity-id') || manager.activity.id,
        title: valueOf('#activity-title') || 'Untitled Activity',
        description: valueOf('#activity-description'),
        activityType: valueOf('#activity-type') || DEFAULT_ACTIVITY_TYPE,
        subjectSlug: normalizeSubjectSlug(valueOf('#activity-subject') || DEFAULT_SUBJECT_SLUG),
        grades,
        teacherInstructions: valueOf('#activity-teacher-instructions'),
        studentInstructions: valueOf('#activity-student-instructions'),
        materials: valueOf('#activity-materials'),
        estimatedMinutes: estimated === '' ? '' : Number.parseInt(String(estimated), 10) || '',
        studentOutput: valueOf('#activity-student-output'),
        makeupInstructions: valueOf('#activity-makeup-instructions'),
        assessmentPurpose: valueOf('#activity-assessment-purpose') || 'formative',
        activityData: manager.activity.activityData || {}
    });
}

export function validateTeacherActivityClass(manager, activity = manager.activity) {
    const normalized = manager.normalizeActivity(activity);
    if (!normalized.subjectSlug) {
        throw new Error('Choose a subject before saving this activity.');
    }
    if (normalized.grades.length === 0) {
        throw new Error('Enter at least one grade level before saving this activity.');
    }
    return normalized;
}

function isActivityType(activity = {}, type) {
    return (activity?.activityType || activity?.activity_type) === type;
}

export function isStructuredTeacherActivity(activity) {
    return isActivityType(activity, STRUCTURED_RESPONSE_TYPE);
}

export function isCardSortTeacherActivity(activity) {
    return isActivityType(activity, CARD_SORT_TYPE);
}

export function isSpreadsheetTeacherActivity(activity) {
    return isActivityType(activity, SPREADSHEET_TABLE_TYPE);
}

export function isImageHotspotTeacherActivity(activity) {
    return isActivityType(activity, IMAGE_HOTSPOT_TYPE);
}

export function isExternalArtifactTeacherActivity(activity) {
    return isActivityType(activity, EXTERNAL_ARTIFACT_TYPE);
}

export function isFlowchartTeacherActivity(activity) {
    return isActivityType(activity, FLOWCHART_ALGORITHM_TYPE);
}

export function syncTeacherActivityWorkspace(manager) {
    if (manager.isStructuredActivity()) {
        manager.syncStructuredResponseTemplate();
    } else if (manager.isCardSortActivity()) {
        manager.syncCardSortTemplate();
    } else if (manager.isSpreadsheetActivity()) {
        manager.syncSpreadsheetTemplate();
    } else if (manager.isImageHotspotActivity()) {
        manager.syncImageHotspotTemplate();
    } else if (manager.isExternalArtifactActivity()) {
        manager.syncExternalArtifactTemplate();
    } else if (manager.isFlowchartActivity()) {
        manager.syncFlowchartTemplate();
    } else {
        manager.syncActivityEditorScene();
    }
}

export function syncTeacherActivityEditorScene(manager) {
    const scene = manager.activityEditorHandle?.getScene?.();
    if (!scene || !manager.activity?.id) return;
    manager.activity.activityData = {
        ...(manager.activity.activityData || {}),
        excalidrawScene: scene
    };
}

export function renderTeacherActivityEditorLoadError(manager, root) {
    root.innerHTML = `
        <div class="activity-editor-error" role="status">
            <h3>Map editor unavailable</h3>
            <p>The canvas assets did not finish loading.</p>
            <div class="activity-editor-error-actions">
                <button type="button" class="btn secondary-btn" data-activity-editor-retry>Retry</button>
                <button type="button" class="btn text-btn" data-activity-editor-refresh>Refresh Page</button>
            </div>
        </div>
    `;

    root.querySelector('[data-activity-editor-retry]')?.addEventListener('click', () => {
        manager.mountActivityEditor();
    });

    root.querySelector('[data-activity-editor-refresh]')?.addEventListener('click', () => {
        manager.readActivityFormIntoModel();
        manager.saveActivityToLocal(manager.activity);
        window.location.reload();
    });
}

export function setTeacherActivitySaveStatus(text, state = 'muted') {
    const status = $('#activity-save-status');
    if (!status) return;
    status.textContent = text;
    const colors = {
        success: 'var(--success-color)',
        error: 'var(--danger-color)',
        info: 'var(--secondary-color)',
        muted: 'var(--text-muted)'
    };
    status.style.color = colors[state] || colors.muted;
}

export function setTeacherActivityCanvasFocus(manager, isFocused) {
    const view = $('#teacher-activity-editor-view');
    if (!view) return;

    if (isFocused && manager.activityEditorTab !== 'build') {
        manager.setActivityEditorTab('build');
    }

    view.classList.toggle('canvas-focus', Boolean(isFocused));
    manager.updateActivityFocusButtonLabel();

    window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
    });
}

export function toggleTeacherActivityCanvasFocus(manager) {
    const view = $('#teacher-activity-editor-view');
    if (!view) return;

    if (!view.classList.contains('canvas-focus')) {
        manager.syncActivityWorkspace();
        manager.readActivityFormIntoModel();
    }

    manager.setActivityCanvasFocus(!view.classList.contains('canvas-focus'));
}

export async function handleTeacherActivityTypeSelectChange(manager) {
    const selectedType = $('#activity-type')?.value || DEFAULT_ACTIVITY_TYPE;
    const currentEditorTab = manager.activityEditorTab;
    manager.syncActivityWorkspace();
    manager.readActivityFormIntoModel();

    const currentTemplate = manager.getActivityTemplate(manager.activity.activityData?.templateId || DEFAULT_ACTIVITY_TEMPLATE_ID);
    if (currentTemplate.type !== selectedType) {
        manager.activity.activityType = selectedType;
        manager.activity.activityData = {
            ...(manager.activity.activityData || {}),
            ...createDefaultActivityData(getDefaultTemplateIdForType(selectedType))
        };
    } else {
        manager.activity.activityType = selectedType;
    }

    manager.activity = manager.normalizeActivity(manager.activity);
    manager.updateActivityFormUI();
    await manager.mountActivityEditor();
    manager.setActivityEditorTab(currentEditorTab, { sync: false });
    manager.triggerActivityAutoSave({ readForm: false });
}
