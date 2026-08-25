import { installTeacherQuizBrowserMethods } from './teacherQuizBrowserMethods.js';
import { installTeacherQuizCoreMethods } from './teacherQuizCoreMethods.js';
import { QUIZ_VOCABULARY_BROWSER_CAPABILITIES } from './teacherQuizVocabularyBrowserAdapter.js';
import { loadVocabularyFile } from './services/vocabularyApi.js';

class TeacherQuizFeatureContext {}
installTeacherQuizCoreMethods(TeacherQuizFeatureContext);
installTeacherQuizBrowserMethods(TeacherQuizFeatureContext);

export function createTeacherQuizFeature(dependencies = {}) {
    const context = new TeacherQuizFeatureContext();
    if (typeof dependencies.getOwnedStorageKey !== 'function') {
        throw new TypeError('Teacher Quiz requires an account-scoped storage key provider.');
    }
    const vocabularyBrowser = dependencies.vocabularyBrowser || {};
    const missingCapability = QUIZ_VOCABULARY_BROWSER_CAPABILITIES.find(
        name => typeof vocabularyBrowser[name] !== 'function'
    );
    if (missingCapability) {
        throw new TypeError(`Teacher Quiz vocabulary browser requires ${missingCapability}().`);
    }
    Object.assign(context, Object.fromEntries(QUIZ_VOCABULARY_BROWSER_CAPABILITIES.map(name => [
        name,
        vocabularyBrowser[name]
    ])), {
        ensureAuthenticated: dependencies.ensureAuthenticated,
        activateQuizHub: dependencies.activateQuizHub,
        showQuizEditor: dependencies.showQuizEditor,
        showVocabularyEditor: dependencies.showVocabularyEditor,
        writeQuizRoute: dependencies.writeQuizRoute,
        getTeacherLibrary: dependencies.getTeacherLibrary,
        getActiveVocabulary: dependencies.getActiveVocabulary,
        commitActiveVocabulary: dependencies.commitActiveVocabulary,
        getSubjects: dependencies.getSubjects,
        refreshIcons: dependencies.refreshIcons,
        feedback: dependencies.feedback,
        storage: dependencies.storage || localStorage,
        getOwnedStorageKey: dependencies.getOwnedStorageKey,
        loadVocabularyFile: dependencies.loadVocabularyFile || loadVocabularyFile,
        loadQuizMaker: dependencies.loadQuizMaker || (() => import('./quizMaker.js?v=docx-logo-20260530'))
    });

    context.destroyed = false;
    context.lifecycleGeneration = 0;
    context.quizPickerLoadGeneration = 0;
    context.quizVocabularySelectionGeneration = 0;
    context.quizBuilderOpenGeneration = 0;
    context.quizLibraryItems = [];
    context.quizDrilldown = { subject: null, grade: null, trimester: null, month: null };
    context.quizVocabularyViewModes = null;
    context.quizMaker = null;
    context.quizMakerVocabKey = null;
    context.quizEditorOpen = false;
    context.quizReturnView = 'quizzes';

    return Object.freeze({
        show(options = {}) {
            if (options.resumeEditor && context.quizEditorOpen && context.quizMaker) {
                return context.openQuizMaker({ returnTo: context.quizReturnView || 'quizzes' });
            }
            return context.showQuizzesView(options);
        },
        open(options = {}) {
            return context.openQuizMaker(options);
        },
        destroy() {
            context.destroyQuizFeature();
        }
    });
}
