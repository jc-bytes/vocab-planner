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

export const DEFAULT_ACTIVITY_TYPE = 'map-diagram';
export const DEFAULT_ACTIVITY_TEMPLATE_ID = 'blank-map-diagram';

export const ACTIVITY_TEMPLATE_OPTIONS = [
    {
        id: 'blank-map-diagram',
        type: DEFAULT_ACTIVITY_TYPE,
        label: 'Blank Map / Diagram',
        description: 'Open canvas for a teacher-built map, diagram, or visual organizer.'
    },
    {
        id: 'labeled-map',
        type: DEFAULT_ACTIVITY_TYPE,
        label: 'Labeled Map',
        description: 'Map area with title and legend placeholders.'
    },
    {
        id: 'concept-map',
        type: DEFAULT_ACTIVITY_TYPE,
        label: 'Concept Map',
        description: 'Central idea connected to supporting details.'
    },
    {
        id: 'process-diagram',
        type: DEFAULT_ACTIVITY_TYPE,
        label: 'Process Diagram',
        description: 'Three-step flow for sequencing, systems, or procedures.'
    },
    {
        id: 'worksheet',
        type: STRUCTURED_RESPONSE_TYPE,
        label: 'Worksheet',
        description: 'Structured prompts, checklist items, and written answers.'
    },
    {
        id: 'reflection',
        type: STRUCTURED_RESPONSE_TYPE,
        label: 'Reflection',
        description: 'Guided prompts for students to explain learning, challenges, and improvements.'
    },
    {
        id: 'checklist',
        type: STRUCTURED_RESPONSE_TYPE,
        label: 'Checklist',
        description: 'Completion checklist with optional evidence and teacher notes.'
    },
    {
        id: 'category-sort',
        type: CARD_SORT_TYPE,
        label: 'Category Sort',
        description: 'Cards sorted into teacher-defined groups.'
    },
    {
        id: 'sequence-sort',
        type: CARD_SORT_TYPE,
        label: 'Sequence Sort',
        description: 'Cards arranged in one correct order.'
    },
    {
        id: 'process-sort',
        type: CARD_SORT_TYPE,
        label: 'Process Sort',
        description: 'Cards sorted into stages with optional order inside each stage.'
    },
    {
        id: 'data-table',
        type: SPREADSHEET_TABLE_TYPE,
        label: 'Data Table',
        description: 'Fixed columns with student-entered rows for classroom evidence.'
    },
    {
        id: 'formula-practice',
        type: SPREADSHEET_TABLE_TYPE,
        label: 'Formula Practice',
        description: 'Starter rows where students use simple spreadsheet formulas.'
    },
    {
        id: 'chart-from-table',
        type: SPREADSHEET_TABLE_TYPE,
        label: 'Chart From Table',
        description: 'Student-entered table that generates a chart from selected columns.'
    },
    {
        id: 'label-image-parts',
        type: IMAGE_HOTSPOT_TYPE,
        label: 'Label Image Parts',
        description: 'Students place required label pins on a teacher-uploaded image.'
    },
    {
        id: 'screenshot-callouts',
        type: IMAGE_HOTSPOT_TYPE,
        label: 'Screenshot Callouts',
        description: 'Students identify interface or screenshot areas with pins and notes.'
    },
    {
        id: 'hotspot-explanation',
        type: IMAGE_HOTSPOT_TYPE,
        label: 'Hotspot Explanation',
        description: 'Students add explanatory pins and short reflections on an image.'
    },
    {
        id: 'link-evidence',
        type: EXTERNAL_ARTIFACT_TYPE,
        label: 'Link Evidence',
        description: 'Students submit a shareable project link from an external tool.'
    },
    {
        id: 'screenshot-evidence',
        type: EXTERNAL_ARTIFACT_TYPE,
        label: 'Screenshot Evidence',
        description: 'Students upload a screenshot or PDF that shows external work.'
    },
    {
        id: 'project-evidence',
        type: EXTERNAL_ARTIFACT_TYPE,
        label: 'Project Evidence',
        description: 'Students provide a link, upload, checklist, and reflection for external work.'
    },
    {
        id: 'sequence-algorithm',
        type: FLOWCHART_ALGORITHM_TYPE,
        label: 'Sequence Algorithm',
        description: 'Students build a step-by-step flowchart algorithm.'
    },
    {
        id: 'if-then-condition',
        type: FLOWCHART_ALGORITHM_TYPE,
        label: 'If/Then Condition',
        description: 'Students build an algorithm with a condition and Yes/No branches.'
    },
    {
        id: 'sensor-response',
        type: FLOWCHART_ALGORITHM_TYPE,
        label: 'Sensor Response',
        description: 'Students map input, condition, and output logic for a device or sensor.'
    }
];

const DEFAULT_ACTIVITY_INSTRUCTIONS_BY_TEMPLATE_ID = {
    'blank-map-diagram': {
        teacherInstructions: 'Introduce the topic and model how students should organize their map or diagram before independent work.',
        studentInstructions: 'Create a clear map or diagram that explains the topic. Add labels, arrows, symbols, or notes where they help your idea make sense.',
        materials: 'Device or printed copy, class notes, textbook or reference material if needed.',
        studentOutput: 'Completed map or diagram with labels and a short explanation.',
        makeupInstructions: 'Complete the map or diagram independently using class notes and submit it during the next class period.'
    },
    'labeled-map': {
        teacherInstructions: 'Choose the place, system, or interface students should map. Clarify the required labels and any legend symbols before students begin.',
        studentInstructions: 'Label the important parts of the map. Add a title, a legend or key, and short notes that explain what each label means.',
        materials: 'Map reference, notes, device or printed copy, color pencils if printed.',
        studentOutput: 'Labeled map with title, legend, and required features.',
        makeupInstructions: 'Use the reference map and class notes to complete the required labels and legend.'
    },
    'concept-map': {
        teacherInstructions: 'Name the main concept and decide how many supporting ideas students should include. Encourage linking words between ideas.',
        studentInstructions: 'Place the main idea in the center. Connect supporting ideas around it and add short linking words or phrases.',
        materials: 'Class notes, vocabulary list, reading passage or reference material.',
        studentOutput: 'Concept map showing the main idea, supporting details, and relationships.',
        makeupInstructions: 'Create the concept map from the assigned notes or reading and include at least three supporting ideas.'
    },
    'process-diagram': {
        teacherInstructions: 'Identify the process students should sequence. Review the start point, end point, and expected number of steps.',
        studentInstructions: 'Show the steps of the process in order. Use arrows, labels, and short explanations so someone else can follow it.',
        materials: 'Process notes, procedure sheet, device or printed copy.',
        studentOutput: 'Process diagram with ordered steps and explanations.',
        makeupInstructions: 'Use the procedure notes to complete the diagram and explain each step in order.'
    },
    worksheet: {
        teacherInstructions: 'Review the prompts and clarify the expected level of detail before students begin.',
        studentInstructions: 'Answer each prompt carefully. Use class notes, examples, and complete ideas where needed.',
        materials: 'Device, class notes, reference material if needed.',
        studentOutput: 'Completed worksheet responses.',
        makeupInstructions: 'Complete the worksheet independently using class notes and submit it during the next class period.'
    },
    reflection: {
        teacherInstructions: 'Use this as an exit ticket or end-of-activity reflection. Encourage specific examples over one-word answers.',
        studentInstructions: 'Reflect on what you did, what you learned, what was challenging, and what you would improve next time.',
        materials: 'Device and completed class work for reference.',
        studentOutput: 'Completed reflection responses.',
        makeupInstructions: 'Review the missed activity notes or work sample, then complete the reflection prompts.'
    },
    checklist: {
        teacherInstructions: 'Adjust the checklist items to match the task requirements before assigning.',
        studentInstructions: 'Check each item after you verify your work. Add any note or evidence requested.',
        materials: 'Device and the work being checked.',
        studentOutput: 'Completed checklist and any requested evidence or notes.',
        makeupInstructions: 'Use the checklist to verify the makeup work before submitting it.'
    },
    'category-sort': {
        teacherInstructions: 'Review the categories and card answers before assigning. Clarify whether students should explain their choices aloud or only sort the board.',
        studentInstructions: 'Move each card into the category where it belongs. Use the notes on the cards and the category names to guide your decisions.',
        materials: 'Device, class notes, vocabulary list or reference examples if needed.',
        studentOutput: 'Completed card sort board with each card placed in a category.',
        makeupInstructions: 'Complete the card sort independently using class notes and submit it during the next class period.'
    },
    'sequence-sort': {
        teacherInstructions: 'Check that each step is in the expected order. Remind students that every card should be moved into the order lane.',
        studentInstructions: 'Move every card into the order lane, then arrange the steps from first to last.',
        materials: 'Device, process notes or reference instructions if needed.',
        studentOutput: 'Completed sequence with all cards in the correct order.',
        makeupInstructions: 'Use the process notes to place the sequence cards in order and submit the activity.'
    },
    'process-sort': {
        teacherInstructions: 'Review each process stage and decide if order inside the stages matters for this activity.',
        studentInstructions: 'Sort each card into the correct process stage. If a stage has more than one card, place them in the best order.',
        materials: 'Device, class notes, procedure sheet or reference material if needed.',
        studentOutput: 'Completed process sort with cards grouped by stage.',
        makeupInstructions: 'Use the class notes to sort the process cards into stages and submit the activity.'
    },
    'data-table': {
        teacherInstructions: 'Set the columns students should complete and clarify the number of useful data rows expected.',
        studentInstructions: 'Complete the table with clear data. Add enough rows to show the pattern, result, or evidence from the activity.',
        materials: 'Device, class notes, data source or observation sheet if needed.',
        studentOutput: 'Completed data table with a short reflection.',
        makeupInstructions: 'Use the activity notes or data source to complete the table and reflection.'
    },
    'formula-practice': {
        teacherInstructions: 'Review the starter rows and formula column. Keep formulas simple enough for copied arithmetic, SUM, or AVERAGE practice.',
        studentInstructions: 'Enter values in the table and use simple formulas to calculate the results. Check that your formulas match the row data.',
        materials: 'Device and formula examples or class notes.',
        studentOutput: 'Completed spreadsheet table with formulas and a formula reflection.',
        makeupInstructions: 'Complete the starter table, enter the formulas, and explain what one formula calculated.'
    },
    'chart-from-table': {
        teacherInstructions: 'Choose the label and value columns for the chart. Remind students that chart values must be numeric.',
        studentInstructions: 'Enter label and value data in the table, generate the chart, and explain what the chart shows.',
        materials: 'Device, data source or observation results if needed.',
        studentOutput: 'Completed table, generated chart, and chart conclusion.',
        makeupInstructions: 'Complete the data table, generate the chart, and write the chart conclusion.'
    },
    'label-image-parts': {
        teacherInstructions: 'Upload the image and set the required labels students should place. Review the image once before assigning so every label has a clear location.',
        studentInstructions: 'Place each required label pin on the correct part of the image. Use careful placement so the label points to the exact feature.',
        materials: 'Device and the uploaded image or diagram reference.',
        studentOutput: 'Image with all required label pins placed and a short reflection.',
        makeupInstructions: 'Open the image, place each required label, and complete the reflection using class notes.'
    },
    'screenshot-callouts': {
        teacherInstructions: 'Upload the screenshot and define the interface parts students should identify. Use notes when students should explain what each part does.',
        studentInstructions: 'Place each callout pin on the matching part of the screenshot and add a short note for each one.',
        materials: 'Device and the uploaded screenshot.',
        studentOutput: 'Screenshot with labeled callout pins and notes.',
        makeupInstructions: 'Use the screenshot and class notes to place each callout and explain the purpose of each part.'
    },
    'hotspot-explanation': {
        teacherInstructions: 'Upload the image and decide how many explanatory hotspots students should add. Encourage specific notes tied to evidence in the image.',
        studentInstructions: 'Add hotspot pins to important parts of the image and write a note explaining each choice.',
        materials: 'Device, uploaded image, and class notes or reference material if needed.',
        studentOutput: 'Image with explanatory hotspot pins, notes, and reflection.',
        makeupInstructions: 'Add the required hotspots independently and explain your most important choice.'
    },
    'link-evidence': {
        teacherInstructions: 'Confirm the external tool is ready and tell students how to share or publish the link before submitting.',
        studentInstructions: 'Paste the link to your finished project. Check that the link opens before you submit.',
        materials: 'Device and the external tool or project site.',
        studentOutput: 'Working project link with checklist and reflection.',
        makeupInstructions: 'Finish the external project, verify the link opens, and submit it with the reflection.'
    },
    'screenshot-evidence': {
        teacherInstructions: 'Clarify what the screenshot or PDF must show and remind students to preview the file before submitting.',
        studentInstructions: 'Upload a screenshot or PDF that clearly shows your completed work, then complete the checklist and reflection.',
        materials: 'Device and a screenshot or PDF from the external tool.',
        studentOutput: 'Uploaded screenshot or PDF evidence with checklist and reflection.',
        makeupInstructions: 'Create the required evidence file, upload it, and explain what it shows.'
    },
    'project-evidence': {
        teacherInstructions: 'Tell students whether a link, upload, or both are expected. Use the checklist to name the evidence requirements.',
        studentInstructions: 'Add a project link or upload evidence of your work, then complete the checklist and reflection.',
        materials: 'Device, external project tool, and screenshot or PDF if needed.',
        studentOutput: 'External project evidence with checklist and reflection.',
        makeupInstructions: 'Complete the external project evidence and submit the required link or file with reflection.'
    },
    'sequence-algorithm': {
        teacherInstructions: 'Name the task students should turn into ordered steps. Review what counts as a clear start, process step, and end.',
        studentInstructions: 'Build a flowchart algorithm that shows the steps in order. Use clear labels so another person can follow your plan.',
        materials: 'Device, class notes, and the task or process being planned.',
        studentOutput: 'Completed sequence flowchart with checklist and reflection.',
        makeupInstructions: 'Use the activity notes to build the ordered flowchart and explain how it solves the task.'
    },
    'if-then-condition': {
        teacherInstructions: 'Clarify the decision students should model and remind them to label both Yes and No branches.',
        studentInstructions: 'Build an if/then flowchart. Include a condition and label the Yes and No paths clearly.',
        materials: 'Device, class notes, and the decision or rule being modeled.',
        studentOutput: 'Completed conditional flowchart with Yes/No branches and reflection.',
        makeupInstructions: 'Create the conditional flowchart independently and explain what the condition checks.'
    },
    'sensor-response': {
        teacherInstructions: 'Review the input, condition, and output students should connect before they start building the algorithm.',
        studentInstructions: 'Build a sensor-response flowchart. Show the input, the condition being checked, and the output or action.',
        materials: 'Device, sensor/device example, class notes, or project instructions.',
        studentOutput: 'Completed sensor-response flowchart with checklist and reflection.',
        makeupInstructions: 'Use the sensor or device notes to complete the flowchart and explain what input causes the output.'
    }
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function readActivityDataValue(activityData = {}, camelKey = '', snakeKey = '') {
    if (!activityData || typeof activityData !== 'object') return undefined;
    return activityData[camelKey] || activityData[snakeKey];
}

function stableActivitySceneSignature(scene = {}) {
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

function stableResponseTemplateSignature(template = {}) {
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

function stableCardSortTemplateSignature(template = {}) {
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

function stableSpreadsheetTemplateSignature(template = {}) {
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

function stableImageHotspotTemplateSignature(template = {}) {
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

function stableExternalArtifactTemplateSignature(template = {}) {
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

function stableFlowchartTemplateSignature(template = {}) {
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
