import { closeModal, notifications, openModal, setupModal } from './main.js';
import { supabaseService } from './supabaseService.js';
import { createQuizVocabularyBrowserAdapter } from './teacherQuizVocabularyBrowserAdapter.js';

const featurePromises = new Map();
const initializedFeatures = new WeakMap();
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
    sparks: async () => {
        const module = await import('./teacherSparks.js');
        return {
            publicMethods: { showSparksView: 'show' },
            create(manager) {
                return module.createTeacherSparksFeature({
                    ensureAuthenticated: (...args) => manager.ensureAuthenticated(...args),
                    showView: () => manager.switchView('teacher-sparks-view'),
                    isAuthenticationDisabled: () => manager.authDisabled,
                    getCurrentUser: () => manager.currentUser,
                    refreshIcons: root => manager.refreshIcons(root),
                    feedback: notifications,
                    setupDialog: setupModal,
                    openDialog: openModal,
                    closeDialog: closeModal
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
                    showView: () => manager.switchView('teacher-groups-view'),
                    loadRoster: () => manager.getStudentRosterData(),
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
                        manager.switchView('teacher-data-management-view', { updateRoute: false });
                        manager.setActiveTeacherTab(area);
                    },
                    writeDataRoute(area, tab, options = {}) {
                        manager.setRoute({ view: area, tab }, options);
                    },
                    isRouteApplying: () => manager.isApplyingRoute,
                    isDataRouteCurrent(area, tab) {
                        const route = manager.parseRoute();
                        const routeTab = route?.tab || (area === 'data' ? 'dashboard' : 'subjects');
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
                        manager.switchView('teacher-dashboard-view');
                        manager.setVocabularyWorkflowTab('review', {
                            loadReview: false,
                            updateRoute,
                            replace
                        });
                    },
                    isReviewActive: () => manager.vocabularyMode === 'review',
                    isAuthenticationDisabled: () => manager.authDisabled,
                    getSubjects: () => manager.getSubjects(),
                    refreshIcons: () => manager.refreshIcons(),
                    feedback: notifications
                });
            }
        };
    },
    quizzes: async () => {
        const module = await import('./teacherQuiz.js');
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
                        manager.switchView('teacher-dashboard-view', { updateRoute: false });
                        manager.setVocabularyWorkflowTab('quizzes', {
                            updateRoute: false,
                            loadQuizzes: false
                        });
                    },
                    showQuizEditor: () => manager.switchView('quiz-maker-view'),
                    showVocabularyEditor: () => manager.showEditor(),
                    writeQuizRoute(drilldown, options = {}) {
                        manager.setRoute({
                            view: 'vocabulary',
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
                        return `${key}:${ownerId || 'development-teacher'}`;
                    },
                    vocabularyBrowser: createQuizVocabularyBrowserAdapter(manager)
                });
            }
        };
    }
};

async function ensureTeacherFeature(manager, featureName) {
    if (!featurePromises.has(featureName)) {
        const loader = featureDefinitions[featureName];
        mountTeacherFeatureTemplates(featureName);
        featurePromises.set(featureName, loader().catch(error => {
            featurePromises.delete(featureName);
            throw error;
        }));
    }
    const feature = await featurePromises.get(featureName);
    const context = getFeatureContext(manager, featureName, feature);
    let initialized = initializedFeatures.get(manager);
    if (!initialized) {
        initialized = new Set();
        initializedFeatures.set(manager, initialized);
    }
    if (!initialized.has(featureName)) {
        feature.initialize?.(context);
        initialized.add(featureName);
    }
    return { feature, context };
}

function installLazyMethod(TeacherManager, methodName, featureName) {
    async function lazyFeatureMethod(...args) {
        try {
            const { feature, context } = await ensureTeacherFeature(this, featureName);
            const publicMethodName = feature.publicMethods?.[methodName];
            const installedMethod = publicMethodName ? context[publicMethodName] : undefined;
            if (typeof installedMethod !== 'function') {
                throw new Error(`${featureName} did not install ${methodName}.`);
            }
            return installedMethod.apply(context, args);
        } catch (error) {
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

function disposeLoadedTeacherFeatures(manager) {
    const managerContexts = featureContexts.get(manager);
    if (!managerContexts) return;
    const initialized = initializedFeatures.get(manager);

    for (const [featureName, context] of managerContexts) {
        if (typeof context.destroy !== 'function') continue;
        try {
            context.destroy();
        } catch (error) {
            console.error(`Could not dispose teacher feature ${featureName}:`, error);
        }
        managerContexts.delete(featureName);
        initialized?.delete(featureName);
    }
    if (managerContexts.size === 0) featureContexts.delete(manager);
    if (initialized?.size === 0) initializedFeatures.delete(manager);
}

export function installTeacherLazyFeatureMethods(TeacherManager) {
    [
        ['showSparksView', 'sparks'],
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
        value() {
            disposeLoadedTeacherFeatures(this);
        }
    });
}
