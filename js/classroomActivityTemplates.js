import { STRUCTURED_RESPONSE_TYPE } from './activityStructuredResponse.js';
import { CARD_SORT_TYPE } from './activityCardSort.js';
import { SPREADSHEET_TABLE_TYPE } from './activitySpreadsheetTable.js';
import { IMAGE_HOTSPOT_TYPE } from './activityImageHotspot.js';
import { EXTERNAL_ARTIFACT_TYPE } from './activityExternalArtifact.js';
import { FLOWCHART_ALGORITHM_TYPE } from './activityFlowchartAlgorithm.js';
import { DEFAULT_ACTIVITY_TYPE } from './classroomActivityDefaults.js';

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
