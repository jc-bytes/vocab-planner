import { createTeacherMaterialItem } from './teacherMaterialItem.js';
import { createTeacherUnitActions } from './teacherUnitActions.js';
import { createElement } from './main.js';
import { createVocabularyCard, formatVocabularyCardTitle, formatVocabularyCardDescription } from './vocabularyCardView.js';

export function createTeacherUnitCard(owner, vocab, type) {
    const actions = createTeacherUnitActions(owner, vocab, type);
    const face = createVocabularyCard.call({
        sm: { subjects: owner.getSubjects() },
        vocabularyData: { loadVocabulary: actions.onPreview },
        formatVocabularyCardTitle,
        formatVocabularyCardDescription,
        formatVocabularyPurpose: () => owner.getTeacherVocabularyPurpose(vocab, type) || 'Unit',
        getVocabularyPurposeClass: () => `is-${String(vocab.purpose || 'unit').toLowerCase().replace(/[^a-z-]/g, '')}`,
        formatVocabularyScheduleLabel: () => owner.formatVocabPlacementLabel(vocab),
        getVocabularyRequiredProgress: () => ({ completed: 0, total: 0, percent: 0, ariaLabel: 'Student preview' })
    }, vocab);
    face.setAttribute('aria-label', `Student preview: ${formatVocabularyCardTitle(vocab)}`);
    face.querySelector('.student-vocab-progress-percent').textContent = '';
    const count = owner.getTeacherVocabularyWordCount(vocab);
    const summary = face.querySelector('.student-vocab-required-progress');
    summary.replaceChildren(createElement('span', '', `${count ? `${count} words · ` : ''}${({ remote: 'Repository material', local: 'Draft', cloud: 'Saved material' })[type] || 'Unit'}`));
    return createTeacherMaterialItem({ face, title: vocab.name || 'Untitled', ...actions });
}
