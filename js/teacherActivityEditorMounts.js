import { $, notifications } from './main.js';
import { normalizeResponseTemplate } from './activityStructuredResponse.js';
import { normalizeCardSortTemplate } from './activityCardSort.js';
import { normalizeSpreadsheetTemplate } from './activitySpreadsheetTable.js';
import { normalizeImageHotspotTemplate } from './activityImageHotspot.js';
import { normalizeExternalArtifactTemplate } from './activityExternalArtifact.js';
import { normalizeFlowchartTemplate } from './activityFlowchartAlgorithm.js';
import { DEFAULT_ACTIVITY_TEMPLATE_ID } from './classroomActivityRegistry.js';

const WORKSPACE_ROOTS = {
    canvas: '#activity-excalidraw-root',
    structured: '#activity-structured-root',
    cardSort: '#activity-card-sort-root',
    spreadsheet: '#activity-spreadsheet-root',
    imageHotspot: '#activity-image-hotspot-root',
    externalArtifact: '#activity-external-artifact-root',
    flowchart: '#activity-flowchart-root'
};

function prepareActivityWorkspace(manager, activeKey, title, options = {}) {
    const roots = Object.fromEntries(
        Object.entries(WORKSPACE_ROOTS).map(([key, selector]) => [key, $(selector)])
    );
    const root = roots[activeKey];
    const status = $('#activity-excalidraw-status');
    if (!root) return { root: null, status };

    manager.activityEditorHandle?.unmount?.();
    manager.activityEditorHandle = null;
    manager.activityEditorAutosaveReady = options.autosaveReady ?? true;
    clearTimeout(manager.activityEditorAutosaveReadyTimeout);
    manager.activityEditorAutosaveReadyTimeout = null;

    Object.entries(roots).forEach(([key, element]) => {
        if (!element) return;
        if (key === activeKey) {
            element.classList.remove('hidden');
            if (options.clearActiveRoot !== false) element.innerHTML = '';
            return;
        }
        element.classList.add('hidden');
        element.innerHTML = '';
    });

    $('#activity-workspace-title') && ($('#activity-workspace-title').textContent = title);
    $('#activity-canvas-focus-btn span') && ($('#activity-canvas-focus-btn span').textContent = options.focusLabel || 'Focus Builder');
    if (status) status.textContent = options.statusText || 'Builder ready.';
    return { root, status };
}

export async function mountTeacherActivityEditor(manager) {
    if (manager.isStructuredActivity()) {
        manager.mountStructuredActivityEditor();
        return;
    }

    if (manager.isCardSortActivity()) {
        manager.mountCardSortActivityEditor();
        return;
    }

    if (manager.isSpreadsheetActivity()) {
        manager.mountSpreadsheetActivityEditor();
        return;
    }

    if (manager.isImageHotspotActivity()) {
        manager.mountImageHotspotActivityEditor();
        return;
    }

    if (manager.isExternalArtifactActivity()) {
        manager.mountExternalArtifactActivityEditor();
        return;
    }

    if (manager.isFlowchartActivity()) {
        manager.mountFlowchartActivityEditor();
        return;
    }

    await manager.mountMapActivityEditor();
}

export async function mountTeacherMapActivityEditor(manager) {
    const { root, status } = prepareActivityWorkspace(manager, 'canvas', 'Canvas', {
        autosaveReady: false,
        focusLabel: 'Focus Canvas',
        statusText: 'Loading editor...'
    });
    if (!root) return;

    try {
        manager.configureExcalidrawAssets();
        const { mountActivityExcalidraw } = await import('./activityExcalidrawEditor.js');
        const templateId = manager.activity?.activityData?.templateId || DEFAULT_ACTIVITY_TEMPLATE_ID;
        manager.activityEditorHandle = mountActivityExcalidraw(root, {
            scene: manager.activity?.activityData?.excalidrawScene,
            templateId,
            onChange: (scene) => {
                if (!manager.activity?.id) return;
                manager.activity.activityData = {
                    ...(manager.activity.activityData || {}),
                    templateId,
                    excalidrawScene: scene
                };
                if (manager.activityEditorAutosaveReady) {
                    manager.triggerActivityAutoSave({ readForm: false });
                }
            },
            onReady: () => {
                if (status) status.textContent = 'Editor ready.';
                clearTimeout(manager.activityEditorAutosaveReadyTimeout);
                manager.activityEditorAutosaveReadyTimeout = window.setTimeout(() => {
                    manager.activityEditorAutosaveReady = true;
                    manager.activityEditorAutosaveReadyTimeout = null;
                }, 500);
            }
        });
    } catch (error) {
        console.error('Failed to load activity editor:', error);
        manager.activityEditorAutosaveReady = false;
        clearTimeout(manager.activityEditorAutosaveReadyTimeout);
        manager.activityEditorAutosaveReadyTimeout = null;
        manager.renderActivityEditorLoadError(root);
        if (status) status.textContent = 'Editor unavailable. Try again or refresh this page.';
        notifications.warning('Canvas editor did not load. Try again or refresh the page.');
    }
}

export function mountTeacherStructuredActivityEditor(manager) {
    const { root } = prepareActivityWorkspace(manager, 'structured', 'Response Builder');
    if (!root) return;

    const templateId = manager.activity?.activityData?.templateId || 'worksheet';
    manager.activity.activityData = {
        ...(manager.activity.activityData || {}),
        responseTemplate: normalizeResponseTemplate(manager.activity.activityData?.responseTemplate, templateId)
    };
    manager.renderStructuredResponseBuilder(root);
}

export function mountTeacherCardSortActivityEditor(manager) {
    const { root } = prepareActivityWorkspace(manager, 'cardSort', 'Card Sort Builder');
    if (!root) return;

    const templateId = manager.activity?.activityData?.templateId || 'category-sort';
    manager.activity.activityData = {
        ...(manager.activity.activityData || {}),
        cardSortTemplate: normalizeCardSortTemplate(manager.activity.activityData?.cardSortTemplate, templateId)
    };
    manager.renderCardSortBuilder(root);
}

export function mountTeacherSpreadsheetActivityEditor(manager) {
    const { root } = prepareActivityWorkspace(manager, 'spreadsheet', 'Spreadsheet Builder');
    if (!root) return;

    const templateId = manager.activity?.activityData?.templateId || 'data-table';
    manager.activity.activityData = {
        ...(manager.activity.activityData || {}),
        spreadsheetTemplate: normalizeSpreadsheetTemplate(manager.activity.activityData?.spreadsheetTemplate, templateId)
    };
    manager.renderSpreadsheetBuilder(root);
}

export function mountTeacherImageHotspotActivityEditor(manager) {
    const { root } = prepareActivityWorkspace(manager, 'imageHotspot', 'Image Hotspot Builder');
    if (!root) return;

    const templateId = manager.activity?.activityData?.templateId || 'label-image-parts';
    manager.activity.activityData = {
        ...(manager.activity.activityData || {}),
        imageHotspotTemplate: normalizeImageHotspotTemplate(manager.activity.activityData?.imageHotspotTemplate, templateId)
    };
    manager.renderImageHotspotBuilder(root);
}

export function mountTeacherExternalArtifactActivityEditor(manager) {
    const { root } = prepareActivityWorkspace(manager, 'externalArtifact', 'Evidence Builder');
    if (!root) return;

    const templateId = manager.activity?.activityData?.templateId || 'project-evidence';
    manager.activity.activityData = {
        ...(manager.activity.activityData || {}),
        externalArtifactTemplate: normalizeExternalArtifactTemplate(manager.activity.activityData?.externalArtifactTemplate, templateId)
    };
    manager.renderExternalArtifactBuilder(root);
}

export function mountTeacherFlowchartActivityEditor(manager) {
    const { root } = prepareActivityWorkspace(manager, 'flowchart', 'Flowchart Builder');
    if (!root) return;

    const templateId = manager.activity?.activityData?.templateId || 'sequence-algorithm';
    manager.activity.activityData = {
        ...(manager.activity.activityData || {}),
        flowchartTemplate: normalizeFlowchartTemplate(manager.activity.activityData?.flowchartTemplate, templateId)
    };
    manager.renderFlowchartBuilder(root);
}
