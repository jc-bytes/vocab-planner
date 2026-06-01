import { STRUCTURED_RESPONSE_TYPE, normalizeResponseTemplate } from './activityStructuredResponse.js';
import { CARD_SORT_TYPE, normalizeCardSortTemplate } from './activityCardSort.js';
import {
    SPREADSHEET_TABLE_TYPE,
    normalizeSpreadsheetTemplate
} from './activitySpreadsheetTable.js';
import {
    IMAGE_HOTSPOT_TYPE,
    normalizeImageHotspotTemplate
} from './activityImageHotspot.js';
import {
    EXTERNAL_ARTIFACT_TYPE,
    normalizeExternalArtifactTemplate
} from './activityExternalArtifact.js';

export function getTeacherActivityCanvasElementCount(activity = {}) {
    const elements = activity.activityData?.excalidrawScene?.elements;
    if (!Array.isArray(elements)) return 0;
    return elements.filter(element => !element?.isDeleted).length;
}

export function getTeacherActivityCanvasSummary(activity = {}) {
    const count = getTeacherActivityCanvasElementCount(activity);
    if (count === 0) return 'Blank canvas';
    return count === 1 ? '1 canvas item' : `${count} canvas items`;
}

export function getTeacherActivityResponseSummary(activity = {}) {
    const template = normalizeResponseTemplate(activity.activityData?.responseTemplate, activity.activityData?.templateId || 'worksheet');
    const responseBlocks = template.blocks.filter(block => block.type !== 'instructions');
    const checklistCount = template.blocks.filter(block => block.type === 'checklist').length;
    const blockLabel = responseBlocks.length === 1 ? '1 response block' : `${responseBlocks.length} response blocks`;
    return checklistCount ? `${blockLabel} · ${checklistCount} checklist` : blockLabel;
}

export function getTeacherActivityCardSortSummary(activity = {}) {
    const template = normalizeCardSortTemplate(activity.activityData?.cardSortTemplate, activity.activityData?.templateId || 'category-sort');
    const categoryLabel = template.categories.length === 1 ? '1 category' : `${template.categories.length} categories`;
    const cardLabel = template.cards.length === 1 ? '1 card' : `${template.cards.length} cards`;
    return `${categoryLabel} · ${cardLabel}`;
}

export function getTeacherActivitySpreadsheetSummary(activity = {}) {
    const template = normalizeSpreadsheetTemplate(activity.activityData?.spreadsheetTemplate, activity.activityData?.templateId || 'data-table');
    const columnLabel = template.columns.length === 1 ? '1 column' : `${template.columns.length} columns`;
    const rowLabel = `${template.minRows}-${template.maxRows} rows`;
    return template.chart.enabled ? `${columnLabel} · ${rowLabel} · chart` : `${columnLabel} · ${rowLabel}`;
}

export function getTeacherActivityImageHotspotSummary(activity = {}) {
    const template = normalizeImageHotspotTemplate(activity.activityData?.imageHotspotTemplate, activity.activityData?.templateId || 'label-image-parts');
    const labelText = template.labels.length === 1 ? '1 label' : `${template.labels.length} labels`;
    const pinText = `${template.minPins}-${template.maxPins} pins`;
    return template.image.storagePath ? `${labelText} · ${pinText} · image` : `${labelText} · ${pinText} · needs image`;
}

export function getTeacherActivityExternalArtifactSummary(activity = {}) {
    const template = normalizeExternalArtifactTemplate(activity.activityData?.externalArtifactTemplate, activity.activityData?.templateId || 'project-evidence');
    const checklistText = template.checklistItems.length === 1 ? '1 checklist item' : `${template.checklistItems.length} checklist items`;
    const promptText = template.reflectionPrompts.length === 1 ? '1 reflection' : `${template.reflectionPrompts.length} reflections`;
    return `${template.evidenceMode} evidence · ${checklistText} · ${promptText}`;
}

export function getTeacherActivityWorkspaceSummary(activity = {}) {
    if (activity.activityType === STRUCTURED_RESPONSE_TYPE) {
        return getTeacherActivityResponseSummary(activity);
    }
    if (activity.activityType === CARD_SORT_TYPE) {
        return getTeacherActivityCardSortSummary(activity);
    }
    if (activity.activityType === SPREADSHEET_TABLE_TYPE) {
        return getTeacherActivitySpreadsheetSummary(activity);
    }
    if (activity.activityType === IMAGE_HOTSPOT_TYPE) {
        return getTeacherActivityImageHotspotSummary(activity);
    }
    if (activity.activityType === EXTERNAL_ARTIFACT_TYPE) {
        return getTeacherActivityExternalArtifactSummary(activity);
    }
    return getTeacherActivityCanvasSummary(activity);
}
