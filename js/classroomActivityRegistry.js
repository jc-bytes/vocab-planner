import {
    STRUCTURED_RESPONSE_TYPE,
    createDefaultResponseTemplate,
    normalizeResponseTemplate,
    validateStructuredResponses
} from './activityStructuredResponse.js';
import {
    CARD_SORT_TYPE,
    createDefaultCardSortTemplate,
    normalizeCardSortResponse,
    normalizeCardSortTemplate,
    validateCardSortResponse
} from './activityCardSort.js';
import {
    SPREADSHEET_TABLE_TYPE,
    createDefaultSpreadsheetTemplate,
    normalizeSpreadsheetResponse,
    normalizeSpreadsheetTemplate,
    validateSpreadsheetResponse
} from './activitySpreadsheetTable.js';
import {
    IMAGE_HOTSPOT_TYPE,
    createDefaultImageHotspotTemplate,
    normalizeImageHotspotTemplate,
    validateImageHotspotResponse
} from './activityImageHotspot.js';
import {
    EXTERNAL_ARTIFACT_TYPE,
    createDefaultExternalArtifactTemplate,
    normalizeExternalArtifactResponse,
    normalizeExternalArtifactTemplate,
    validateExternalArtifactResponse
} from './activityExternalArtifact.js';
import {
    FLOWCHART_ALGORITHM_TYPE,
    createDefaultFlowchartTemplate,
    normalizeFlowchartResponse,
    normalizeFlowchartTemplate,
    validateFlowchartResponse
} from './activityFlowchartAlgorithm.js';
import {
    DEFAULT_ACTIVITY_TEMPLATE_ID,
    DEFAULT_ACTIVITY_TYPE
} from './classroomActivityDefaults.js';
import { ACTIVITY_TEMPLATE_OPTIONS } from './classroomActivityTemplates.js';
import { DEFAULT_ACTIVITY_INSTRUCTIONS_BY_TEMPLATE_ID } from './classroomActivityInstructions.js';
import {
    stableActivitySceneSignature,
    stableCardSortTemplateSignature,
    stableExternalArtifactTemplateSignature,
    stableFlowchartTemplateSignature,
    stableImageHotspotTemplateSignature,
    stableResponseTemplateSignature,
    stableSpreadsheetTemplateSignature
} from './classroomActivitySignatures.js';

export {
    DEFAULT_ACTIVITY_TEMPLATE_ID,
    DEFAULT_ACTIVITY_TYPE
} from './classroomActivityDefaults.js';
export { ACTIVITY_TEMPLATE_OPTIONS } from './classroomActivityTemplates.js';

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function readActivityDataValue(activityData = {}, camelKey = '', snakeKey = '') {
    if (!activityData || typeof activityData !== 'object') return undefined;
    return activityData[camelKey] || activityData[snakeKey];
}

function createValidationResult(validation = {}, statusMessage = '', warningMessage = '') {
    return {
        valid: validation.valid !== false,
        missing: Array.isArray(validation.missing) ? validation.missing : [],
        summary: validation.summary,
        statusMessage,
        warningMessage
    };
}

export const ACTIVITY_TYPE_CONFIGS = {
    [DEFAULT_ACTIVITY_TYPE]: {
        type: DEFAULT_ACTIVITY_TYPE,
        label: 'Map / Diagram',
        defaultTemplateId: DEFAULT_ACTIVITY_TEMPLATE_ID,
        templateDataKey: 'excalidrawScene',
        responseDataKey: 'excalidrawScene',
        usesCanvas: true,
        createDefaultActivityData(template) {
            return {
                templateId: template.id,
                excalidrawScene: null
            };
        },
        normalizeActivityData(activityData = {}, templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
            return {
                ...activityData,
                templateId,
                excalidrawScene: activityData.excalidrawScene || activityData.excalidraw_scene || null
            };
        },
        createInitialResponseData(assignment = {}) {
            const starterScene = assignment.activityData?.excalidrawScene || null;
            return starterScene ? { excalidrawScene: clone(starterScene) } : {};
        },
        validateResponse() {
            return createValidationResult({ valid: true });
        },
        stableSignature(activityData = {}) {
            return stableActivitySceneSignature(activityData.excalidrawScene);
        }
    },
    [STRUCTURED_RESPONSE_TYPE]: {
        type: STRUCTURED_RESPONSE_TYPE,
        label: 'Structured Response',
        defaultTemplateId: 'worksheet',
        templateDataKey: 'responseTemplate',
        snakeTemplateDataKey: 'response_template',
        responseDataKey: 'structuredResponses',
        createDefaultTemplate: createDefaultResponseTemplate,
        normalizeTemplate: normalizeResponseTemplate,
        normalizeActivityData(activityData = {}, templateId = 'worksheet') {
            return {
                ...activityData,
                templateId,
                responseTemplate: normalizeResponseTemplate(
                    readActivityDataValue(activityData, 'responseTemplate', 'response_template'),
                    templateId
                )
            };
        },
        createInitialResponseData() {
            return { structuredResponses: {} };
        },
        validateResponse(activityData = {}, responseData = {}) {
            const template = normalizeResponseTemplate(activityData.responseTemplate, activityData.templateId || 'worksheet');
            const validation = validateStructuredResponses(template, responseData.structuredResponses || {});
            const firstMissing = validation.missing?.[0] || 'a required response';
            return createValidationResult(
                validation,
                `Complete required prompt: ${firstMissing}`,
                'Complete the required responses before submitting.'
            );
        },
        stableSignature(activityData = {}) {
            return stableResponseTemplateSignature(activityData.responseTemplate);
        }
    },
    [CARD_SORT_TYPE]: {
        type: CARD_SORT_TYPE,
        label: 'Card Sort',
        defaultTemplateId: 'category-sort',
        templateDataKey: 'cardSortTemplate',
        snakeTemplateDataKey: 'card_sort_template',
        responseDataKey: 'cardSortResponse',
        createDefaultTemplate: createDefaultCardSortTemplate,
        normalizeTemplate: normalizeCardSortTemplate,
        normalizeResponse: normalizeCardSortResponse,
        normalizeActivityData(activityData = {}, templateId = 'category-sort') {
            return {
                ...activityData,
                templateId,
                cardSortTemplate: normalizeCardSortTemplate(
                    readActivityDataValue(activityData, 'cardSortTemplate', 'card_sort_template'),
                    templateId
                )
            };
        },
        createInitialResponseData(assignment = {}) {
            const template = normalizeCardSortTemplate(
                assignment.activityData?.cardSortTemplate,
                assignment.activityData?.templateId || 'category-sort'
            );
            return { cardSortResponse: normalizeCardSortResponse(template) };
        },
        validateResponse(activityData = {}, responseData = {}) {
            const template = normalizeCardSortTemplate(activityData.cardSortTemplate, activityData.templateId || 'category-sort');
            const validation = validateCardSortResponse(template, responseData.cardSortResponse || {});
            return createValidationResult(
                validation,
                'Place all required cards before submitting.',
                'Place all required cards before submitting.'
            );
        },
        stableSignature(activityData = {}) {
            return stableCardSortTemplateSignature(activityData.cardSortTemplate);
        }
    },
    [SPREADSHEET_TABLE_TYPE]: {
        type: SPREADSHEET_TABLE_TYPE,
        label: 'Spreadsheet / Data Table',
        defaultTemplateId: 'data-table',
        templateDataKey: 'spreadsheetTemplate',
        snakeTemplateDataKey: 'spreadsheet_template',
        responseDataKey: 'spreadsheetResponse',
        createDefaultTemplate: createDefaultSpreadsheetTemplate,
        normalizeTemplate: normalizeSpreadsheetTemplate,
        normalizeResponse: normalizeSpreadsheetResponse,
        normalizeActivityData(activityData = {}, templateId = 'data-table') {
            return {
                ...activityData,
                templateId,
                spreadsheetTemplate: normalizeSpreadsheetTemplate(
                    readActivityDataValue(activityData, 'spreadsheetTemplate', 'spreadsheet_template'),
                    templateId
                )
            };
        },
        createInitialResponseData(assignment = {}) {
            const template = normalizeSpreadsheetTemplate(
                assignment.activityData?.spreadsheetTemplate,
                assignment.activityData?.templateId || 'data-table'
            );
            return { spreadsheetResponse: normalizeSpreadsheetResponse(template) };
        },
        validateResponse(activityData = {}, responseData = {}) {
            const template = normalizeSpreadsheetTemplate(activityData.spreadsheetTemplate, activityData.templateId || 'data-table');
            const validation = validateSpreadsheetResponse(template, responseData.spreadsheetResponse || {});
            const firstMissing = validation.missing?.[0] || 'required spreadsheet evidence';
            return createValidationResult(
                validation,
                `Complete: ${firstMissing}`,
                'Complete the required spreadsheet evidence before submitting.'
            );
        },
        stableSignature(activityData = {}) {
            return stableSpreadsheetTemplateSignature(activityData.spreadsheetTemplate);
        }
    },
    [IMAGE_HOTSPOT_TYPE]: {
        type: IMAGE_HOTSPOT_TYPE,
        label: 'Image Label / Hotspot',
        defaultTemplateId: 'label-image-parts',
        templateDataKey: 'imageHotspotTemplate',
        snakeTemplateDataKey: 'image_hotspot_template',
        responseDataKey: 'imageHotspotResponse',
        createDefaultTemplate: createDefaultImageHotspotTemplate,
        normalizeTemplate: normalizeImageHotspotTemplate,
        normalizeActivityData(activityData = {}, templateId = 'label-image-parts') {
            return {
                ...activityData,
                templateId,
                imageHotspotTemplate: normalizeImageHotspotTemplate(
                    readActivityDataValue(activityData, 'imageHotspotTemplate', 'image_hotspot_template'),
                    templateId
                )
            };
        },
        createInitialResponseData() {
            return {};
        },
        validateResponse(activityData = {}, responseData = {}) {
            const template = normalizeImageHotspotTemplate(activityData.imageHotspotTemplate, activityData.templateId || 'label-image-parts');
            const validation = validateImageHotspotResponse(template, responseData.imageHotspotResponse || {});
            const firstMissing = validation.missing?.[0] || 'required image label evidence';
            return createValidationResult(
                validation,
                `Complete: ${firstMissing}`,
                'Complete the required image labels before submitting.'
            );
        },
        stableSignature(activityData = {}) {
            return stableImageHotspotTemplateSignature(activityData.imageHotspotTemplate);
        }
    },
    [EXTERNAL_ARTIFACT_TYPE]: {
        type: EXTERNAL_ARTIFACT_TYPE,
        label: 'External Artifact / Evidence',
        defaultTemplateId: 'project-evidence',
        templateDataKey: 'externalArtifactTemplate',
        snakeTemplateDataKey: 'external_artifact_template',
        responseDataKey: 'externalArtifactResponse',
        createDefaultTemplate: createDefaultExternalArtifactTemplate,
        normalizeTemplate: normalizeExternalArtifactTemplate,
        normalizeResponse: normalizeExternalArtifactResponse,
        normalizeActivityData(activityData = {}, templateId = 'project-evidence') {
            return {
                ...activityData,
                templateId,
                externalArtifactTemplate: normalizeExternalArtifactTemplate(
                    readActivityDataValue(activityData, 'externalArtifactTemplate', 'external_artifact_template'),
                    templateId
                )
            };
        },
        createInitialResponseData(assignment = {}) {
            const template = normalizeExternalArtifactTemplate(
                assignment.activityData?.externalArtifactTemplate,
                assignment.activityData?.templateId || 'project-evidence'
            );
            return { externalArtifactResponse: normalizeExternalArtifactResponse(template) };
        },
        validateResponse(activityData = {}, responseData = {}) {
            const template = normalizeExternalArtifactTemplate(activityData.externalArtifactTemplate, activityData.templateId || 'project-evidence');
            const validation = validateExternalArtifactResponse(template, responseData.externalArtifactResponse || {});
            const firstMissing = validation.missing?.[0] || 'required evidence';
            return createValidationResult(
                validation,
                `Complete: ${firstMissing}`,
                'Complete the required evidence before submitting.'
            );
        },
        stableSignature(activityData = {}) {
            return stableExternalArtifactTemplateSignature(activityData.externalArtifactTemplate);
        }
    },
    [FLOWCHART_ALGORITHM_TYPE]: {
        type: FLOWCHART_ALGORITHM_TYPE,
        label: 'Flowchart / Algorithm',
        defaultTemplateId: 'sequence-algorithm',
        templateDataKey: 'flowchartTemplate',
        snakeTemplateDataKey: 'flowchart_template',
        responseDataKey: 'flowchartResponse',
        createDefaultTemplate: createDefaultFlowchartTemplate,
        normalizeTemplate: normalizeFlowchartTemplate,
        normalizeResponse: normalizeFlowchartResponse,
        normalizeActivityData(activityData = {}, templateId = 'sequence-algorithm') {
            return {
                ...activityData,
                templateId,
                flowchartTemplate: normalizeFlowchartTemplate(
                    readActivityDataValue(activityData, 'flowchartTemplate', 'flowchart_template'),
                    templateId
                )
            };
        },
        createInitialResponseData(assignment = {}) {
            const template = normalizeFlowchartTemplate(
                assignment.activityData?.flowchartTemplate,
                assignment.activityData?.templateId || 'sequence-algorithm'
            );
            return { flowchartResponse: normalizeFlowchartResponse(template) };
        },
        validateResponse(activityData = {}, responseData = {}) {
            const template = normalizeFlowchartTemplate(activityData.flowchartTemplate, activityData.templateId || 'sequence-algorithm');
            const validation = validateFlowchartResponse(template, responseData.flowchartResponse || {});
            const firstMissing = validation.missing?.[0] || 'required flowchart evidence';
            return createValidationResult(
                validation,
                `Complete: ${firstMissing}`,
                'Complete the required flowchart pieces before submitting.'
            );
        },
        stableSignature(activityData = {}) {
            return stableFlowchartTemplateSignature(activityData.flowchartTemplate);
        }
    }
};

export function getActivityTypeConfig(type = DEFAULT_ACTIVITY_TYPE) {
    return ACTIVITY_TYPE_CONFIGS[type] || ACTIVITY_TYPE_CONFIGS[DEFAULT_ACTIVITY_TYPE];
}

export function getActivityTemplate(templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
    return ACTIVITY_TEMPLATE_OPTIONS.find(template => template.id === templateId)
        || ACTIVITY_TEMPLATE_OPTIONS[0];
}

export function getDefaultActivityInstructions(templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
    const template = getActivityTemplate(templateId);
    const title = template.label || 'Activity';
    return DEFAULT_ACTIVITY_INSTRUCTIONS_BY_TEMPLATE_ID[template.id] || {
        teacherInstructions: `Prepare the ${title.toLowerCase()} activity and clarify the expected student output before work begins.`,
        studentInstructions: `Complete the ${title.toLowerCase()} activity using labels, notes, and visuals where needed.`,
        materials: 'Device or printed copy, class notes, reference material if needed.',
        studentOutput: `Completed ${title.toLowerCase()}.`,
        makeupInstructions: 'Complete the activity independently using class notes and submit it during the next class period.'
    };
}

export function getActivityTypeLabel(type = DEFAULT_ACTIVITY_TYPE) {
    return getActivityTypeConfig(type).label || 'Activity';
}

export function getDefaultTemplateIdForType(type = DEFAULT_ACTIVITY_TYPE) {
    return getActivityTypeConfig(type).defaultTemplateId || DEFAULT_ACTIVITY_TEMPLATE_ID;
}

export function getActivityTemplateOptionsForType(type = DEFAULT_ACTIVITY_TYPE) {
    const activityType = getActivityTypeConfig(type).type;
    return ACTIVITY_TEMPLATE_OPTIONS.filter(template => template.type === activityType);
}

function resolveTemplate(templateOrType = DEFAULT_ACTIVITY_TEMPLATE_ID) {
    if (templateOrType && typeof templateOrType === 'object') {
        return getActivityTemplate(templateOrType.id || DEFAULT_ACTIVITY_TEMPLATE_ID);
    }
    const template = ACTIVITY_TEMPLATE_OPTIONS.find(option => option.id === templateOrType);
    if (template) return template;
    return getActivityTemplate(getDefaultTemplateIdForType(templateOrType));
}

export function createDefaultActivityData(templateOrType = DEFAULT_ACTIVITY_TEMPLATE_ID) {
    const template = resolveTemplate(templateOrType);
    const config = getActivityTypeConfig(template.type);
    if (typeof config.createDefaultActivityData === 'function') {
        return config.createDefaultActivityData(template);
    }
    return {
        templateId: template.id,
        [config.templateDataKey]: config.createDefaultTemplate(template.id)
    };
}

export function normalizeActivityData(type = DEFAULT_ACTIVITY_TYPE, activityData = {}, templateId = '') {
    const config = getActivityTypeConfig(type);
    const resolvedTemplateId = templateId
        || activityData.templateId
        || activityData.template_id
        || config.defaultTemplateId
        || DEFAULT_ACTIVITY_TEMPLATE_ID;

    if (typeof config.normalizeActivityData === 'function') {
        return config.normalizeActivityData(activityData, resolvedTemplateId);
    }

    return {
        ...activityData,
        templateId: resolvedTemplateId
    };
}

export function createInitialResponseData(assignment = {}) {
    const activityType = assignment.activityType || assignment.activity_type || DEFAULT_ACTIVITY_TYPE;
    const config = getActivityTypeConfig(activityType);
    const activityData = normalizeActivityData(
        config.type,
        assignment.activityData || assignment.activity_data || {},
        assignment.activityData?.templateId || assignment.activity_data?.template_id || config.defaultTemplateId
    );
    return config.createInitialResponseData?.({ ...assignment, activityType: config.type, activityData }) || {};
}

export function validateActivityResponse(assignment = {}, responseData = {}) {
    const activityType = assignment.activityType || assignment.activity_type || DEFAULT_ACTIVITY_TYPE;
    const config = getActivityTypeConfig(activityType);
    const activityData = normalizeActivityData(
        config.type,
        assignment.activityData || assignment.activity_data || {},
        assignment.activityData?.templateId || assignment.activity_data?.template_id || config.defaultTemplateId
    );
    return config.validateResponse?.(activityData, responseData) || createValidationResult({ valid: true });
}

export function getStableActivityTemplateSignature(activity = {}) {
    const activityType = activity.activityType || activity.activity_type || DEFAULT_ACTIVITY_TYPE;
    const config = getActivityTypeConfig(activityType);
    const activityData = normalizeActivityData(
        config.type,
        activity.activityData || activity.activity_data || {},
        activity.activityData?.templateId || activity.activity_data?.template_id || config.defaultTemplateId
    );

    return {
        scene: stableActivitySceneSignature(activityData.excalidrawScene),
        responseTemplate: config.type === STRUCTURED_RESPONSE_TYPE ? config.stableSignature(activityData) : '',
        cardSortTemplate: config.type === CARD_SORT_TYPE ? config.stableSignature(activityData) : '',
        spreadsheetTemplate: config.type === SPREADSHEET_TABLE_TYPE ? config.stableSignature(activityData) : '',
        imageHotspotTemplate: config.type === IMAGE_HOTSPOT_TYPE ? config.stableSignature(activityData) : '',
        externalArtifactTemplate: config.type === EXTERNAL_ARTIFACT_TYPE ? config.stableSignature(activityData) : '',
        flowchartTemplate: config.type === FLOWCHART_ALGORITHM_TYPE ? config.stableSignature(activityData) : ''
    };
}

export function activityUsesCanvas(type = DEFAULT_ACTIVITY_TYPE) {
    return getActivityTypeConfig(type).usesCanvas === true;
}
