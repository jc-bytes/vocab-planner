import { normalizeResponseTemplate } from './activityStructuredResponse.js';
import { normalizeCardSortTemplate } from './activityCardSort.js';
import { normalizeSpreadsheetTemplate } from './activitySpreadsheetTable.js';
import { normalizeImageHotspotTemplate } from './activityImageHotspot.js';
import { normalizeExternalArtifactTemplate } from './activityExternalArtifact.js';
import { normalizeFlowchartTemplate } from './activityFlowchartAlgorithm.js';

export function stableActivitySceneSignature(scene = {}) {
    if (!scene || !Array.isArray(scene.elements)) return '';
    const normalizedElements = scene.elements
        .filter(element => !element?.isDeleted)
        .map(element => ({
            type: element.type || '',
            x: Math.round(Number(element.x) || 0),
            y: Math.round(Number(element.y) || 0),
            width: Math.round(Number(element.width) || 0),
            height: Math.round(Number(element.height) || 0),
            angle: Math.round((Number(element.angle) || 0) * 1000) / 1000,
            text: element.text || element.rawText || element.label?.text || '',
            points: Array.isArray(element.points)
                ? element.points.map(point => point.map(value => Math.round(Number(value) || 0)))
                : undefined,
            strokeColor: element.strokeColor || '',
            backgroundColor: element.backgroundColor || '',
            fillStyle: element.fillStyle || '',
            strokeWidth: element.strokeWidth || '',
            roughness: element.roughness || '',
            label: element.label?.text || ''
        }));
    return JSON.stringify(normalizedElements);
}

export function stableResponseTemplateSignature(template = {}) {
    const normalized = normalizeResponseTemplate(template);
    return JSON.stringify(normalized.blocks.map(block => ({
        id: block.id,
        type: block.type,
        prompt: block.prompt,
        helperText: block.helperText,
        required: Boolean(block.required),
        items: Array.isArray(block.items) ? block.items.map(item => ({ id: item.id, text: item.text })) : []
    })));
}

export function stableCardSortTemplateSignature(template = {}) {
    const normalized = normalizeCardSortTemplate(template);
    return JSON.stringify({
        prompt: normalized.prompt,
        helperText: normalized.helperText,
        requireAllCards: normalized.requireAllCards,
        orderMode: normalized.orderMode,
        categories: normalized.categories.map(category => ({
            id: category.id,
            title: category.title,
            helperText: category.helperText
        })),
        cards: normalized.cards.map(card => ({
            id: card.id,
            text: card.text,
            helperText: card.helperText,
            expectedCategoryId: card.expectedCategoryId,
            expectedOrder: card.expectedOrder
        }))
    });
}

export function stableSpreadsheetTemplateSignature(template = {}) {
    const normalized = normalizeSpreadsheetTemplate(template);
    return JSON.stringify({
        templateId: normalized.templateId,
        columns: normalized.columns.map(column => ({
            id: column.id,
            title: column.title,
            type: column.type,
            width: column.width
        })),
        seedData: normalized.seedData,
        minRows: normalized.minRows,
        maxRows: normalized.maxRows,
        allowAddRows: normalized.allowAddRows,
        chart: normalized.chart,
        reflectionPrompts: normalized.reflectionPrompts.map(prompt => ({
            id: prompt.id,
            prompt: prompt.prompt,
            required: prompt.required
        }))
    });
}

export function stableImageHotspotTemplateSignature(template = {}) {
    const normalized = normalizeImageHotspotTemplate(template);
    return JSON.stringify({
        templateId: normalized.templateId,
        image: normalized.image,
        labels: normalized.labels.map(label => ({
            id: label.id,
            text: label.text,
            hint: label.hint,
            required: label.required,
            color: label.color
        })),
        minPins: normalized.minPins,
        maxPins: normalized.maxPins,
        allowExtraPins: normalized.allowExtraPins,
        requireNotes: normalized.requireNotes,
        reflectionPrompts: normalized.reflectionPrompts.map(prompt => ({
            id: prompt.id,
            prompt: prompt.prompt,
            required: prompt.required
        }))
    });
}

export function stableExternalArtifactTemplateSignature(template = {}) {
    const normalized = normalizeExternalArtifactTemplate(template);
    return JSON.stringify({
        templateId: normalized.templateId,
        prompt: normalized.prompt,
        helperText: normalized.helperText,
        evidenceMode: normalized.evidenceMode,
        linkLabel: normalized.linkLabel,
        uploadLabel: normalized.uploadLabel,
        allowedMimeTypes: normalized.allowedMimeTypes,
        checklistItems: normalized.checklistItems.map(item => ({
            id: item.id,
            text: item.text,
            required: item.required
        })),
        reflectionPrompts: normalized.reflectionPrompts.map(prompt => ({
            id: prompt.id,
            prompt: prompt.prompt,
            required: prompt.required
        }))
    });
}

export function stableFlowchartTemplateSignature(template = {}) {
    const normalized = normalizeFlowchartTemplate(template);
    return JSON.stringify({
        templateId: normalized.templateId,
        prompt: normalized.prompt,
        helperText: normalized.helperText,
        allowedNodeTypes: normalized.allowedNodeTypes,
        requiredNodeTypes: normalized.requiredNodeTypes,
        requireConditionBranches: normalized.requireConditionBranches,
        minNodes: normalized.minNodes,
        minEdges: normalized.minEdges,
        starterNodes: normalized.starterNodes.map(node => ({
            id: node.id,
            type: node.type,
            label: node.label,
            description: node.description,
            position: node.position
        })),
        starterEdges: normalized.starterEdges.map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.label
        })),
        checklistItems: normalized.checklistItems.map(item => ({
            id: item.id,
            text: item.text,
            required: item.required
        })),
        reflectionPrompts: normalized.reflectionPrompts.map(prompt => ({
            id: prompt.id,
            prompt: prompt.prompt,
            required: prompt.required
        }))
    });
}
