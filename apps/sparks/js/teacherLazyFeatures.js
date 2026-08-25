import { notifications, setupModal } from './main.js';
import { initTeacherSettingsListeners } from './teacherSettingsListeners.js';
import { createFeatureContext } from './services/featureContext.js';

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

function captureFeatureMethods(installMethods) {
    class FeatureMethods {}
    installMethods(FeatureMethods);
    return Object.getOwnPropertyDescriptors(FeatureMethods.prototype);
}

function getFeatureContext(manager, featureName, feature) {
    let managerContexts = featureContexts.get(manager);
    if (!managerContexts) {
        managerContexts = new Map();
        featureContexts.set(manager, managerContexts);
    }
    if (managerContexts.has(featureName)) return managerContexts.get(featureName);

    const context = feature.create
        ? feature.create(manager)
        : createFeatureContext(manager, feature.methods);
    managerContexts.set(featureName, context);
    return context;
}

const featureDefinitions = {
    sparks: async () => {
        const module = await import('./teacherSparks.js');
        return {
            methods: captureFeatureMethods(module.installTeacherSparkMethods),
            initialize(manager) {
                setupModal('#spark-modal', {
                    dismissible: true,
                    onClose: () => {
                        manager.editingSparkId = null;
                        manager.sparkModalMode = 'create';
                        manager.setSparkModalStatus?.('');
                    }
                });
                module.initTeacherSparksListeners(manager);
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
            methods: captureFeatureMethods(module.installTeacherDataManagementMethods),
            initialize: initTeacherSettingsListeners
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
        return { methods: captureFeatureMethods(module.installTeacherQuizMethods) };
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
            const installedMethod = publicMethodName
                ? context[publicMethodName]
                : feature.methods?.[methodName]?.value;
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
