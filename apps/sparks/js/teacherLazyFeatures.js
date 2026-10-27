import { requestWithTimeout } from './services/requestReliability.js';
import { schoolSessionKey } from './services/schoolScope.js';
import { schoolContext } from './services/schoolContext.js';
import { notifications } from './main.js';
import { supabaseService } from './supabaseService.js';
import { teacherPageRegistry } from './teacherPageRegistry.js';

const VOCABULARY_PAGE = teacherPageRegistry.get('vocabulary');
const SPARKS_PAGE = teacherPageRegistry.get('sparks');
const GROUPS_PAGE = teacherPageRegistry.get('groups');
const DATA_PAGE = teacherPageRegistry.get('data');

const featurePromises = new Map();
const featureContexts = new WeakMap();

const featureTemplateIds = {
    sparks: ['teacher-sparks-modal-template'],
    dataManagement: ['teacher-data-management-view-template'],
    quizzes: ['teacher-quizzes-view-template']
};

function mountTeacherFeatureTemplates(featureName) {
    (featureTemplateIds[featureName] || []).forEach(templateId => {
        const template = document.getElementById(templateId);
        if (!template?.content) return;
        const mountName = templateId.replace(/^teacher-/, '').replace(/-template$/, '');
        const mount = document.querySelector(`[data-teacher-feature-mount="${mountName}"]`);
        const fragment = template.content.cloneNode(true);
        if (mount) mount.replaceWith(fragment);
        else document.body.appendChild(fragment);
        template.remove();
    });
}

export function getTeacherFeatureContext(manager, featureName, feature) {
    let managerContexts = featureContexts.get(manager);
    if (!managerContexts) {
        managerContexts = new Map();
        featureContexts.set(manager, managerContexts);
    }
    if (managerContexts.has(featureName)) return managerContexts.get(featureName);

    const context = feature.create(manager);
    managerContexts.set(featureName, context);
    return context;
}

function captureVocabularyBrowserScope(manager, options = {}) {
    const user = manager.currentUser, session = manager.teacherVocabularySessionGeneration;
    const authMode = manager.authDisabled, school = schoolContext.getGeneration();
    const operation = manager.createTeacherVocabularyOperationGuard(options);
    const navigation = manager.captureTeacherNavigation?.();
    return () => user === manager.currentUser && session === manager.teacherVocabularySessionGeneration
        && authMode === manager.authDisabled && school === schoolContext.getGeneration()
        && operation() && (!navigation || manager.isTeacherNavigationCurrent(navigation));
}

const featureDefinitions = {
    vocabularyBrowser: async () => {
        const { createTeacherVocabularyBrowserFeature } = await import('./teacherVocabularyBrowserFeature.js');
        return {
            publicMethods: { loadLibrary: 'show' },
            create(manager) {
                return createTeacherVocabularyBrowserFeature({
                    getSubjects: () => manager.getSubjects(),
                    describeVocabulary: (vocab, type) => manager.describeTeacherVocabulary(vocab, type),
                    describeVocabularyGrouping: vocab => manager.describeTeacherVocabularyGrouping(vocab),
                    ensureAuthenticated: showAlert => manager.ensureAuthenticated(showAlert),
                    captureScope: options => captureVocabularyBrowserScope(manager, options),
                    isActive: () => manager.vocabularyMode === 'assign' && document.getElementById(VOCABULARY_PAGE.viewId)?.classList.contains('active'),
                    getDrilldown: () => manager.libraryDrilldown,
                    writeDrilldown(drilldown) { manager.libraryDrilldown = { ...drilldown }; manager.updateVocabularyRoute(); },
                    loadCatalog: options => manager.getTeacherLibrary(options),
                    openItem: (vocab, type) => manager.openTeacherVocabularyItem(vocab, type),
                    assignItem: options => manager.openAssignmentPublisher(options),
                    removeDraft: id => manager.removeLocalVocab(id),
                    deleteSaved: id => manager.deleteCloudVocab(id),
                    captureNavigation: () => manager.captureTeacherNavigation(),
                    isNavigationCurrent: value => manager.isTeacherNavigationCurrent(value),
                    refreshIcons: root => manager.refreshIcons(root)
                });
            }
        };
    },
    studentProgress: async () => {
        const { createTeacherStudentProgressFeature } = await import('./teacherStudentProgressFeature.js');
        return {
            publicMethods: { showProgressView: 'showProgressView', showStudentProfileById: 'showStudentProfileById' },
            create(manager) {
                const getSession = () => ({ currentUser: manager.currentUser, authDisabled: manager.authDisabled,
                    generation: manager.studentProgressSessionGeneration, school: schoolSessionKey(manager.currentUser?.uid || manager.currentUser?.id) });
                return createTeacherStudentProgressFeature({
                    getSession,
                    isSessionCurrent: owner => { const now = getSession(); return now.currentUser === owner.currentUser
                        && now.authDisabled === owner.authDisabled && now.generation === owner.generation && now.school === owner.school; },
                    ensureAuthenticated: (...args) => manager.ensureAuthenticated(...args),
                    switchView: (...args) => manager.switchView(...args),
                    setRoute: (...args) => manager.setRoute(...args),
                    applyRoute: (...args) => manager.applyRoute(...args),
                    captureTeacherNavigation: () => manager.captureTeacherNavigation(),
                    isTeacherNavigationCurrent: value => manager.isTeacherNavigationCurrent(value),
                    getSelectedTeacherClassId: () => manager.getSelectedTeacherClassId(),
                    getClassroomRepository: () => manager.classroomRepository,
                    getClassOptions: () => manager.teacherClassOptions,
                    getQueryService: () => manager.serverStateQuery,
                    refreshIcons: (...args) => manager.refreshIcons(...args),
                    showTeacherSection: (...args) => manager.showTeacherSection(...args)
                });
            }
        };
    },
    schoolAdministration: async () => {
        const { createSchoolAdminView } = await import('./schoolAdminView.js');
        const { normalizeSchoolCalendar } = await import('./services/schoolCalendar.js');
        return { publicMethods: { showSchoolAdministration: 'show', showPlatformAdministration: 'showPlatform' }, create(manager) {
            const view = createSchoolAdminView({ root: document.getElementById('teacher-administration-view'),
                getCurrentUser: () => manager.currentUser,
                async onCalendarSaved(calendar, { isCurrent, activeChanged }) {
                    if (!isCurrent()) return;
                    manager.schoolCalendar = normalizeSchoolCalendar(calendar);
                    manager.schoolCalendarSettingsLoaded = true;
                    manager.updateSchoolCalendarUI?.();
                    if (activeChanged) {
                        try { await manager.recalculateCloudVocabularyPlacements?.(manager.schoolCalendar, { isCurrent }); }
                        catch { throw new Error('Trimester dates were saved, but vocabulary dates could not be refreshed.'); }
                    }
                    if (isCurrent()) manager.invalidateTeacherLibraryCache?.();
                }
            });
            const platformView = createSchoolAdminView({ root: document.getElementById('teacher-platform-view'), mode: 'platform', onOpenSchool: () => manager.showTeacherSection('administration'), getCurrentUser: () => manager.currentUser });
            return {
                show(options = {}) {
                    if (!manager.ensureAuthenticated(false)) return;
                    manager.switchView('teacher-administration-view', { updateRoute: false });
                    return view.show(options);
                },
                async showPlatform() {
                    if (!manager.ensureAuthenticated(false) || !manager.schoolAccess.getAccess().platformAdmin) return;
                    manager.switchView('teacher-platform-view', { updateRoute: false });
                    await platformView.show();
                    if (manager.parseRoute()?.view === 'platform' && document.getElementById('teacher-platform-view')?.classList.contains('active')) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                },
                deactivate() { view.deactivate(); platformView.deactivate(); },
                destroy() { view.destroy(); platformView.destroy(); }
            };
        } };
    },
    classes: async () => {
        const { createTeacherWorkspaceFeature } = await import('./teacherWorkspaceFeature.js');
        return {
            publicMethods: { showClassHome: 'showHome', refreshTeacherClassSelector: 'refreshClassSelector', showClassesView: 'showClasses', showClassStudentsView: 'showStudents', showAssignmentsView: 'showAssignments', openAssignmentPublisher: 'publish' },
            create: createTeacherWorkspaceFeature
        };
    },
    sparks: async () => {
        const [module] = await Promise.all([
            import('./teacherSparks.js'),
            import('../css/teacherSparks.css')
        ]);
        return {
            publicMethods: { showSparksView: 'show', showSparkEditor: 'edit' },
            create(manager) {
                return module.createTeacherSparksFeature({
                    ensureAuthenticated: (...args) => manager.ensureAuthenticated(...args),
                    showView: () => manager.switchView(SPARKS_PAGE.viewId),
                    showEditorView: ({ materialId }) => {
                        manager.switchView('teacher-spark-editor-view', { updateRoute: false });
                        if (!manager.isApplyingRoute) manager.setRoute({ view: 'spark-editor', materialId });
                    },
                    isAuthenticationDisabled: () => manager.authDisabled,
                    getCurrentUser: () => manager.currentUser,
                    publishMaterial: context => manager.openAssignmentPublisher(context),
                    getSchoolCalendar: () => manager.schoolCalendar,
                    refreshIcons: root => manager.refreshIcons(root),
                    feedback: notifications
                });
            }
        };
    },
    groups: async () => {
        const module = await import('./teacherGroups.js');
        return {
            publicMethods: { showGroupsView: 'show' },
            create(manager) {
                return module.createTeacherGroupsFeature({
                    ensureAuthenticated: (...args) => manager.ensureAuthenticated(...args),
                    showView: () => manager.switchView(GROUPS_PAGE.viewId),
                    onClassChange: classId => manager.changeTeacherClass(classId),
                    classesRepository: manager.classroomRepository,
                    getSession: () => ({
                        authDisabled: manager.authDisabled,
                        currentUser: manager.currentUser
                    }),
                    refreshIcons: root => manager.refreshIcons(root),
                    feedback: notifications
                });
            }
        };
    },
    dataManagement: async () => {
        const module = await import('./teacherDataManagement.js');
        return {
            publicMethods: { showDataManagementView: 'show' },
            create(manager) {
                return module.createTeacherDataManagementFeature({
                    ensureAuthenticated: (...args) => manager.ensureAuthenticated(...args),
                    activateDataManagement(area) {
                        manager.switchView(DATA_PAGE.viewId, { updateRoute: false });
                        manager.setActiveTeacherTab(area);
                    },
                    writeDataRoute(area, tab, options = {}) {
                        manager.setRoute({ view: area, tab }, options);
                    },
                    isRouteApplying: () => manager.isApplyingRoute,
                    isDataRouteCurrent(area, tab) {
                        const route = manager.parseRoute();
                        const routeTab = route?.tab || (area === DATA_PAGE.id ? 'dashboard' : 'subjects');
                        return route?.view === area && routeTab === tab;
                    },
                    loadSubjectSettings: (...args) => manager.loadSubjectSettings(...args),
                    loadGamificationSettings: (...args) => manager.loadGamificationSettings(...args),
                    loadSchoolCalendarSettings: (...args) => manager.loadSchoolCalendarSettings(...args),
                    saveGamificationSettings: (...args) => manager.saveGamificationSettings(...args),
                    saveSchoolCalendarSettings: (...args) => manager.saveSchoolCalendarSettings(...args),
                    bindSchoolCalendarInputs: listener => manager.bindSchoolCalendarInputs(listener),
                    addSubjectFromForm: (...args) => manager.addSubjectFromForm(...args),
                    saveSubjectSettings: (...args) => manager.saveSubjectSettings(...args),
                    loadRoster: (...args) => manager.getStudentRosterData(...args),
                    getRoster: () => manager.allStudentData,
                    getExplicitSelectedStudentIds: () => Array.from(manager.selectedStudents),
                    loadLibrary: (...args) => manager.getTeacherLibrary(...args),
                    loadDashboardAnalytics: options => supabaseService.getTeacherDashboardAnalytics(options),
                    getCurrentUser: () => manager.currentUser,
                    feedback: notifications,
                    storage: localStorage,
                    refreshIcons: root => manager.refreshIcons(root)
                });
            }
        };
    },
    wordHuntReview: async () => {
        const module = await import('./teacherWordHuntReview.js');
        return {
            publicMethods: {
                showWordHuntReviewView: 'show',
                loadWordHuntReview: 'load'
            },
            create(manager) {
                const root = document.getElementById('vocabulary-review-panel');
                return module.createTeacherWordHuntReviewFeature({
                    root,
                    ensureAuthenticated: (...args) => manager.ensureAuthenticated(...args),
                    activateReview: ({ updateRoute, replace }) => {
                        manager.vocabularyMode = 'review';
                        manager.switchView(VOCABULARY_PAGE.viewId);
                        manager.setVocabularyWorkflowTab('review', {
                            loadReview: false,
                            updateRoute,
                            replace
                        });
                    },
                    isReviewActive: () => manager.vocabularyMode === 'review',
                    isAuthenticationDisabled: () => manager.authDisabled,
                    getCurrentUser: () => manager.currentUser,
                    getSubjects: () => manager.getSubjects(),
                    getClassScope: () => manager.getSelectedTeacherClassId(),
                    repository: {
                        async loadReviewData() {
                            const classId = manager.getSelectedTeacherClassId();
                            if (!classId) return [];
                            const classes = manager.classroomRepository || (await import('./services/classroomRepository.js')).classroomRepository;
                            const [students, roster, assignments] = await Promise.all([
                                supabaseService.getWordHuntReviewData(), classes.getRoster(classId),
                                classes.listAssignments(classId)
                            ]);
                            const members = new Set(roster.map(student => student.studentId));
                            const keys = new Set(assignments.map(assignment => `assignment:${assignment.id}`));
                            return students.filter(student => members.has(student.id || student.userId)).map(student => ({
                                ...student, units: Object.fromEntries(Object.entries(student.units || {}).filter(([key]) => keys.has(key)))
                            }));
                        },
                        downloadImage: path => supabaseService.downloadWordHuntImage(path)
                    },
                    refreshIcons: () => manager.refreshIcons(),
                    feedback: notifications
                });
            }
        };
    },
    quizzes: async () => {
        const module = await import('./teacherQuiz.js');
        const { createQuizVocabularyBrowserAdapter } = await import('./teacherQuizVocabularyBrowserAdapter.js');
        return {
            publicMethods: {
                showQuizzesView: 'show',
                openQuizMaker: 'open'
            },
            create(manager) {
                return module.createTeacherQuizFeature({
                    ensureAuthenticated: (...args) => manager.ensureAuthenticated(...args),
                    activateQuizHub() {
                        manager.vocabularyMode = 'quizzes';
                        manager.switchView(VOCABULARY_PAGE.viewId, { updateRoute: false });
                        manager.setVocabularyWorkflowTab('quizzes', {
                            updateRoute: false,
                            loadQuizzes: false
                        });
                    },
                    showQuizEditor: () => manager.switchView('quiz-maker-view'),
                    showVocabularyEditor: () => manager.showEditor(),
                    writeQuizRoute(drilldown, options = {}) {
                        manager.setRoute({
                            view: VOCABULARY_PAGE.id,
                            subject: drilldown.subject,
                            grade: drilldown.grade,
                            trimester: drilldown.trimester,
                            month: drilldown.month,
                            mode: 'quizzes'
                        }, options);
                    },
                    getTeacherLibrary: (...args) => manager.getTeacherLibrary(...args),
                    getActiveVocabulary: () => manager.vocabSet,
                    commitActiveVocabulary(vocabulary) {
                        manager.beginTeacherVocabularyDocument();
                        manager.vocabSet = vocabulary;
                        manager.updateFormUI();
                        manager.renderWords();
                    },
                    getSubjects: () => manager.getSubjects(),
                    refreshIcons: root => manager.refreshIcons(root),
                    feedback: notifications,
                    storage: localStorage,
                    getOwnedStorageKey(key) {
                        const ownerId = manager.currentUser?.uid || manager.currentUser?.id;
                        return `${key}:${schoolSessionKey(ownerId || 'development-teacher')}`;
                    },
                    vocabularyBrowser: createQuizVocabularyBrowserAdapter({ getSubjects: () => manager.getSubjects(),
                        describeVocabulary: (vocab, type) => manager.describeTeacherVocabulary(vocab, type),
                        describeVocabularyGrouping: vocab => manager.describeTeacherVocabularyGrouping(vocab) })
                });
            }
        };
    }
};

export async function loadTeacherFeature(featureName) {
    if (!featurePromises.has(featureName)) {
        const loader = featureDefinitions[featureName];
        mountTeacherFeatureTemplates(featureName);
        featurePromises.set(featureName, loader().catch(error => {
            featurePromises.delete(featureName);
            throw error;
        }));
    }
    return featurePromises.get(featureName);
}

function installLazyMethod(TeacherManager, methodName, featureName) {
    async function lazyFeatureMethod(...args) {
        let navigation = null;
        const vocabularyCurrent = featureName === 'vocabularyBrowser' ? captureVocabularyBrowserScope(this, args[0]) : () => true;
        const progressEpoch = featureName === 'studentProgress' ? this.studentProgressSessionGeneration : null;
        const progressOwner = this.currentUser;
        const current = () => vocabularyCurrent() && (!navigation || this.isTeacherNavigationCurrent(navigation))
            && (featureName !== 'studentProgress' || progressEpoch === this.studentProgressSessionGeneration && progressOwner === this.currentUser);
        try {
            navigation = typeof this.captureTeacherNavigation === 'function'
                ? this.captureTeacherNavigation()
                : null;
            const feature = await (['studentProgress', 'vocabularyBrowser', 'classes'].includes(featureName)
                ? requestWithTimeout(() => loadTeacherFeature(featureName), { timeoutMs: 10000, label: featureName === 'studentProgress' ? 'Loading student records' : featureName === 'classes' ? 'Loading classes' : 'Loading vocabulary materials' })
                : loadTeacherFeature(featureName));
            if (!current()) return undefined;
            const context = getTeacherFeatureContext(this, featureName, feature);
            const publicMethodName = feature.publicMethods?.[methodName];
            const installedMethod = publicMethodName ? context[publicMethodName] : undefined;
            if (typeof installedMethod !== 'function') {
                throw new Error(`${featureName} did not install ${methodName}.`);
            }
            return await installedMethod.apply(context, args);
        } catch (error) {
            if (!current() || error.name === 'AbortError' || error.code === 'REQUEST_ABORTED') return undefined;
            console.error(`Could not load teacher feature ${featureName}:`, error);
            const missingChunk = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading (?:CSS )?chunk [\s\S]* failed|Unable to preload CSS/i.test(error?.message || '');
            const { showSectionLoadError } = await import('./ui/sectionRecovery.js');
            if (!current()) return undefined;
            showSectionLoadError(document.querySelector('.view.active'), {
                label: missingChunk ? 'this teacher tool download' : 'this teacher tool', error, keepContent: true,
                current, retry: () => lazyFeatureMethod.apply(this, args)
            });
            return undefined;
        }
    }

    Object.defineProperty(TeacherManager.prototype, methodName, {
        configurable: true,
        writable: true,
        value: lazyFeatureMethod
    });
}

export function getLoadedTeacherFeatureContext(manager, name) {
    return featureContexts.get(manager)?.get(name);
}

export function disposeTeacherFeatureContext(manager, name) {
    const contexts = featureContexts.get(manager);
    const context = contexts?.get(name);
    if (!context) return;
    try { context.destroy?.(); }
    finally { contexts.delete(name); }
}

function disposeLoadedTeacherFeatures(manager, { preserveAdministration = false } = {}) {
    const managerContexts = featureContexts.get(manager);
    if (!managerContexts) return;

    for (const [featureName, context] of managerContexts) {
        if (preserveAdministration && featureName === 'schoolAdministration') continue;
        if (typeof context.destroy !== 'function') continue;
        try {
            context.destroy();
        } catch (error) {
            console.error(`Could not dispose teacher feature ${featureName}:`, error);
        }
        managerContexts.delete(featureName);
    }
    if (managerContexts.size === 0) featureContexts.delete(manager);
}

export function installTeacherLazyFeatureMethods(TeacherManager) {
    TeacherManager.prototype.deactivateTeacherWorkspace = function (viewId) {
        featureContexts.get(this)?.get('studentProgress')?.deactivate(viewId);
        if (viewId !== VOCABULARY_PAGE.viewId) featureContexts.get(this)?.get('vocabularyBrowser')?.deactivate();
        featureContexts.get(this)?.get('classes')?.deactivate();
        featureContexts.get(this)?.get('schoolAdministration')?.deactivate();
    };
    TeacherManager.prototype.refreshTeacherVocabularyBrowser = function (options) { return featureContexts.get(this)?.get('vocabularyBrowser')?.refreshIfActive(options); };
    TeacherManager.prototype.deactivateTeacherVocabularyBrowser = function () { featureContexts.get(this)?.get('vocabularyBrowser')?.deactivate(); };
    [
        ['loadLibrary', 'vocabularyBrowser'],
        ['showProgressView', 'studentProgress'],
        ['showStudentProfileById', 'studentProgress'],
        ['showSchoolAdministration', 'schoolAdministration'],
        ['showPlatformAdministration', 'schoolAdministration'],
        ['showClassHome', 'classes'],
        ['refreshTeacherClassSelector', 'classes'],
        ['showClassesView', 'classes'],
        ['showClassStudentsView', 'classes'],
        ['showAssignmentsView', 'classes'],
        ['openAssignmentPublisher', 'classes'],
        ['showSparksView', 'sparks'],
        ['showSparkEditor', 'sparks'],
        ['showGroupsView', 'groups'],
        ['showDataManagementView', 'dataManagement'],
        ['showWordHuntReviewView', 'wordHuntReview'],
        ['loadWordHuntReview', 'wordHuntReview'],
        ['showQuizzesView', 'quizzes'],
        ['openQuizMaker', 'quizzes']
    ].forEach(([methodName, featureName]) => installLazyMethod(TeacherManager, methodName, featureName));

    Object.defineProperty(TeacherManager.prototype, 'disposeLoadedTeacherFeatures', {
        configurable: true,
        writable: true,
        value(options) {
            this.invalidateTeacherNavigation?.();
            disposeLoadedTeacherFeatures(this, options);
        }
    });
}

// Keep in-place recovery available when connectivity drops after startup.
void import('./ui/sectionRecovery.js').catch(() => {});
