import { notifications } from './main.js';

const featurePromises = new Map();

const featureDefinitions = {
    sparks: async manager => {
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
