import { DEFAULT_SUBJECT_SLUG } from './services/vocabularyApi.js';

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
    const ownerId = getOwnerId(owner);
    const externalGuard = typeof options.isCurrent === 'function' ? options.isCurrent : () => true;
    return () => generation === (owner.teacherVocabularySessionGeneration || 0)
        && ownerId === getOwnerId(owner)
        && externalGuard();
}

export function beginTeacherVocabularyDocument(owner) {
    owner.teacherVocabularyDocumentGeneration = (owner.teacherVocabularyDocumentGeneration || 0) + 1;
    return owner.teacherVocabularyDocumentGeneration;
}

export function clearTeacherVocabularySessionState(owner) {
    owner.teacherVocabularySessionGeneration = (owner.teacherVocabularySessionGeneration || 0) + 1;
    owner.teacherVocabularyDocumentGeneration = (owner.teacherVocabularyDocumentGeneration || 0) + 1;
    globalThis.clearTimeout(owner.teacherVocabularyStatusTimer);
    owner.teacherVocabularySaveDebounces?.forEach(timeoutId => globalThis.clearTimeout(timeoutId));
    owner.teacherVocabularySaveDebounces?.clear();
    owner.teacherVocabularyLatestSaveByDocument?.clear();
    // A request that has already reached the repository may still settle later,
    // but it must not serialize saves started by the next signed-in teacher.
    owner.teacherVocabularySaveQueue = null;
    owner.teacherVocabularyStatusTimer = null;
    owner.teacherLibraryCache = null;
    owner.teacherLibraryPromise = null;
    owner.libraryItems = [];
    owner.libraryDrilldown = { subject: null, grade: null, trimester: null, month: null };
    owner.lastVocabularyRoute = null;
    owner.vocabularyMode = 'assign';
    owner.editingWordIndex = -1;
    owner.autoGenerateVocabId = false;
    owner.vocabSet = createEmptyTeacherVocabulary();

    ['#vocab-id', '#vocab-name', '#vocab-desc', '#vocab-grade', '#vocab-assigned-date',
        '#vocab-trimester', '#vocab-month', '#vocab-week', '#vocab-word-filter', '#import-file',
        '#word-input', '#def-input', '#example-input', '#image-input'].forEach(selector => {
        const input = document.querySelector(selector);
        if (input) input.value = '';
    });
    const partOfSpeech = document.querySelector('#pos-input');
    if (partOfSpeech) partOfSpeech.value = 'noun';
    const wordHunt = document.querySelector('#word-hunt-input');
    if (wordHunt) wordHunt.checked = false;
    ['#library-list', '#teacher-vocab-breadcrumb', '#words-container', '#activity-flow-settings'].forEach(selector => {
        document.querySelector(selector)?.replaceChildren();
    });
    const imagePreview = document.querySelector('#image-preview');
    if (imagePreview) {
        imagePreview.replaceChildren();
        imagePreview.textContent = 'No Image';
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
