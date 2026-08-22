import { notifications, setupModal } from './main.js';
import { initTeacherSettingsListeners } from './teacherSettingsListeners.js';

const featurePromises = new Map();

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

const featureDefinitions = {
    sparks: async manager => {
        setupModal('#spark-modal', {
            dismissible: true,
            onClose: () => {
                manager.editingSparkId = null;
                manager.sparkModalMode = 'create';
                manager.setSparkModalStatus?.('');
            }
        });
        const module = await import('./teacherSparks.js');
        module.installTeacherSparkMethods(manager.constructor);
        if (!manager.sparkListenersInitialized) {
            manager.sparkListenersInitialized = true;
            module.initTeacherSparksListeners(manager);
        }
    },
    groups: async manager => {
        const module = await import('./teacherGroups.js');
        module.installTeacherGroupsMethods(manager.constructor);
    },
    dataManagement: async manager => {
        const module = await import('./teacherDataManagement.js');
        module.installTeacherDataManagementMethods(manager.constructor);
        if (!manager.dataManagementSettingsListenersInitialized) {
            manager.dataManagementSettingsListenersInitialized = true;
            initTeacherSettingsListeners(manager);
        }
    },
    wordHuntReview: async manager => {
        const module = await import('./teacherWordHuntReview.js');
        module.installTeacherWordHuntReviewMethods(manager.constructor);
    },
    quizzes: async manager => {
        const module = await import('./teacherQuiz.js');
        module.installTeacherQuizMethods(manager.constructor);
    }
};

async function ensureTeacherFeature(manager, featureName) {
    if (!featurePromises.has(featureName)) {
        const loader = featureDefinitions[featureName];
        mountTeacherFeatureTemplates(featureName);
        featurePromises.set(featureName, loader(manager).catch(error => {
            featurePromises.delete(featureName);
            throw error;
        }));
    }
    await featurePromises.get(featureName);
}

function installLazyMethod(TeacherManager, methodName, featureName) {
    async function lazyFeatureMethod(...args) {
        try {
            await ensureTeacherFeature(this, featureName);
            const installedMethod = this[methodName];
            if (installedMethod === lazyFeatureMethod) {
                throw new Error(`${featureName} did not install ${methodName}.`);
            }
            return installedMethod.apply(this, args);
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

export function installTeacherLazyFeatureMethods(TeacherManager) {
    [
        ['showSparksView', 'sparks'],
        ['showGroupsView', 'groups'],
        ['showDataManagementView', 'dataManagement'],
        ['showWordHuntReviewView', 'wordHuntReview'],
        ['loadWordHuntReview', 'wordHuntReview'],
        ['showQuizzesView', 'quizzes'],
        ['openQuizMaker', 'quizzes'],
        ['handleGenerateQuiz', 'quizzes'],
        ['printQuiz', 'quizzes']
    ].forEach(([methodName, featureName]) => installLazyMethod(TeacherManager, methodName, featureName));
}
