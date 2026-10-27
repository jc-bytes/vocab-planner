import { preloadVocabularyFile } from '../services/vocabularyApi.js';
export { formatVocabularyCardTitle, formatVocabularyCardDescription } from '../vocabularyCardView.js';

export function formatVocabularyPurpose(purpose) {
    const normalized = String(purpose || '').trim().toLowerCase();
    if (normalized === 'summative') return 'Summative';
    if (normalized === 'practice') return 'Practice';
    return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : 'Unit';
}

export function getVocabularyPurposeClass(purpose) {
    const normalized = String(purpose || 'unit').trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `is-${normalized || 'unit'}`;
}

export function scheduleFirstVocabularyPreload(container, calendar) {
    const path = container.querySelector('[data-vocab-path]')?.dataset?.vocabPath;
    if (path) calendar.scheduleIdleTask(() => preloadVocabularyFile(path), 1200);
}
