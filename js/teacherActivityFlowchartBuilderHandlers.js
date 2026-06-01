import { $ } from './main.js';
import {
    createFlowchartChecklistItem,
    createFlowchartPrompt,
    normalizeFlowchartTemplate
} from './activityFlowchartAlgorithm.js';
import { syncFlowchartTemplate } from './teacherActivityBuilderSync.js';
import { refreshPreviewAndAutosave } from './teacherActivityBuilderHandlerUtils.js';

export function handleFlowchartBuilderInput(manager, event) {
    if (!event.target.closest('.flowchart-builder-shell')) return;
    syncFlowchartTemplate(manager);
    if (event.target.matches('[data-flowchart-allowed-type]')) {
        manager.renderFlowchartBuilder();
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }
    refreshPreviewAndAutosave(manager);
}

export function handleFlowchartBuilderClick(manager, event) {
    const root = $('#activity-flowchart-root');
    if (!root) return;

    if (event.target.closest('[data-flowchart-add-check]')) {
        syncFlowchartTemplate(manager);
        const template = normalizeFlowchartTemplate(
            manager.activity.activityData?.flowchartTemplate,
            manager.activity.activityData?.templateId || 'sequence-algorithm'
        );
        if (template.checklistItems.length < 12) {
            template.checklistItems.push(createFlowchartChecklistItem(template.checklistItems.length));
        }
        manager.activity.activityData.flowchartTemplate = template;
        manager.renderFlowchartBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const checkEl = event.target.closest('[data-flowchart-check-id]');
    if (checkEl && event.target.closest('[data-flowchart-delete-check]')) {
        syncFlowchartTemplate(manager);
        const template = normalizeFlowchartTemplate(manager.activity.activityData?.flowchartTemplate);
        template.checklistItems = template.checklistItems.filter(item => item.id !== checkEl.dataset.flowchartCheckId);
        if (template.checklistItems.length === 0) {
            template.checklistItems.push(createFlowchartChecklistItem(0));
        }
        manager.activity.activityData.flowchartTemplate = template;
        manager.renderFlowchartBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-flowchart-add-prompt]')) {
        syncFlowchartTemplate(manager);
        const template = normalizeFlowchartTemplate(
            manager.activity.activityData?.flowchartTemplate,
            manager.activity.activityData?.templateId || 'sequence-algorithm'
        );
        if (template.reflectionPrompts.length < 6) {
            template.reflectionPrompts.push(createFlowchartPrompt(template.reflectionPrompts.length));
        }
        manager.activity.activityData.flowchartTemplate = template;
        manager.renderFlowchartBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const promptEl = event.target.closest('[data-flowchart-prompt-id]');
    if (promptEl && event.target.closest('[data-flowchart-delete-prompt]')) {
        syncFlowchartTemplate(manager);
        const template = normalizeFlowchartTemplate(manager.activity.activityData?.flowchartTemplate);
        template.reflectionPrompts = template.reflectionPrompts.filter(prompt => prompt.id !== promptEl.dataset.flowchartPromptId);
        manager.activity.activityData.flowchartTemplate = template;
        manager.renderFlowchartBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
    }
}
