import { schoolContext } from './services/schoolContext.js';
import { resetTeacherVocabularySaves } from './teacherVocabularySaves.js';
import { DEFAULT_SUBJECT_SLUG } from './services/vocabularyApi.js';
import { serverStateQuery } from './services/serverStateQuery.js';

export function createEmptyTeacherVocabulary() {
    return {
        id: '',
        name: '',
        description: '',
        grade: '',
        subjectSlug: DEFAULT_SUBJECT_SLUG,
        activitySettings: {},
        words: []
    };
}

function getOwnerId(owner) {
    return owner.currentUser?.uid || owner.currentUser?.id || null;
}

export function createTeacherVocabularyOperationGuard(owner, options = {}) {
    const generation = owner.teacherVocabularySessionGeneration || 0;
    const schoolGeneration = schoolContext.getGeneration();
    const ownerId = getOwnerId(owner);
    const externalGuard = typeof options.isCurrent === 'function' ? options.isCurrent : () => true;
    return () => schoolGeneration === schoolContext.getGeneration() && generation === (owner.teacherVocabularySessionGeneration || 0)
        && ownerId === getOwnerId(owner)
        && externalGuard();
}

export function beginTeacherVocabularyDocument(owner) {
    delete owner.teacherVocabularyLocalCopyDocumentGeneration;
    owner.teacherVocabularyDocumentGeneration = (owner.teacherVocabularyDocumentGeneration || 0) + 1;
    return owner.teacherVocabularyDocumentGeneration;
}

export function clearTeacherVocabularySessionState(owner) {
    const accountId = getOwnerId(owner);
    if (accountId) void (owner.teacherVocabularyQueryService || serverStateQuery).clearAccount(accountId);
    owner.teacherVocabularySessionGeneration = (owner.teacherVocabularySessionGeneration || 0) + 1;
    owner.teacherVocabularyDocumentGeneration = (owner.teacherVocabularyDocumentGeneration || 0) + 1;
    owner.teacherVocabularyLibraryLoadGeneration = (owner.teacherVocabularyLibraryLoadGeneration || 0) + 1;
    delete owner.teacherVocabularyLocalCopyDocumentGeneration;
    resetTeacherVocabularySaves(owner);
    owner.libraryDrilldown = { subject: null, grade: null, trimester: null, month: null };
    owner.lastVocabularyRoute = null;
    owner.vocabularyMode = 'assign';
    owner.editingWordIndex = -1;
    owner.autoGenerateVocabId = false;
    owner.vocabSet = createEmptyTeacherVocabulary();

    ['#vocab-id', '#vocab-name', '#vocab-desc', '#vocab-grade', '#vocab-assigned-date',
        '#vocab-trimester', '#vocab-month', '#vocab-week', '#vocab-word-filter', '#import-file',
        '#word-input', '#def-input', '#example-input', '#synonyms-input', '#antonyms-input', '#image-input'].forEach(selector => {
        const input = document.querySelector(selector);
        if (input) input.value = '';
    });
    const partOfSpeech = document.querySelector('#pos-input');
    if (partOfSpeech) partOfSpeech.value = '';
    const difficulty = document.querySelector('#difficulty-input');
    if (difficulty) difficulty.value = '1';
    const wordHunt = document.querySelector('#word-hunt-input');
    if (wordHunt) wordHunt.checked = false;
    ['#library-list', '#teacher-library-filters', '#teacher-library-result-count', '#teacher-vocab-breadcrumb', '#words-container', '#activity-flow-settings', '#vocab-data-readiness'].forEach(selector => {
        document.querySelector(selector)?.replaceChildren();
    });
    const legacyImagePreview = document.querySelector('#image-preview');
    if (legacyImagePreview) {
        legacyImagePreview.replaceChildren();
        legacyImagePreview.textContent = 'No Image';
    }
    const summaryDefaults = {
        '#vocab-editor-subtitle': '',
        '#vocab-word-count': '0',
        '#vocab-word-hunt-count': '0',
        '#vocab-placement-summary': 'Not set',
        '#vocab-required-summary': 'Not set',
        '#vocab-words-summary': 'No words yet.'
    };
    Object.entries(summaryDefaults).forEach(([selector, value]) => {
        const element = document.querySelector(selector);
        if (element) element.textContent = value;
    });
    document.querySelector('#word-modal')?.classList.add('hidden');
}

export function installTeacherVocabularySessionMethods(TeacherManager) {
    Object.defineProperties(TeacherManager.prototype, {
        createTeacherVocabularyOperationGuard: {
            configurable: true,
            writable: true,
            value(options = {}) {
                return createTeacherVocabularyOperationGuard(this, options);
            }
        },
        beginTeacherVocabularyDocument: {
            configurable: true,
            writable: true,
            value() {
                return beginTeacherVocabularyDocument(this);
            }
        },
        clearTeacherVocabularySessionState: {
            configurable: true,
            writable: true,
            value() {
                clearTeacherVocabularySessionState(this);
            }
        }
    });
}
