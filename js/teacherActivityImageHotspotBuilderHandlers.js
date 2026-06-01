import { $, notifications } from './main.js';
import {
    IMAGE_HOTSPOT_MAX_LABELS,
    createImageHotspotLabel,
    createImageHotspotPrompt,
    normalizeImageHotspotTemplate
} from './activityImageHotspot.js';
import { syncImageHotspotTemplate } from './teacherActivityBuilderSync.js';
import { refreshPreviewAndAutosave } from './teacherActivityBuilderHandlerUtils.js';

export function handleImageHotspotBuilderInput(manager, event) {
    if (!event.target.closest('.image-hotspot-builder-shell')) return;
    syncImageHotspotTemplate(manager);
    refreshPreviewAndAutosave(manager);
}

export function handleImageHotspotBuilderClick(manager, event) {
    const root = $('#activity-image-hotspot-root');
    if (!root) return;

    if (event.target.closest('[data-image-hotspot-add-label]')) {
        syncImageHotspotTemplate(manager);
        const template = normalizeImageHotspotTemplate(manager.activity.activityData?.imageHotspotTemplate, manager.activity.activityData?.templateId || 'label-image-parts');
        if (template.labels.length >= IMAGE_HOTSPOT_MAX_LABELS) {
            notifications.warning(`Image hotspot activities can have up to ${IMAGE_HOTSPOT_MAX_LABELS} labels.`);
            return;
        }
        template.labels.push(createImageHotspotLabel({
            text: `Label ${template.labels.length + 1}`,
            required: true
        }, template.labels.length));
        manager.activity.activityData.imageHotspotTemplate = normalizeImageHotspotTemplate(template, template.templateId);
        manager.renderImageHotspotBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const labelEl = event.target.closest('[data-image-hotspot-label-id]');
    if (labelEl && event.target.closest('[data-image-hotspot-delete-label]')) {
        syncImageHotspotTemplate(manager);
        const template = normalizeImageHotspotTemplate(manager.activity.activityData?.imageHotspotTemplate, manager.activity.activityData?.templateId || 'label-image-parts');
        if (template.labels.length <= 1) {
            notifications.warning('Keep at least one label.');
            return;
        }
        template.labels = template.labels.filter(label => label.id !== labelEl.dataset.imageHotspotLabelId);
        manager.activity.activityData.imageHotspotTemplate = normalizeImageHotspotTemplate(template, template.templateId);
        manager.renderImageHotspotBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-image-hotspot-add-prompt]')) {
        syncImageHotspotTemplate(manager);
        const template = normalizeImageHotspotTemplate(manager.activity.activityData?.imageHotspotTemplate, manager.activity.activityData?.templateId || 'label-image-parts');
        template.reflectionPrompts.push(createImageHotspotPrompt({
            prompt: `Reflection prompt ${template.reflectionPrompts.length + 1}`
        }, template.reflectionPrompts.length));
        manager.activity.activityData.imageHotspotTemplate = normalizeImageHotspotTemplate(template, template.templateId);
        manager.renderImageHotspotBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const promptEl = event.target.closest('[data-image-hotspot-prompt-id]');
    if (promptEl && event.target.closest('[data-image-hotspot-delete-prompt]')) {
        syncImageHotspotTemplate(manager);
        const template = normalizeImageHotspotTemplate(manager.activity.activityData?.imageHotspotTemplate, manager.activity.activityData?.templateId || 'label-image-parts');
        template.reflectionPrompts = template.reflectionPrompts.filter(prompt => prompt.id !== promptEl.dataset.imageHotspotPromptId);
        manager.activity.activityData.imageHotspotTemplate = normalizeImageHotspotTemplate(template, template.templateId);
        manager.renderImageHotspotBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
    }
}
