import { $ } from './main.js';
import {
    createExternalArtifactChecklistItem,
    createExternalArtifactPrompt,
    normalizeExternalArtifactTemplate
} from './activityExternalArtifact.js';
import { syncExternalArtifactTemplate } from './teacherActivityBuilderSync.js';
import { refreshPreviewAndAutosave } from './teacherActivityBuilderHandlerUtils.js';

export function handleExternalArtifactBuilderInput(manager, event) {
    if (!event.target.closest('.external-artifact-builder-shell')) return;
    syncExternalArtifactTemplate(manager);
    refreshPreviewAndAutosave(manager);
}

export function handleExternalArtifactBuilderClick(manager, event) {
    const root = $('#activity-external-artifact-root');
    if (!root) return;

    if (event.target.closest('[data-external-artifact-add-check]')) {
        syncExternalArtifactTemplate(manager);
        const template = normalizeExternalArtifactTemplate(
            manager.activity.activityData?.externalArtifactTemplate,
            manager.activity.activityData?.templateId || 'project-evidence'
        );
        if (template.checklistItems.length < 12) {
            template.checklistItems.push(createExternalArtifactChecklistItem(template.checklistItems.length));
        }
        manager.activity.activityData.externalArtifactTemplate = template;
        manager.renderExternalArtifactBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const checkEl = event.target.closest('[data-external-artifact-check-id]');
    if (checkEl && event.target.closest('[data-external-artifact-delete-check]')) {
        syncExternalArtifactTemplate(manager);
        const template = normalizeExternalArtifactTemplate(manager.activity.activityData?.externalArtifactTemplate);
        template.checklistItems = template.checklistItems.filter(item => item.id !== checkEl.dataset.externalArtifactCheckId);
        if (template.checklistItems.length === 0) {
            template.checklistItems.push(createExternalArtifactChecklistItem(0));
        }
        manager.activity.activityData.externalArtifactTemplate = template;
        manager.renderExternalArtifactBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-external-artifact-add-prompt]')) {
        syncExternalArtifactTemplate(manager);
        const template = normalizeExternalArtifactTemplate(
            manager.activity.activityData?.externalArtifactTemplate,
            manager.activity.activityData?.templateId || 'project-evidence'
        );
        if (template.reflectionPrompts.length < 6) {
            template.reflectionPrompts.push(createExternalArtifactPrompt(template.reflectionPrompts.length));
        }
        manager.activity.activityData.externalArtifactTemplate = template;
        manager.renderExternalArtifactBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const promptEl = event.target.closest('[data-external-artifact-prompt-id]');
    if (promptEl && event.target.closest('[data-external-artifact-delete-prompt]')) {
        syncExternalArtifactTemplate(manager);
        const template = normalizeExternalArtifactTemplate(manager.activity.activityData?.externalArtifactTemplate);
        template.reflectionPrompts = template.reflectionPrompts.filter(prompt => prompt.id !== promptEl.dataset.externalArtifactPromptId);
        manager.activity.activityData.externalArtifactTemplate = template;
        manager.renderExternalArtifactBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
    }
}
