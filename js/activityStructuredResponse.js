export {
    STRUCTURED_BLOCK_POLICIES,
    STRUCTURED_BLOCK_TYPES,
    STRUCTURED_BLOCK_TYPE_LABELS,
    STRUCTURED_RESPONSE_TYPE,
    STRUCTURED_TEMPLATE_VERSION
} from './activityStructuredResponseConstants.js';
export {
    canRequireStructuredBlock,
    createDefaultResponseTemplate,
    createStructuredBlock,
    createStructuredId,
    getStructuredBlockPolicy,
    normalizeChecklistItem,
    normalizeGridEntries,
    normalizeGridEntry,
    normalizeMatchingItem,
    normalizeResponseTemplate,
    normalizeStructuredBlock,
    structuredBlockUsesGrid,
    structuredBlockUsesItems,
    structuredBlockUsesPairs
} from './activityStructuredResponseCore.js';
export { validateStructuredResponses } from './activityStructuredResponseValidation.js';
