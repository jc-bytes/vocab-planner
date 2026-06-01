export const FLOWCHART_ALGORITHM_TYPE = 'flowchart-algorithm';
export const FLOWCHART_TEMPLATE_VERSION = 1;
export const FLOWCHART_RESPONSE_VERSION = 1;

export const FLOWCHART_NODE_TYPES = ['start', 'process', 'input', 'condition', 'output', 'end'];

export const FLOWCHART_NODE_TYPE_LABELS = {
    start: 'Start',
    process: 'Process',
    input: 'Input',
    condition: 'Condition',
    output: 'Output',
    end: 'End'
};

export const FLOWCHART_NODE_TYPE_COLORS = {
    start: '#059669',
    process: '#2563eb',
    input: '#7c3aed',
    condition: '#d97706',
    output: '#0891b2',
    end: '#dc2626'
};

const DEFAULT_TEMPLATES = {
    'sequence-algorithm': {
        templateId: 'sequence-algorithm',
        prompt: 'Build an algorithm that shows the steps in order.',
        helperText: 'Use a start, ordered process steps, and an end so someone else can follow your plan.',
        allowedNodeTypes: ['start', 'process', 'input', 'output', 'end'],
        requiredNodeTypes: ['start', 'process', 'end'],
        requireConditionBranches: false,
        minNodes: 3,
        minEdges: 2,
        starterNodes: [
            { id: 'start', type: 'start', label: 'Start', description: '', position: { x: 120, y: 40 } },
            { id: 'step_1', type: 'process', label: 'Step 1', description: '', position: { x: 120, y: 170 } },
            { id: 'end', type: 'end', label: 'End', description: '', position: { x: 120, y: 300 } }
        ],
        starterEdges: [
            { id: 'edge_start_step_1', source: 'start', target: 'step_1', label: '' },
            { id: 'edge_step_1_end', source: 'step_1', target: 'end', label: '' }
        ],
        checklistItems: [
            { id: 'ordered_steps', text: 'My steps are in a logical order.', required: true },
            { id: 'clear_labels', text: 'Each node has a clear label.', required: true }
        ],
        reflectionPrompts: [
            { id: 'algorithm_explanation', prompt: 'Explain how your algorithm solves the task.', required: true }
        ]
    },
    'if-then-condition': {
        templateId: 'if-then-condition',
        prompt: 'Build an if/then flowchart with clear Yes and No branches.',
        helperText: 'Use a condition diamond, label each branch, and show what happens for each result.',
        allowedNodeTypes: ['start', 'process', 'condition', 'output', 'end'],
        requiredNodeTypes: ['start', 'condition', 'output', 'end'],
        requireConditionBranches: true,
        minNodes: 5,
        minEdges: 4,
        starterNodes: [
            { id: 'start', type: 'start', label: 'Start', description: '', position: { x: 180, y: 30 } },
            { id: 'condition', type: 'condition', label: 'Condition?', description: '', position: { x: 180, y: 160 } },
            { id: 'yes_action', type: 'output', label: 'Yes action', description: '', position: { x: 20, y: 300 } },
            { id: 'no_action', type: 'output', label: 'No action', description: '', position: { x: 340, y: 300 } },
            { id: 'end', type: 'end', label: 'End', description: '', position: { x: 180, y: 430 } }
        ],
        starterEdges: [
            { id: 'edge_start_condition', source: 'start', target: 'condition', label: '' },
            { id: 'edge_condition_yes', source: 'condition', target: 'yes_action', label: 'Yes' },
            { id: 'edge_condition_no', source: 'condition', target: 'no_action', label: 'No' },
            { id: 'edge_yes_end', source: 'yes_action', target: 'end', label: '' },
            { id: 'edge_no_end', source: 'no_action', target: 'end', label: '' }
        ],
        checklistItems: [
            { id: 'has_condition', text: 'My flowchart has a decision or condition.', required: true },
            { id: 'branches_labeled', text: 'The Yes and No branches are labeled.', required: true }
        ],
        reflectionPrompts: [
            { id: 'condition_explanation', prompt: 'What condition does your algorithm check?', required: true }
        ]
    },
    'sensor-response': {
        templateId: 'sensor-response',
        prompt: 'Build a sensor-response algorithm.',
        helperText: 'Show the input or sensor, the condition being checked, and the output or action.',
        allowedNodeTypes: ['start', 'input', 'condition', 'process', 'output', 'end'],
        requiredNodeTypes: ['start', 'input', 'condition', 'output', 'end'],
        requireConditionBranches: true,
        minNodes: 5,
        minEdges: 4,
        starterNodes: [
            { id: 'start', type: 'start', label: 'Start', description: '', position: { x: 180, y: 30 } },
            { id: 'sensor', type: 'input', label: 'Read sensor/input', description: '', position: { x: 180, y: 150 } },
            { id: 'condition', type: 'condition', label: 'Condition?', description: '', position: { x: 180, y: 270 } },
            { id: 'output', type: 'output', label: 'Output/action', description: '', position: { x: 20, y: 400 } },
            { id: 'end', type: 'end', label: 'End', description: '', position: { x: 340, y: 400 } }
        ],
        starterEdges: [
            { id: 'edge_start_sensor', source: 'start', target: 'sensor', label: '' },
            { id: 'edge_sensor_condition', source: 'sensor', target: 'condition', label: '' },
            { id: 'edge_condition_yes', source: 'condition', target: 'output', label: 'Yes' },
            { id: 'edge_condition_no', source: 'condition', target: 'end', label: 'No' },
            { id: 'edge_output_end', source: 'output', target: 'end', label: '' }
        ],
        checklistItems: [
            { id: 'sensor_named', text: 'My sensor or input is named.', required: true },
            { id: 'output_named', text: 'My output or action is clear.', required: true }
        ],
        reflectionPrompts: [
            { id: 'sensor_response', prompt: 'What input causes your output or action?', required: true }
        ]
    }
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function normalizeText(value, fallback = '') {
    const text = String(value ?? '').trim();
    return text || fallback;
}

function normalizeBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    return !['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

function normalizeInteger(value, fallback, min, max) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    const number = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(min, Math.min(max, number));
}

export function createFlowchartId(prefix = 'node') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function uniqueId(baseId, usedIds, prefix, index) {
    const cleanedBase = String(baseId || '')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .toLowerCase();
    const fallback = `${prefix}_${index + 1}`;
    let candidate = cleanedBase || fallback;
    let suffix = 2;
    while (usedIds.has(candidate)) {
        candidate = `${cleanedBase || fallback}_${suffix}`;
        suffix += 1;
    }
    usedIds.add(candidate);
    return candidate;
}

function normalizeNodeType(value, fallback = 'process') {
    const nodeType = String(value || '').trim();
    return FLOWCHART_NODE_TYPES.includes(nodeType) ? nodeType : fallback;
}

function normalizeTypeList(value, fallback = []) {
    const source = Array.isArray(value) ? value : String(value || '').split(',');
    const types = source
        .map(item => normalizeNodeType(item, ''))
        .filter(Boolean);
    return Array.from(new Set(types.length ? types : fallback));
}

function normalizePosition(value = {}, index = 0) {
    const source = value && typeof value === 'object' ? value : {};
    const x = Number.parseFloat(String(source.x ?? ''));
    const y = Number.parseFloat(String(source.y ?? ''));
    return {
        x: Number.isFinite(x) ? x : 140 + (index % 3) * 220,
        y: Number.isFinite(y) ? y : 60 + Math.floor(index / 3) * 140
    };
}

export function createFlowchartNode(overrides = {}, index = 0, allowedNodeTypes = FLOWCHART_NODE_TYPES) {
    const fallbackType = allowedNodeTypes.includes('process') ? 'process' : allowedNodeTypes[0] || 'process';
    const type = allowedNodeTypes.includes(overrides.type) ? overrides.type : normalizeNodeType(overrides.type, fallbackType);
    return {
        id: overrides.id || createFlowchartId(type),
        type,
        label: normalizeText(overrides.label || overrides.text, FLOWCHART_NODE_TYPE_LABELS[type] || 'Step'),
        description: normalizeText(overrides.description || overrides.helperText, ''),
        position: normalizePosition(overrides.position, index)
    };
}

export function createFlowchartEdge(overrides = {}, nodes = [], index = 0) {
    const nodeIds = new Set(nodes.map(node => node.id));
    const source = nodeIds.has(overrides.source) ? overrides.source : nodes[0]?.id || '';
    const target = nodeIds.has(overrides.target) ? overrides.target : nodes[1]?.id || '';
    return {
        id: overrides.id || createFlowchartId('edge'),
        source,
        target,
        label: normalizeText(overrides.label || overrides.text, '')
    };
}

export function createFlowchartChecklistItem(index = 0, overrides = {}) {
    return {
        id: overrides.id || createFlowchartId('check'),
        text: normalizeText(overrides.text, `Checklist item ${index + 1}`),
        required: normalizeBoolean(overrides.required, true)
    };
}

export function createFlowchartPrompt(index = 0, overrides = {}) {
    return {
        id: overrides.id || createFlowchartId('prompt'),
        prompt: normalizeText(overrides.prompt || overrides.text, `Reflection prompt ${index + 1}`),
        required: normalizeBoolean(overrides.required, true)
    };
}

function normalizeChecklistItem(item = {}, index = 0, usedIds = new Set()) {
    const created = createFlowchartChecklistItem(index, item);
    return {
        ...created,
        id: uniqueId(item.id || created.text, usedIds, 'check', index)
    };
}

function normalizePrompt(prompt = {}, index = 0, usedIds = new Set()) {
    const created = createFlowchartPrompt(index, prompt);
    return {
        ...created,
        id: uniqueId(prompt.id || created.prompt, usedIds, 'prompt', index)
    };
}

function normalizeNode(node = {}, index = 0, allowedNodeTypes = FLOWCHART_NODE_TYPES, usedIds = new Set()) {
    const type = allowedNodeTypes.includes(node.type) ? node.type : normalizeNodeType(node.type, allowedNodeTypes[0] || 'process');
    const created = createFlowchartNode({ ...node, type }, index, allowedNodeTypes);
    return {
        ...created,
        id: uniqueId(node.id || node.nodeId || created.label, usedIds, 'node', index)
    };
}

function normalizeEdges(edges = [], nodes = []) {
    const nodeIds = new Set(nodes.map(node => node.id));
    const usedIds = new Set();
    return (Array.isArray(edges) ? edges : [])
        .map((edge, index) => {
            const source = String(edge?.source || edge?.sourceId || edge?.source_id || '').trim();
            const target = String(edge?.target || edge?.targetId || edge?.target_id || '').trim();
            if (!nodeIds.has(source) || !nodeIds.has(target) || source === target) return null;
            return {
                id: uniqueId(edge.id || `${source}_${target}`, usedIds, 'edge', index),
                source,
                target,
                label: normalizeText(edge.label || edge.text, '')
            };
        })
        .filter(Boolean);
}

export function createDefaultFlowchartTemplate(templateId = 'sequence-algorithm') {
    const source = DEFAULT_TEMPLATES[templateId] || DEFAULT_TEMPLATES['sequence-algorithm'];
    return normalizeFlowchartTemplate(clone(source), source.templateId);
}

export function normalizeFlowchartTemplate(template = {}, fallbackTemplateId = 'sequence-algorithm') {
    const templateId = normalizeText(template.templateId || template.template_id || fallbackTemplateId, 'sequence-algorithm');
    const defaults = DEFAULT_TEMPLATES[templateId] || DEFAULT_TEMPLATES['sequence-algorithm'];
    const source = template && typeof template === 'object' ? template : {};
    const hasContent = Array.isArray(source.starterNodes) || Array.isArray(source.starter_nodes);

    if (!hasContent && DEFAULT_TEMPLATES[templateId] && Object.keys(source).length <= 1) {
        return createDefaultFlowchartTemplate(templateId);
    }

    const allowedNodeTypes = normalizeTypeList(source.allowedNodeTypes || source.allowed_node_types, defaults.allowedNodeTypes);
    const requiredNodeTypes = normalizeTypeList(source.requiredNodeTypes || source.required_node_types, defaults.requiredNodeTypes)
        .filter(type => allowedNodeTypes.includes(type));
    const nodeIds = new Set();
    const starterNodes = (Array.isArray(source.starterNodes) && source.starterNodes.length
        ? source.starterNodes
        : (Array.isArray(source.starter_nodes) && source.starter_nodes.length ? source.starter_nodes : defaults.starterNodes)
    ).map((node, index) => normalizeNode(node, index, allowedNodeTypes, nodeIds));
    const starterEdges = normalizeEdges(source.starterEdges || source.starter_edges || defaults.starterEdges, starterNodes);
    const checklistIds = new Set();
    const promptIds = new Set();

    return {
        version: Number(source.version) || FLOWCHART_TEMPLATE_VERSION,
        templateId,
        prompt: normalizeText(source.prompt, defaults.prompt),
        helperText: normalizeText(source.helperText || source.helper_text, defaults.helperText),
        allowedNodeTypes,
        requiredNodeTypes,
        requireConditionBranches: normalizeBoolean(source.requireConditionBranches ?? source.require_condition_branches, defaults.requireConditionBranches),
        minNodes: normalizeInteger(source.minNodes ?? source.min_nodes, defaults.minNodes, 1, 30),
        minEdges: normalizeInteger(source.minEdges ?? source.min_edges, defaults.minEdges, 0, 40),
        starterNodes,
        starterEdges,
        checklistItems: (Array.isArray(source.checklistItems) && source.checklistItems.length
            ? source.checklistItems
            : (Array.isArray(source.checklist_items) && source.checklist_items.length ? source.checklist_items : defaults.checklistItems)
        ).map((item, index) => normalizeChecklistItem(item, index, checklistIds)),
        reflectionPrompts: (Array.isArray(source.reflectionPrompts) && source.reflectionPrompts.length
            ? source.reflectionPrompts
            : (Array.isArray(source.reflection_prompts) && source.reflection_prompts.length ? source.reflection_prompts : defaults.reflectionPrompts)
        ).map((prompt, index) => normalizePrompt(prompt, index, promptIds))
    };
}

export function normalizeFlowchartResponse(template = {}, response = {}) {
    const normalizedTemplate = normalizeFlowchartTemplate(template);
    const source = response && typeof response === 'object' ? response : {};
    const nodeSource = Array.isArray(source.nodes) && source.nodes.length
        ? source.nodes
        : normalizedTemplate.starterNodes;
    const nodeIds = new Set();
    const nodes = nodeSource
        .slice(0, 30)
        .map((node, index) => normalizeNode(node, index, normalizedTemplate.allowedNodeTypes, nodeIds));
    const edges = normalizeEdges(
        Array.isArray(source.edges) && source.edges.length ? source.edges : normalizedTemplate.starterEdges,
        nodes
    ).slice(0, 40);
    const checklistSource = source.checklist || source.checklistItems || {};
    const reflectionSource = source.reflections || source.reflectionResponses || {};
    const checklist = {};
    const reflections = {};

    normalizedTemplate.checklistItems.forEach(item => {
        checklist[item.id] = checklistSource[item.id] === true;
    });
    normalizedTemplate.reflectionPrompts.forEach(prompt => {
        reflections[prompt.id] = normalizeText(reflectionSource[prompt.id], '');
    });

    return {
        version: Number(source.version) || FLOWCHART_RESPONSE_VERSION,
        nodes,
        edges,
        checklist,
        reflections,
        updatedAt: source.updatedAt || source.updated_at || new Date().toISOString()
    };
}

function getMissingRequiredNodeTypes(template, response) {
    const presentTypes = new Set(response.nodes.map(node => node.type));
    return template.requiredNodeTypes
        .filter(type => !presentTypes.has(type))
        .map(type => `${FLOWCHART_NODE_TYPE_LABELS[type] || type} node`);
}

function getMissingConditionBranches(template, response) {
    if (!template.requireConditionBranches) return [];
    const conditionNodes = response.nodes.filter(node => node.type === 'condition');
    const missing = [];
    conditionNodes.forEach(node => {
        const labels = response.edges
            .filter(edge => edge.source === node.id)
            .map(edge => edge.label.trim().toLowerCase());
        if (!labels.includes('yes')) missing.push(`${node.label}: Yes branch`);
        if (!labels.includes('no')) missing.push(`${node.label}: No branch`);
    });
    return missing;
}

export function getFlowchartCompletionSummary(template = {}, response = {}) {
    const normalizedTemplate = normalizeFlowchartTemplate(template);
    const normalizedResponse = normalizeFlowchartResponse(normalizedTemplate, response);
    const requiredNodeCount = normalizedTemplate.requiredNodeTypes.length;
    const presentRequiredTypes = new Set(
        normalizedResponse.nodes
            .filter(node => normalizedTemplate.requiredNodeTypes.includes(node.type))
            .map(node => node.type)
    );
    const missingRequiredNodes = getMissingRequiredNodeTypes(normalizedTemplate, normalizedResponse);
    const missingConditionBranches = getMissingConditionBranches(normalizedTemplate, normalizedResponse);
    const requiredChecklist = normalizedTemplate.checklistItems.filter(item => item.required);
    const completedChecklist = requiredChecklist.filter(item => normalizedResponse.checklist[item.id] === true);
    const requiredReflections = normalizedTemplate.reflectionPrompts.filter(prompt => prompt.required);
    const completedReflections = requiredReflections.filter(prompt => normalizeText(normalizedResponse.reflections[prompt.id], '').length > 0);

    return {
        nodeCount: normalizedResponse.nodes.length,
        edgeCount: normalizedResponse.edges.length,
        requiredNodeTypes: requiredNodeCount,
        presentRequiredNodeTypes: presentRequiredTypes.size,
        missingRequiredNodes,
        missingConditionBranches,
        requiredChecklist: requiredChecklist.length,
        completedChecklist: completedChecklist.length,
        requiredReflections: requiredReflections.length,
        completedReflections: completedReflections.length
    };
}

export function validateFlowchartResponse(template = {}, response = {}) {
    const normalizedTemplate = normalizeFlowchartTemplate(template);
    const normalizedResponse = normalizeFlowchartResponse(normalizedTemplate, response);
    const summary = getFlowchartCompletionSummary(normalizedTemplate, normalizedResponse);
    const missing = [];

    if (summary.nodeCount < normalizedTemplate.minNodes) {
        missing.push(`at least ${normalizedTemplate.minNodes} flowchart nodes`);
    }
    if (summary.edgeCount < Math.max(1, normalizedTemplate.minEdges)) {
        missing.push('at least one connector');
    }
    summary.missingRequiredNodes.forEach(label => missing.push(label));
    summary.missingConditionBranches.forEach(label => missing.push(label));
    normalizedTemplate.checklistItems
        .filter(item => item.required && normalizedResponse.checklist[item.id] !== true)
        .forEach(item => missing.push(item.text));
    normalizedTemplate.reflectionPrompts
        .filter(prompt => prompt.required && !normalizeText(normalizedResponse.reflections[prompt.id], ''))
        .forEach(prompt => missing.push(prompt.prompt));

    return {
        valid: missing.length === 0,
        missing,
        summary,
        response: normalizedResponse
    };
}
