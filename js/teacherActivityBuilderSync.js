import { $ } from './main.js';
import {
    normalizeResponseTemplate,
    normalizeStructuredBlock,
    structuredBlockUsesGrid,
    structuredBlockUsesItems,
    structuredBlockUsesPairs
} from './activityStructuredResponse.js';
import { normalizeCardSortTemplate } from './activityCardSort.js';
import { normalizeSpreadsheetTemplate } from './activitySpreadsheetTable.js';
import {
    IMAGE_HOTSPOT_COLORS,
    normalizeImageHotspotTemplate
} from './activityImageHotspot.js';
import { normalizeExternalArtifactTemplate } from './activityExternalArtifact.js';
import {
    FLOWCHART_NODE_TYPES,
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
