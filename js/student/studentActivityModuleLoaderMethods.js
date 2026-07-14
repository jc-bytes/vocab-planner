import { ACTIVITY_EXPORTS, ACTIVITY_MODULES } from './studentActivityConstants.js';

export class StudentActivityModuleLoader {
    constructor(activities) {
        this.activities = activities;
        this.activityModulePromises = new Map();
    }

    async loadActivityClass(type) {
        const loadModule = ACTIVITY_MODULES[type];
        const exportName = ACTIVITY_EXPORTS[type];

        if (!loadModule || !exportName) {
            throw new Error(`Unknown activity type: ${type}`);
        }

        if (!this.activityModulePromises.has(type)) {
            this.activityModulePromises.set(type, loadModule());
        }

        const module = await this.activityModulePromises.get(type);
        const ActivityClass = module[exportName];

        if (!ActivityClass) {
            this.activityModulePromises.delete(type);
            throw new Error(`Activity export ${exportName} was not found.`);
        }

        return ActivityClass;
    }
}
