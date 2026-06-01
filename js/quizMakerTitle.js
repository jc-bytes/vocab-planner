const VOCAB_TITLE_PREFIX_PATTERN = /^\s*Grade\s+\d+\s+(?:T\d+|I{1,3}T)\s*(?:Practice|Summative|Review|Vocabulary)?\s*:\s*[^-]+-\s*/i;

export function cleanQuizTitle(value) {
    const original = String(value || 'Quiz').trim();
    return original.replace(VOCAB_TITLE_PREFIX_PATTERN, '').trim() || original || 'Quiz';
}
