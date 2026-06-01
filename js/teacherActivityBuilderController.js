import { $, notifications } from './main.js';
import {
    createStructuredBlock,
    createStructuredId,
    normalizeResponseTemplate,
    normalizeStructuredBlock,
    structuredBlockUsesGrid,
    structuredBlockUsesItems,
    structuredBlockUsesPairs
} from './activityStructuredResponse.js';
import {
    createCardSortCard,
    createCardSortCategory,
    normalizeCardSortTemplate
} from './activityCardSort.js';
import {
    SPREADSHEET_MAX_COLUMNS,
    createSpreadsheetColumn,
    createSpreadsheetPrompt,
    normalizeSpreadsheetTemplate
} from './activitySpreadsheetTable.js';
import {
    IMAGE_HOTSPOT_COLORS,
    IMAGE_HOTSPOT_MAX_LABELS,
    createImageHotspotLabel,
    createImageHotspotPrompt,
    normalizeImageHotspotTemplate
} from './activityImageHotspot.js';
import {
    createExternalArtifactChecklistItem,
    createExternalArtifactPrompt,
    normalizeExternalArtifactTemplate
} from './activityExternalArtifact.js';
import {
    FLOWCHART_NODE_TYPES,
    createFlowchartChecklistItem,
    createFlowchartPrompt,
    normalizeFlowchartTemplate
} from './activityFlowchartAlgorithm.js';

export function syncStructuredResponseTemplate(manager) {
    const root = $('#activity-structured-root');
    if (!root || root.classList.contains('hidden') || !manager.activity?.id) return;
    const blocks = Array.from(root.querySelectorAll('.structured-builder-block')).map((blockEl, index) => {
        const type = blockEl.querySelector('[data-structured-field="type"]')?.value || 'short-text';
        const block = {
            id: blockEl.dataset.blockId || `block_${index + 1}`,
            type,
            prompt: blockEl.querySelector('[data-structured-field="prompt"]')?.value || '',
            helperText: blockEl.querySelector('[data-structured-field="helperText"]')?.value || '',
            required: blockEl.querySelector('[data-structured-field="required"]')?.checked === true
        };

        if (structuredBlockUsesItems(type)) {
            block.items = Array.from(blockEl.querySelectorAll('.structured-builder-item')).map((itemEl, itemIndex) => ({
                id: itemEl.dataset.itemId || `item_${itemIndex + 1}`,
                text: itemEl.querySelector('[data-structured-item-text]')?.value || ''
            }));
        }

        if (structuredBlockUsesPairs(type)) {
            block.items = Array.from(blockEl.querySelectorAll('.structured-builder-match-item')).map((itemEl, itemIndex) => ({
                id: itemEl.dataset.itemId || `match_${itemIndex + 1}`,
                text: itemEl.querySelector('[data-structured-match-text]')?.value || '',
                matchText: itemEl.querySelector('[data-structured-match-answer]')?.value || ''
            }));
        }

        if (structuredBlockUsesGrid(type)) {
            block.rows = Array.from(blockEl.querySelectorAll('.structured-builder-grid-row')).map((itemEl, itemIndex) => ({
                id: itemEl.dataset.itemId || `row_${itemIndex + 1}`,
                text: itemEl.querySelector('[data-structured-grid-text]')?.value || ''
            }));
            block.columns = Array.from(blockEl.querySelectorAll('.structured-builder-grid-column')).map((itemEl, itemIndex) => ({
                id: itemEl.dataset.itemId || `column_${itemIndex + 1}`,
                text: itemEl.querySelector('[data-structured-grid-text]')?.value || ''
            }));
        }

        if (type === 'rating-scale') {
            block.scaleMin = Number(blockEl.querySelector('[data-structured-scale-min]')?.value || 1);
            block.scaleMax = Number(blockEl.querySelector('[data-structured-scale-max]')?.value || 5);
        }

        return normalizeStructuredBlock(block, index);
    });

    manager.activity.activityData = {
        ...(manager.activity.activityData || {}),
        responseTemplate: normalizeResponseTemplate({
            version: 1,
            templateId: manager.activity.activityData?.templateId || 'worksheet',
            blocks
        }, manager.activity.activityData?.templateId || 'worksheet')
    };
}

export function syncCardSortTemplate(manager) {
    const root = $('#activity-card-sort-root');
    if (!root || root.classList.contains('hidden') || !manager.activity?.id) return;
    const currentTemplate = normalizeCardSortTemplate(
        manager.activity.activityData?.cardSortTemplate,
        manager.activity.activityData?.templateId || 'category-sort'
    );
    const categories = Array.from(root.querySelectorAll('[data-card-sort-category-id]')).map((categoryEl, index) => ({
        id: categoryEl.dataset.cardSortCategoryId || `category_${index + 1}`,
        title: categoryEl.querySelector('[data-card-sort-category-title]')?.value || `Category ${index + 1}`,
        helperText: categoryEl.querySelector('[data-card-sort-category-helper]')?.value || ''
    }));
    const fallbackCategoryId = categories[0]?.id || currentTemplate.categories[0]?.id || '';
    const cards = Array.from(root.querySelectorAll('[data-card-sort-card-id]')).map((cardEl, index) => ({
        id: cardEl.dataset.cardSortCardId || `card_${index + 1}`,
        text: cardEl.querySelector('[data-card-sort-card-text]')?.value || `Card ${index + 1}`,
        helperText: cardEl.querySelector('[data-card-sort-card-helper]')?.value || '',
        expectedCategoryId: cardEl.querySelector('[data-card-sort-card-category]')?.value || fallbackCategoryId,
        expectedOrder: cardEl.querySelector('[data-card-sort-card-order]')?.value || index + 1
    }));

    manager.activity.activityData = {
        ...(manager.activity.activityData || {}),
        cardSortTemplate: normalizeCardSortTemplate({
            version: 1,
            templateId: manager.activity.activityData?.templateId || 'category-sort',
            prompt: root.querySelector('[data-card-sort-field="prompt"]')?.value || currentTemplate.prompt,
            helperText: root.querySelector('[data-card-sort-field="helperText"]')?.value || '',
            requireAllCards: root.querySelector('[data-card-sort-field="requireAllCards"]')?.checked === true,
            orderMode: root.querySelector('[data-card-sort-field="orderMode"]')?.value || currentTemplate.orderMode,
            categories,
            cards
        }, manager.activity.activityData?.templateId || 'category-sort')
    };
}

export function syncSpreadsheetTemplate(manager) {
    const root = $('#activity-spreadsheet-root');
    if (!root || root.classList.contains('hidden') || !manager.activity?.id) return;
    const currentTemplate = normalizeSpreadsheetTemplate(
        manager.activity.activityData?.spreadsheetTemplate,
        manager.activity.activityData?.templateId || 'data-table'
    );
    const columns = Array.from(root.querySelectorAll('[data-spreadsheet-column-id]')).map((columnEl, index) => ({
        id: columnEl.dataset.spreadsheetColumnId || `column_${index + 1}`,
        title: columnEl.querySelector('[data-spreadsheet-column-title]')?.value || `Column ${index + 1}`,
        type: columnEl.querySelector('[data-spreadsheet-column-type]')?.value || 'text',
        width: columnEl.querySelector('[data-spreadsheet-column-width]')?.value || 140
    }));
    const seedData = Array.from(root.querySelectorAll('[data-spreadsheet-seed-row]')).map(rowEl => (
        Array.from(rowEl.querySelectorAll('[data-spreadsheet-seed-cell]')).map(cellEl => cellEl.value || '')
    ));
    const chartEnabled = root.querySelector('[data-spreadsheet-chart-enabled]')?.checked === true;
    const reflectionPrompts = Array.from(root.querySelectorAll('[data-spreadsheet-prompt-id]')).map((promptEl, index) => ({
        id: promptEl.dataset.spreadsheetPromptId || `prompt_${index + 1}`,
        prompt: promptEl.querySelector('[data-spreadsheet-prompt-text]')?.value || `Reflection prompt ${index + 1}`,
        required: promptEl.querySelector('[data-spreadsheet-prompt-required]')?.checked === true
    }));

    manager.activity.activityData = {
        ...(manager.activity.activityData || {}),
        spreadsheetTemplate: normalizeSpreadsheetTemplate({
            version: 1,
            templateId: manager.activity.activityData?.templateId || 'data-table',
            columns,
            seedData,
            minRows: root.querySelector('[data-spreadsheet-field="minRows"]')?.value || currentTemplate.minRows,
            maxRows: root.querySelector('[data-spreadsheet-field="maxRows"]')?.value || currentTemplate.maxRows,
            allowAddRows: root.querySelector('[data-spreadsheet-field="allowAddRows"]')?.checked === true,
            chart: {
                enabled: chartEnabled,
                type: root.querySelector('[data-spreadsheet-chart-type]')?.value || currentTemplate.chart.type,
                labelColumnId: root.querySelector('[data-spreadsheet-chart-label-column]')?.value || currentTemplate.chart.labelColumnId,
                valueColumnId: root.querySelector('[data-spreadsheet-chart-value-column]')?.value || currentTemplate.chart.valueColumnId
            },
            reflectionPrompts
        }, manager.activity.activityData?.templateId || 'data-table')
    };
}

export function syncImageHotspotTemplate(manager) {
    const root = $('#activity-image-hotspot-root');
    if (!root || root.classList.contains('hidden') || !manager.activity?.id) return;
    const currentTemplate = normalizeImageHotspotTemplate(
        manager.activity.activityData?.imageHotspotTemplate,
        manager.activity.activityData?.templateId || 'label-image-parts'
    );
    const labels = Array.from(root.querySelectorAll('[data-image-hotspot-label-id]')).map((labelEl, index) => ({
        id: labelEl.dataset.imageHotspotLabelId || `label_${index + 1}`,
        text: labelEl.querySelector('[data-image-hotspot-label-text]')?.value || `Label ${index + 1}`,
        hint: labelEl.querySelector('[data-image-hotspot-label-hint]')?.value || '',
        required: labelEl.querySelector('[data-image-hotspot-label-required]')?.checked === true,
        color: labelEl.querySelector('[data-image-hotspot-label-color]')?.value || IMAGE_HOTSPOT_COLORS[index % IMAGE_HOTSPOT_COLORS.length]
    }));
    const reflectionPrompts = Array.from(root.querySelectorAll('[data-image-hotspot-prompt-id]')).map((promptEl, index) => ({
        id: promptEl.dataset.imageHotspotPromptId || `prompt_${index + 1}`,
        prompt: promptEl.querySelector('[data-image-hotspot-prompt-text]')?.value || `Reflection prompt ${index + 1}`,
        required: promptEl.querySelector('[data-image-hotspot-prompt-required]')?.checked === true
    }));

    manager.activity.activityData = {
        ...(manager.activity.activityData || {}),
        imageHotspotTemplate: normalizeImageHotspotTemplate({
            version: 1,
            templateId: manager.activity.activityData?.templateId || 'label-image-parts',
            image: {
                ...(currentTemplate.image || {}),
                altText: root.querySelector('[data-image-hotspot-field="altText"]')?.value || currentTemplate.image.altText
            },
            labels,
            minPins: root.querySelector('[data-image-hotspot-field="minPins"]')?.value || currentTemplate.minPins,
            maxPins: root.querySelector('[data-image-hotspot-field="maxPins"]')?.value || currentTemplate.maxPins,
            allowExtraPins: root.querySelector('[data-image-hotspot-field="allowExtraPins"]')?.checked === true,
            requireNotes: root.querySelector('[data-image-hotspot-field="requireNotes"]')?.checked === true,
            reflectionPrompts
        }, manager.activity.activityData?.templateId || 'label-image-parts')
    };
}

export function syncExternalArtifactTemplate(manager) {
    const root = $('#activity-external-artifact-root');
    if (!root || root.classList.contains('hidden') || !manager.activity?.id) return;
    const currentTemplate = normalizeExternalArtifactTemplate(
        manager.activity.activityData?.externalArtifactTemplate,
        manager.activity.activityData?.templateId || 'project-evidence'
    );
    const checklistItems = Array.from(root.querySelectorAll('[data-external-artifact-check-id]')).map((itemEl, index) => ({
        id: itemEl.dataset.externalArtifactCheckId || `check_${index + 1}`,
        text: itemEl.querySelector('[data-external-artifact-check-text]')?.value || `Checklist item ${index + 1}`,
        required: itemEl.querySelector('[data-external-artifact-check-required]')?.checked === true
    }));
    const reflectionPrompts = Array.from(root.querySelectorAll('[data-external-artifact-prompt-id]')).map((promptEl, index) => ({
        id: promptEl.dataset.externalArtifactPromptId || `prompt_${index + 1}`,
        prompt: promptEl.querySelector('[data-external-artifact-prompt-text]')?.value || `Reflection prompt ${index + 1}`,
        required: promptEl.querySelector('[data-external-artifact-prompt-required]')?.checked === true
    }));

    manager.activity.activityData = {
        ...(manager.activity.activityData || {}),
        externalArtifactTemplate: normalizeExternalArtifactTemplate({
            version: 1,
            templateId: manager.activity.activityData?.templateId || 'project-evidence',
            prompt: root.querySelector('[data-external-artifact-field="prompt"]')?.value || currentTemplate.prompt,
            helperText: root.querySelector('[data-external-artifact-field="helperText"]')?.value || '',
            evidenceMode: root.querySelector('[data-external-artifact-field="evidenceMode"]')?.value || currentTemplate.evidenceMode,
            linkLabel: root.querySelector('[data-external-artifact-field="linkLabel"]')?.value || currentTemplate.linkLabel,
            uploadLabel: root.querySelector('[data-external-artifact-field="uploadLabel"]')?.value || currentTemplate.uploadLabel,
            allowedMimeTypes: currentTemplate.allowedMimeTypes,
            checklistItems,
            reflectionPrompts
        }, manager.activity.activityData?.templateId || 'project-evidence')
    };
}

export function syncFlowchartTemplate(manager) {
    const root = $('#activity-flowchart-root');
    if (!root || root.classList.contains('hidden') || !manager.activity?.id) return;
    const currentTemplate = normalizeFlowchartTemplate(
        manager.activity.activityData?.flowchartTemplate,
        manager.activity.activityData?.templateId || 'sequence-algorithm'
    );
    const allowedNodeTypes = Array.from(root.querySelectorAll('[data-flowchart-allowed-type]'))
        .filter(input => input.checked)
        .map(input => input.dataset.flowchartAllowedType)
        .filter(type => FLOWCHART_NODE_TYPES.includes(type));
    const effectiveAllowedTypes = allowedNodeTypes.length ? allowedNodeTypes : currentTemplate.allowedNodeTypes;
    const requiredNodeTypes = Array.from(root.querySelectorAll('[data-flowchart-required-type]'))
        .filter(input => input.checked)
        .map(input => input.dataset.flowchartRequiredType)
        .filter(type => effectiveAllowedTypes.includes(type));
    const checklistItems = Array.from(root.querySelectorAll('[data-flowchart-check-id]')).map((itemEl, index) => ({
        id: itemEl.dataset.flowchartCheckId || `check_${index + 1}`,
        text: itemEl.querySelector('[data-flowchart-check-text]')?.value || `Checklist item ${index + 1}`,
        required: itemEl.querySelector('[data-flowchart-check-required]')?.checked === true
    }));
    const reflectionPrompts = Array.from(root.querySelectorAll('[data-flowchart-prompt-id]')).map((promptEl, index) => ({
        id: promptEl.dataset.flowchartPromptId || `prompt_${index + 1}`,
        prompt: promptEl.querySelector('[data-flowchart-prompt-text]')?.value || `Reflection prompt ${index + 1}`,
        required: promptEl.querySelector('[data-flowchart-prompt-required]')?.checked === true
    }));

    manager.activity.activityData = {
        ...(manager.activity.activityData || {}),
        flowchartTemplate: normalizeFlowchartTemplate({
            ...currentTemplate,
            version: 1,
            templateId: manager.activity.activityData?.templateId || 'sequence-algorithm',
            prompt: root.querySelector('[data-flowchart-field="prompt"]')?.value || currentTemplate.prompt,
            helperText: root.querySelector('[data-flowchart-field="helperText"]')?.value || '',
            allowedNodeTypes: effectiveAllowedTypes,
            requiredNodeTypes,
            requireConditionBranches: root.querySelector('[data-flowchart-field="requireConditionBranches"]')?.checked === true,
            minNodes: root.querySelector('[data-flowchart-field="minNodes"]')?.value || currentTemplate.minNodes,
            minEdges: root.querySelector('[data-flowchart-field="minEdges"]')?.value || currentTemplate.minEdges,
            checklistItems,
            reflectionPrompts
        }, manager.activity.activityData?.templateId || 'sequence-algorithm')
    };
}

function refreshPreviewAndAutosave(manager) {
    if (manager.activityEditorTab === 'preview') {
        manager.renderActivityPreviewPanel();
    }
    manager.triggerActivityAutoSave({ readForm: false });
}

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

export function handleSpreadsheetBuilderInput(manager, event) {
    if (!event.target.closest('.spreadsheet-builder-shell')) return;
    syncSpreadsheetTemplate(manager);
    refreshPreviewAndAutosave(manager);
}

export function handleSpreadsheetBuilderClick(manager, event) {
    const root = $('#activity-spreadsheet-root');
    if (!root) return;

    if (event.target.closest('[data-spreadsheet-add-column]')) {
        syncSpreadsheetTemplate(manager);
        const template = normalizeSpreadsheetTemplate(manager.activity.activityData?.spreadsheetTemplate, manager.activity.activityData?.templateId || 'data-table');
        if (template.columns.length >= SPREADSHEET_MAX_COLUMNS) {
            notifications.warning(`Spreadsheet activities can have up to ${SPREADSHEET_MAX_COLUMNS} columns.`);
            return;
        }
        template.columns.push(createSpreadsheetColumn({ title: `Column ${template.columns.length + 1}` }, template.columns.length));
        template.seedData = template.seedData.map(row => [...row, '']);
        manager.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
        manager.renderSpreadsheetBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const columnEl = event.target.closest('[data-spreadsheet-column-id]');
    if (columnEl && event.target.closest('[data-spreadsheet-delete-column]')) {
        syncSpreadsheetTemplate(manager);
        const template = normalizeSpreadsheetTemplate(manager.activity.activityData?.spreadsheetTemplate, manager.activity.activityData?.templateId || 'data-table');
        if (template.columns.length <= 1) {
            notifications.warning('Keep at least one column.');
            return;
        }
        const columnIndex = template.columns.findIndex(column => column.id === columnEl.dataset.spreadsheetColumnId);
        if (columnIndex < 0) return;
        template.columns.splice(columnIndex, 1);
        template.seedData = template.seedData.map(row => row.filter((_cell, index) => index !== columnIndex));
        if (!template.columns.some(column => column.id === template.chart.labelColumnId)) {
            template.chart.labelColumnId = template.columns[0]?.id || '';
        }
        if (!template.columns.some(column => column.id === template.chart.valueColumnId)) {
            template.chart.valueColumnId = template.columns[1]?.id || template.columns[0]?.id || '';
        }
        manager.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
        manager.renderSpreadsheetBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-spreadsheet-add-seed-row]')) {
        syncSpreadsheetTemplate(manager);
        const template = normalizeSpreadsheetTemplate(manager.activity.activityData?.spreadsheetTemplate, manager.activity.activityData?.templateId || 'data-table');
        if (template.seedData.length >= template.maxRows) {
            notifications.warning(`Starter rows cannot exceed the maximum row setting.`);
            return;
        }
        template.seedData.push(template.columns.map(() => ''));
        manager.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
        manager.renderSpreadsheetBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const seedRow = event.target.closest('[data-spreadsheet-seed-row]');
    if (seedRow && event.target.closest('[data-spreadsheet-delete-seed-row]')) {
        syncSpreadsheetTemplate(manager);
        const template = normalizeSpreadsheetTemplate(manager.activity.activityData?.spreadsheetTemplate, manager.activity.activityData?.templateId || 'data-table');
        if (template.seedData.length <= 1) {
            notifications.warning('Keep at least one starter row.');
            return;
        }
        const rowIndex = Number.parseInt(seedRow.dataset.spreadsheetSeedRow, 10);
        template.seedData = template.seedData.filter((_row, index) => index !== rowIndex);
        manager.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
        manager.renderSpreadsheetBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-spreadsheet-add-prompt]')) {
        syncSpreadsheetTemplate(manager);
        const template = normalizeSpreadsheetTemplate(manager.activity.activityData?.spreadsheetTemplate, manager.activity.activityData?.templateId || 'data-table');
        template.reflectionPrompts.push(createSpreadsheetPrompt({
            prompt: `Reflection prompt ${template.reflectionPrompts.length + 1}`
        }, template.reflectionPrompts.length));
        manager.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
        manager.renderSpreadsheetBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const promptEl = event.target.closest('[data-spreadsheet-prompt-id]');
    if (promptEl && event.target.closest('[data-spreadsheet-delete-prompt]')) {
        syncSpreadsheetTemplate(manager);
        const template = normalizeSpreadsheetTemplate(manager.activity.activityData?.spreadsheetTemplate, manager.activity.activityData?.templateId || 'data-table');
        template.reflectionPrompts = template.reflectionPrompts.filter(prompt => prompt.id !== promptEl.dataset.spreadsheetPromptId);
        manager.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
        manager.renderSpreadsheetBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
    }
}

export function handleCardSortBuilderInput(manager, event) {
    if (!event.target.closest('.card-sort-builder-shell')) return;
    syncCardSortTemplate(manager);
    refreshPreviewAndAutosave(manager);
}

export function handleCardSortBuilderClick(manager, event) {
    const root = $('#activity-card-sort-root');
    if (!root) return;
    if (event.target.closest('[data-card-sort-add-category]')) {
        syncCardSortTemplate(manager);
        const template = normalizeCardSortTemplate(manager.activity.activityData?.cardSortTemplate, manager.activity.activityData?.templateId || 'category-sort');
        template.categories.push(createCardSortCategory({
            title: `Category ${template.categories.length + 1}`
        }));
        template.cards = template.cards.map(card => ({
            ...card,
            expectedCategoryId: template.categories.some(category => category.id === card.expectedCategoryId)
                ? card.expectedCategoryId
                : template.categories[0]?.id || ''
        }));
        manager.activity.activityData.cardSortTemplate = normalizeCardSortTemplate(template, template.templateId);
        manager.renderCardSortBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-card-sort-add-card]')) {
        syncCardSortTemplate(manager);
        const template = normalizeCardSortTemplate(manager.activity.activityData?.cardSortTemplate, manager.activity.activityData?.templateId || 'category-sort');
        template.cards.push(createCardSortCard({
            text: `Card ${template.cards.length + 1}`,
            expectedOrder: template.cards.length + 1
        }, template.categories));
        manager.activity.activityData.cardSortTemplate = normalizeCardSortTemplate(template, template.templateId);
        manager.renderCardSortBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const categoryEl = event.target.closest('[data-card-sort-category-id]');
    if (categoryEl && event.target.closest('[data-card-sort-delete-category]')) {
        syncCardSortTemplate(manager);
        const template = normalizeCardSortTemplate(manager.activity.activityData?.cardSortTemplate, manager.activity.activityData?.templateId || 'category-sort');
        if (template.categories.length <= 1) {
            notifications.warning('Keep at least one category.');
            return;
        }
        const deletedId = categoryEl.dataset.cardSortCategoryId;
        template.categories = template.categories.filter(category => category.id !== deletedId);
        const fallbackCategoryId = template.categories[0]?.id || '';
        template.cards = template.cards.map(card => ({
            ...card,
            expectedCategoryId: card.expectedCategoryId === deletedId ? fallbackCategoryId : card.expectedCategoryId
        }));
        manager.activity.activityData.cardSortTemplate = normalizeCardSortTemplate(template, template.templateId);
        manager.renderCardSortBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const cardEl = event.target.closest('[data-card-sort-card-id]');
    if (!cardEl) return;

    if (event.target.closest('[data-card-sort-duplicate-card]')) {
        syncCardSortTemplate(manager);
        const template = normalizeCardSortTemplate(manager.activity.activityData?.cardSortTemplate, manager.activity.activityData?.templateId || 'category-sort');
        const cardIndex = template.cards.findIndex(card => card.id === cardEl.dataset.cardSortCardId);
        if (cardIndex < 0) return;
        const clone = {
            ...JSON.parse(JSON.stringify(template.cards[cardIndex])),
            id: undefined,
            text: `${template.cards[cardIndex].text} Copy`,
            expectedOrder: template.cards.length + 1
        };
        template.cards.splice(cardIndex + 1, 0, createCardSortCard(clone, template.categories));
        manager.activity.activityData.cardSortTemplate = normalizeCardSortTemplate(template, template.templateId);
        manager.renderCardSortBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-card-sort-delete-card]')) {
        syncCardSortTemplate(manager);
        const template = normalizeCardSortTemplate(manager.activity.activityData?.cardSortTemplate, manager.activity.activityData?.templateId || 'category-sort');
        if (template.cards.length <= 1) {
            notifications.warning('Keep at least one card.');
            return;
        }
        template.cards = template.cards.filter(card => card.id !== cardEl.dataset.cardSortCardId);
        manager.activity.activityData.cardSortTemplate = normalizeCardSortTemplate(template, template.templateId);
        manager.renderCardSortBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
    }
}

export function handleStructuredBuilderInput(manager, event) {
    if (!event.target.closest('.structured-builder-shell')) return;
    syncStructuredResponseTemplate(manager);
    if (event.target.matches('[data-structured-field="type"]')) {
        manager.renderStructuredResponseBuilder();
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }
    refreshPreviewAndAutosave(manager);
}

export function handleStructuredBuilderClick(manager, event) {
    const root = $('#activity-structured-root');
    if (!root) return;
    const blockEl = event.target.closest('.structured-builder-block');

    if (event.target.closest('[data-structured-add-block]')) {
        syncStructuredResponseTemplate(manager);
        const type = root.querySelector('[data-structured-add-type]')?.value || 'short-text';
        const template = normalizeResponseTemplate(manager.activity.activityData?.responseTemplate, manager.activity.activityData?.templateId || 'worksheet');
        template.blocks.push(createStructuredBlock(type));
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (!blockEl) return;
    syncStructuredResponseTemplate(manager);
    const template = normalizeResponseTemplate(manager.activity.activityData?.responseTemplate, manager.activity.activityData?.templateId || 'worksheet');
    const blockIndex = template.blocks.findIndex(block => block.id === blockEl.dataset.blockId);
    if (blockIndex < 0) return;

    const moveButton = event.target.closest('[data-structured-move]');
    if (moveButton) {
        const direction = moveButton.dataset.structuredMove;
        const targetIndex = direction === 'up' ? blockIndex - 1 : blockIndex + 1;
        if (targetIndex >= 0 && targetIndex < template.blocks.length) {
            const [block] = template.blocks.splice(blockIndex, 1);
            template.blocks.splice(targetIndex, 0, block);
        }
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-structured-duplicate-block]')) {
        const clone = JSON.parse(JSON.stringify(template.blocks[blockIndex]));
        clone.id = createStructuredId(clone.type.replace(/[^a-z0-9]+/g, '_'));
        if (Array.isArray(clone.items)) {
            clone.items = clone.items.map(item => ({ ...item, id: createStructuredId('item') }));
        }
        if (Array.isArray(clone.rows)) {
            clone.rows = clone.rows.map(row => ({ ...row, id: createStructuredId('row') }));
        }
        if (Array.isArray(clone.columns)) {
            clone.columns = clone.columns.map(column => ({ ...column, id: createStructuredId('column') }));
        }
        template.blocks.splice(blockIndex + 1, 0, normalizeStructuredBlock(clone, blockIndex + 1));
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-structured-delete-block]')) {
        if (template.blocks.length <= 1) {
            notifications.warning('Keep at least one block in the activity.');
            return;
        }
        template.blocks.splice(blockIndex, 1);
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-structured-add-item]')) {
        const block = template.blocks[blockIndex];
        block.items = Array.isArray(block.items) ? block.items : [];
        block.items.push({
            id: createStructuredId('item'),
            text: block.type === 'checklist'
                ? 'Checklist item'
                : (block.type === 'ranking' ? `Ranking item ${block.items.length + 1}` : `Option ${block.items.length + 1}`)
        });
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-structured-add-match]')) {
        const block = template.blocks[blockIndex];
        block.items = Array.isArray(block.items) ? block.items : [];
        block.items.push({
            id: createStructuredId('match'),
            text: `Item ${block.items.length + 1}`,
            matchText: `Match ${block.items.length + 1}`
        });
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const deleteMatchButton = event.target.closest('[data-structured-delete-match]');
    if (deleteMatchButton) {
        const block = template.blocks[blockIndex];
        block.items = (block.items || []).filter(item => item.id !== deleteMatchButton.dataset.structuredDeleteMatch);
        if (block.items.length === 0) {
            block.items.push({
                id: createStructuredId('match'),
                text: 'Item 1',
                matchText: 'Match 1'
            });
        }
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-structured-add-grid-row]')) {
        const block = template.blocks[blockIndex];
        block.rows = Array.isArray(block.rows) ? block.rows : [];
        block.rows.push({
            id: createStructuredId('row'),
            text: `Row ${block.rows.length + 1}`
        });
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-structured-add-grid-column]')) {
        const block = template.blocks[blockIndex];
        block.columns = Array.isArray(block.columns) ? block.columns : [];
        block.columns.push({
            id: createStructuredId('column'),
            text: `Column ${block.columns.length + 1}`
        });
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const deleteGridRowButton = event.target.closest('[data-structured-delete-grid-row]');
    if (deleteGridRowButton) {
        const block = template.blocks[blockIndex];
        block.rows = (block.rows || []).filter(row => row.id !== deleteGridRowButton.dataset.structuredDeleteGridRow);
        if (block.rows.length === 0) {
            block.rows.push({ id: createStructuredId('row'), text: 'Row 1' });
        }
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const deleteGridColumnButton = event.target.closest('[data-structured-delete-grid-column]');
    if (deleteGridColumnButton) {
        const block = template.blocks[blockIndex];
        block.columns = (block.columns || []).filter(column => column.id !== deleteGridColumnButton.dataset.structuredDeleteGridColumn);
        if (block.columns.length === 0) {
            block.columns.push({ id: createStructuredId('column'), text: 'Column 1' });
        }
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const deleteItemButton = event.target.closest('[data-structured-delete-item]');
    if (deleteItemButton) {
        const block = template.blocks[blockIndex];
        block.items = (block.items || []).filter(item => item.id !== deleteItemButton.dataset.structuredDeleteItem);
        if (block.items.length === 0) {
            block.items.push({
                id: createStructuredId('item'),
                text: block.type === 'checklist'
                    ? 'Checklist item'
                    : (block.type === 'ranking' ? 'Ranking item 1' : 'Option 1')
            });
        }
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
    }
}
