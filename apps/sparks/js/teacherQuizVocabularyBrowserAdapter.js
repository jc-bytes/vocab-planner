import { renderTeacherVocabularyHierarchy, renderVocabularyBreadcrumb } from './teacherVocabularyLibrary/teacherVocabularyHierarchy.js';
import { createTeacherVocabularyBrowserModel } from './teacherVocabularyLibrary/teacherVocabularyBrowserModel.js';

export const QUIZ_VOCABULARY_BROWSER_CAPABILITIES = Object.freeze([
    'beginRender',
    'renderHierarchy',
    'renderBreadcrumb',
    'getViewDepth',
    'getDefaultViewMode',
    'filterItems',
    'getRowLayout',
    'getRowPresentation',
    'compareRows',
    'comparePlacements',
    'getWordCount',
    'getPickerPresentation'
]);

export function createQuizVocabularyBrowserAdapter(dependencies) {
    const manager = createTeacherVocabularyBrowserModel(dependencies);
    return Object.freeze({
        beginRender() { manager.beginRender(); },
        renderHierarchy(options) {
            return renderTeacherVocabularyHierarchy(manager, options);
        },
        renderBreadcrumb(options) {
            return renderVocabularyBreadcrumb(manager, options);
        },
        getViewDepth(drilldown) {
            return manager.getTeacherVocabularyViewDepth(drilldown);
        },
        getDefaultViewMode(depth) {
            return manager.getDefaultTeacherVocabularyViewMode(depth);
        },
        filterItems(items, drilldown) {
            return manager.getTeacherVocabularyItemsForDrilldown(drilldown, items);
        },
        getRowLayout(drilldown) {
            return Object.freeze({
                columns: manager.getTeacherVocabularyRowColumns(drilldown),
                depthClass: manager.getTeacherVocabularyRowDepthClass(drilldown)
            });
        },
        getRowPresentation({ vocab, type }) {
            return Object.freeze({
                grades: manager.getVocabGrades(vocab).map(grade => manager.formatGradeLabel(grade)).join(', '),
                trimester: manager.getTeacherTrimesterShortLabel(manager.getTeacherTrimesterKey(vocab)),
                month: manager.getTeacherMonthShortLabel(manager.getTeacherMonthKey(vocab)),
                week: vocab?.week || manager.inferTeacherWeek(vocab) || '',
                purpose: manager.getTeacherVocabularyPurpose(vocab, type),
                wordCount: manager.getTeacherVocabularyWordCount(vocab)
            });
        },
        compareRows(itemA, itemB, drilldown) {
            return manager.compareTeacherVocabularyRowOrder(itemA, itemB, drilldown);
        },
        comparePlacements(itemA, itemB) {
            return manager.compareVocabPlacement(itemA.vocab, itemB.vocab);
        },
        getWordCount(vocab) {
            return manager.getTeacherVocabularyWordCount(vocab);
        },
        getPickerPresentation(vocab, type) {
            return Object.freeze({
                badge: type === 'cloud' ? 'Cloud' : type === 'local' ? 'Draft' : 'Repo',
                grades: Array.isArray(vocab.grades) ? vocab.grades.join(', ') : (vocab.grade || ''),
                subject: manager.getSubjectForVocab(vocab),
                placement: manager.formatVocabPlacementLabel(vocab)
            });
        }
    });
}
