import { ACTIVITY_EXPORTS, ACTIVITY_MODULES } from './studentActivityConstants.js';

export class StudentActivityModuleLoader {
    constructor(activities, moduleLoaders = ACTIVITY_MODULES, exportNames = ACTIVITY_EXPORTS) {
        this.activities = activities;
        this.moduleLoaders = moduleLoaders;
        this.exportNames = exportNames;
        this.activityModulePromises = new Map();
    }

    async loadActivityClass(type) {
        const loadModule = this.moduleLoaders[type];
        const exportName = this.exportNames[type];

        if (!loadModule || !exportName) {
            throw new Error(`Unknown activity type: ${type}`);
        }

        let modulePromise = this.activityModulePromises.get(type);
        if (!modulePromise) {
            modulePromise = Promise.resolve().then(loadModule);
            this.activityModulePromises.set(type, modulePromise);
        }

        let module;
        try {
            module = await modulePromise;
        } catch (error) {
            // A transient network/cache error must not poison every later attempt.
            if (this.activityModulePromises.get(type) === modulePromise) {
                this.activityModulePromises.delete(type);
            }
            throw error;
        }
        const ActivityClass = module[exportName];

        if (!ActivityClass) {
            this.activityModulePromises.delete(type);
            throw new Error(`Activity export ${exportName} was not found.`);
        }

        return ActivityClass;
    }

    clearActivityModule(type) {
        this.activityModulePromises.delete(type);
    }
}
