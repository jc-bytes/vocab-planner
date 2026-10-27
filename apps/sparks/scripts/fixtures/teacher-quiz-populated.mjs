// Browser fixture. Production composition owns every vocabulary/quiz method;
// only shell activation and catalog transport are supplied by this host.
import { installTeacherAuthMethods } from '../../js/teacherAuth.js';
import { installTeacherVocabularyMethods } from '../../js/teacherVocabulary.js';
import { installTeacherSettingsMethods } from '../../js/teacherSettings.js';
import { teacherSchoolCalendarSettingsMethods } from '../../js/teacherSchoolCalendarSettingsMethods.js';
import { installTeacherShellMethods } from '../../js/teacherShell.js';
import { installTeacherRoutingMethods } from '../../js/teacherRouting.js';
import { installTeacherLazyFeatureMethods, getLoadedTeacherFeatureContext } from '../../js/teacherLazyFeatures.js';
import { clearTeacherSchoolState } from '../../js/teacherSchoolSession.js';
import { createEmptyTeacherVocabulary } from '../../js/teacherVocabularySession.js';
import { getDefaultSchoolCalendar } from '../../js/services/vocabularyApi.js';
import { vocabularyRepository } from '../../js/services/vocabularyRepository.js';

function assert(value, message) {
    if (!value) throw new Error(`Populated Quiz: ${message}`);
}

async function until(predicate, message) {
    const deadline = Date.now() + 5000;
    while (!predicate()) {
        if (Date.now() >= deadline) throw new Error(`Populated Quiz timed out: ${message}`);
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

export async function runPopulatedTeacherQuizIntegration(html) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script').forEach(script => script.remove());
    document.body.replaceChildren(...Array.from(parsed.body.childNodes));
    localStorage.clear();
    const makeVocabulary = (id, name, overrides = {}) => ({
        id, name, subjectSlug: 'technology', grades: ['6'], trimester: 'IT', month: 'march', week: 1,
        activitySettings: {}, words: [{ word: `${id} term`, definition: `${name} meaning` }], ...overrides
    });
    const first = makeVocabulary('fixture-one', 'Networks');
    const second = makeVocabulary('fixture-two', 'Protocols', { week: 2 });
    const catalog = [first, second,
        makeVocabulary('fixture-science', 'Biology', { subjectSlug: 'science' }),
        makeVocabulary('fixture-grade-seven', 'Grade Seven', { grades: ['7'] }),
        makeVocabulary('fixture-trimester-two', 'Later Trimester', { trimester: 'IIT', month: 'august' }),
        makeVocabulary('fixture-april', 'Later Month', { month: 'april' })];
    let catalogReads = 0;
    class Manager {
        constructor() {
            this.currentUser = { id: 'teacher-quiz-owner-a' };
            this.isAuthenticated = true;
            this.authDisabled = false;
            this.subjects = [{ slug: 'technology', name: 'Technology', active: true }, { slug: 'science', name: 'Science', active: true }];
            this.schoolCalendar = getDefaultSchoolCalendar();
            this.vocabSet = createEmptyTeacherVocabulary();
            this.libraryItems = [{ vocab: { id: 'assign-only' } }];
            this.libraryDrilldown = { subject: 'science', grade: null, trimester: null, month: null };
            this.teacherVocabularySessionGeneration = 0;
            this.teacherVocabularyDocumentGeneration = 0;
            this.teacherVocabularyLibraryLoadGeneration = 0;
            this.teacherNavigationGeneration = 0;
            this.teacherVocabularyQueryService = {
                ensure: ({ queryFn }) => { catalogReads += 1; return queryFn({ signal: new AbortController().signal }); },
                refresh: ({ queryFn }) => queryFn({ signal: new AbortController().signal }),
                clearAccount: async () => {}, invalidate: async () => {}
            };
        }
    }
    installTeacherAuthMethods(Manager);
    installTeacherVocabularyMethods(Manager);
    installTeacherSettingsMethods(Manager);
    Object.defineProperties(Manager.prototype, Object.getOwnPropertyDescriptors(teacherSchoolCalendarSettingsMethods));
    installTeacherShellMethods(Manager);
    installTeacherRoutingMethods(Manager);
    installTeacherLazyFeatureMethods(Manager);
    const manager = new Manager();
    // UI host boundary only: retain real showEditor, routing, form/word renderers,
    // workflow tabs, catalog merge, adapter and feature lifecycle.
    manager.switchView = function (id) {
        this.currentView = id;
        document.querySelectorAll('.view').forEach(view => {
            view.classList.toggle('active', view.id === id);
            view.classList.toggle('hidden', view.id !== id);
        });
    };
    manager.refreshIcons = () => {};
    manager.fetchCloudVocabs = async () => [];
    manager.getLocalVocabs = () => catalog;
    history.replaceState(null, '', '#/teacher/vocabulary?mode=quizzes');
    const picker = () => document.querySelector('#quiz-vocab-picker');
    const clickChoice = text => {
        const choice = Array.from(picker().querySelectorAll('button, [role="button"]'))
            .find(node => node.textContent.includes(text));
        assert(choice, `missing hierarchy choice ${text}`);
        choice.click();
    };
    const assertRoute = expected => {
        const route = manager.parseRoute();
        for (const [key, value] of Object.entries(expected)) assert(route[key] === value, `route ${key}: ${route[key]} != ${value}`);
    };
    await manager.showQuizzesView({ drilldown: {}, updateRoute: false });
    assert(picker().textContent.includes('Technology') && picker().textContent.includes('Science'), 'populated subject hierarchy');
    clickChoice('Technology'); assertRoute({ subject: 'technology' });
    assert(picker().textContent.includes('Grade 6') && picker().textContent.includes('Grade 7'), 'grade hierarchy');
    clickChoice('Grade 6'); assertRoute({ grade: '6' });
    clickChoice('1st Trimester'); assertRoute({ trimester: 'IT' });
    clickChoice('March'); assertRoute({ month: 'march' });
    assert(picker().querySelectorAll('.teacher-vocab-pick-card').length === 2, 'cards filter exactly the selected month');
    assert(!picker().textContent.includes('Later Month') && !picker().textContent.includes('Biology'), 'cross-scope items filtered');
    assert(manager.libraryItems[0].vocab.id === 'assign-only' && manager.libraryDrilldown.subject === 'science', 'assign library state preserved');

    const originalDocument = manager.vocabSet;
    const documentGeneration = manager.teacherVocabularyDocumentGeneration;
    picker().querySelector('[aria-label="Build quiz from Networks"]').click();
    await until(() => manager.currentView === 'quiz-maker-view' && document.querySelector('#quiz-title-input')?.value.includes('Networks'), 'selected card opens actual QuizMaker');
    assert(manager.vocabSet !== originalDocument && manager.vocabSet !== first && manager.vocabSet.id === first.id, 'selection replaces document with independent clone');
    assert(manager.teacherVocabularyDocumentGeneration === documentGeneration + 1, 'selection advances real document generation');
    assert(document.querySelector('#vocab-name').value === first.name && document.querySelector('#words-container').textContent.includes('fixture-one term'), 'actual form and word rendering receives replacement');
    document.querySelector('#quiz-maker-back-btn').click();
    await until(() => manager.currentView === 'teacher-dashboard-view' && picker().querySelectorAll('.teacher-vocab-pick-card').length === 2, 'quiz return restores populated hub');

    document.querySelector('[data-quiz-vocab-view-mode="rows"]').click();
    assert(picker().querySelectorAll('.quiz-vocab-row').length === 2, 'rows render through actual adapter');
    assert(picker().textContent.includes('1 word'), 'row presentation includes actual word count');
    picker().querySelector('[aria-label="Build quiz from Protocols"]').click();
    await until(() => manager.vocabSet.id === second.id && document.querySelector('#quiz-title-input')?.value.includes('Protocols'), 'row selection replaces prior document');
    // Keep this strict regression independent of the remaining lifecycle controls:
    // the old maker must not erase the replacement maker's shared DOM/handlers.
    const replacementControlsAlive = typeof document.querySelector('#quiz-maker-back-btn').onclick === 'function'
        && document.querySelector('#quiz-section-list').childNodes.length > 0;
    await manager.openQuizMaker({ returnTo: 'editor' });
    document.querySelector('#quiz-maker-back-btn').click();
    const replacementReturnsToEditor = manager.currentView === 'teacher-editor-view';
    // A fresh lifecycle independently covers the editor-return contract even if
    // the replacement regression fails. The final assertion still fails closed.
    manager.disposeLoadedTeacherFeatures();
    await manager.openQuizMaker({ returnTo: 'editor' });
    document.querySelector('#quiz-maker-back-btn').click();
    assert(manager.currentView === 'teacher-editor-view', 'fresh quiz return to actual vocabulary editor');

    const oldFeature = getLoadedTeacherFeatureContext(manager, 'quizzes');
    manager.disposeLoadedTeacherFeatures();
    assert(picker().childNodes.length === 0, 'dispose clears picker');
    const disposedView = manager.currentView;
    assert(await oldFeature.show() === false && manager.currentView === disposedView, 'disposed feature cannot reactivate');
    await manager.showQuizzesView({ drilldown: { subject: 'technology', grade: '6', trimester: 'IT', month: 'march' } });
    assert(getLoadedTeacherFeatureContext(manager, 'quizzes') !== oldFeature && picker().querySelectorAll('.quiz-vocab-row').length === 2, 'reopen creates new feature and restores owner view preference');
    document.querySelector('[data-quiz-vocab-view-mode="cards"]').click();
    assert(picker().querySelectorAll('.teacher-vocab-pick-card').length === 2, 'cards can be restored after reopen');

    const heldCatalog = deferred();
    manager.fetchCloudVocabs = () => heldCatalog.promise;
    const pendingShow = manager.showQuizzesView();
    await until(() => picker().textContent.includes('Loading vocabulary'), 'held catalog entered real read');
    clearTeacherSchoolState(manager);
    manager.currentUser = { id: 'teacher-quiz-owner-b' };
    const replacementDocument = manager.vocabSet;
    heldCatalog.resolve([makeVocabulary('stale-owner-a', 'Stale Owner A')]);
    await pendingShow;
    assert(manager.vocabSet === replacementDocument && picker().childNodes.length === 0, 'old-owner catalog cannot publish after session disposal');
    manager.fetchCloudVocabs = async () => [];
    await manager.showQuizzesView({ drilldown: { subject: 'technology', grade: '6', trimester: 'IT', month: 'march' } });
    assert(picker().querySelectorAll('.teacher-vocab-pick-card').length === 2, 'replacement owner can reopen');

    const heldSelection = deferred();
    let selectionReads = 0;
    const originalGet = vocabularyRepository.get;
    const cloudVocabulary = makeVocabulary('held-cloud-selection', 'Held Selection');
    try {
        // The actual resolver still chooses the cloud repository. Hold only its
        // transport boundary, then exercise real school/session disposal.
        vocabularyRepository.get = id => {
            assert(id === cloudVocabulary.id, 'cloud selection reads its exact ID');
            selectionReads += 1;
            return heldSelection.promise;
        };
        manager.fetchCloudVocabs = async () => [cloudVocabulary];
        await manager.showQuizzesView();
        picker().querySelector('[aria-label="Build quiz from Held Selection"]').click();
        await until(() => selectionReads === 1, 'held selection entered real resolver');
        clearTeacherSchoolState(manager);
        // Same account, new session generation: UID-only checks cannot cover it.
        const sessionDocument = manager.vocabSet;
        const viewBeforeResolution = manager.currentView;
        heldSelection.resolve(cloudVocabulary);
        await new Promise(resolve => setTimeout(resolve, 30));
        assert(manager.vocabSet === sessionDocument && manager.currentView === viewBeforeResolution
            && picker().childNodes.length === 0, 'old-session selection cannot replace document or open builder');
    } finally {
        vocabularyRepository.get = originalGet;
    }
    manager.fetchCloudVocabs = async () => [];
    const readsBeforeDenied = catalogReads;
    manager.isAuthenticated = false;
    await manager.showQuizzesView();
    assert(catalogReads === readsBeforeDenied && manager.currentView === 'teacher-login-view', 'signed-out activation cannot read catalog');
    assert(!localStorage.getItem('teacher_quiz_builder_active_draft'), 'no unscoped quiz draft written');
    manager.disposeLoadedTeacherFeatures();
    manager.clearTeacherVocabularySessionState();
    const result = { hierarchy: ['subject', 'grade', 'trimester', 'month'], cards: 2, rows: 2,
        realDocumentReplacement: true, returnDestinations: ['quizzes', 'editor'], disposalAndReopen: true,
        staleOwnerCatalogSuppressed: true, staleSessionSelectionSuppressed: true, signedOutReadSuppressed: true,
        replacementControlsAlive, replacementReturnsToEditor, catalogReads, selectionReads };
    return result;
}
