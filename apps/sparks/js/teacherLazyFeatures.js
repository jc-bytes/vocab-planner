import { schoolSessionKey } from './services/schoolScope.js';
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

function getFeatureContext(manager, featureName, feature) {
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

const featureDefinitions = {
    schoolAdministration: async () => {
        const { createSchoolAdminView } = await import('./schoolAdminView.js');
        return { publicMethods: { showSchoolAdministration: 'show' }, create(manager) {
            const view = createSchoolAdminView({ root: document.getElementById('teacher-administration-view') });
            return { show() { if (!manager.ensureAuthenticated(false)) return;
                manager.switchView('teacher-administration-view', { updateRoute: false });
                return view.show(); }, destroy() { view.destroy(); } };
        } };
    },
    classes: async () => {
        const { createTeacherWorkspaceFeature } = await import('./teacherWorkspaceFeature.js');
        return {
            publicMethods: { showClassesView: 'showClasses', showAssignmentsView: 'showAssignments', openAssignmentPublisher: 'publish' },
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
                    vocabularyBrowser: createQuizVocabularyBrowserAdapter(manager)
                });
            }
        };
    }
};

async function loadTeacherFeature(featureName) {
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
        try {
            navigation = typeof this.captureTeacherNavigation === 'function'
                ? this.captureTeacherNavigation()
                : null;
            const feature = await loadTeacherFeature(featureName);
            if (navigation && !this.isTeacherNavigationCurrent(navigation)) return undefined;
            const context = getFeatureContext(this, featureName, feature);
            const publicMethodName = feature.publicMethods?.[methodName];
            const installedMethod = publicMethodName ? context[publicMethodName] : undefined;
            if (typeof installedMethod !== 'function') {
                throw new Error(`${featureName} did not install ${methodName}.`);
            }
            return installedMethod.apply(context, args);
        } catch (error) {
            if (navigation && !this.isTeacherNavigationCurrent(navigation)) return undefined;
            console.error(`Could not load teacher feature ${featureName}:`, error);
            notifications.error('That teacher tool could not load. Please try again.');
            return undefined;
        }
    }

    Object.defineProperty(TeacherManager.prototype, methodName, {
        configurable: true,
        writable: true,
        value: lazyFeatureMethod
    });
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
    TeacherManager.prototype.deactivateTeacherWorkspace = function () {
        featureContexts.get(this)?.get('classes')?.deactivate();
    };
    [
        ['showSchoolAdministration', 'schoolAdministration'],
        ['showClassesView', 'classes'],
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
