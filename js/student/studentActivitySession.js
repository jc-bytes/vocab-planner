export class StudentActivitySession {
    constructor(activities) {
        this.activities = activities;
        this.currentVocab = null;
        this.activityInstance = null;
        this.currentActivityType = null;
        this.unitScores = {};
        this.unitImages = {};
        this.unitWordHunt = {};
        this.unitStates = {};
        this.activityAttempt = null;
        this.activityLaunchId = 0;
        this.activityLaunchController = null;
        this.vocabularyLoadId = 0;
        this.vocabularyLoadController = null;
        this.pendingVocabularyOverride = null;
    }

    beginActivityLaunch() {
        this.activityLaunchController?.abort();
        this.activityLaunchController = new AbortController();
        this.activityLaunchId += 1;
        this.activityAttempt = null;
        return this.activityLaunchId;
    }

    get activityLaunchSignal() {
        return this.activityLaunchController?.signal || null;
    }

    cancelActivityLaunch() {
        this.activityLaunchController?.abort();
        this.activityLaunchController = null;
        this.activityLaunchId += 1;
        this.activityAttempt = null;
    }

    isActivityLaunchCurrent(launchId) {
        return launchId === this.activityLaunchId;
    }

    beginVocabularyLoad() {
        this.vocabularyLoadController?.abort();
        this.vocabularyLoadController = new AbortController();
        this.vocabularyLoadId += 1;
        this.pendingVocabularyOverride = null;
        return this.vocabularyLoadId;
    }

    isVocabularyLoadCurrent(loadId) {
        return loadId === this.vocabularyLoadId;
    }

    cancelVocabularyLoad() {
        this.vocabularyLoadController?.abort();
        this.vocabularyLoadController = null;
        this.pendingVocabularyOverride = null;
        this.vocabularyLoadId += 1;
    }

    async waitForVocabularyOverride() {
        if (!this.pendingVocabularyOverride) return this.currentVocab;
        try {
            await this.pendingVocabularyOverride;
        } catch {
            // The packaged vocabulary remains a complete fallback.
        }
        return this.currentVocab;
    }

    destroyActivityInstance() {
        const instance = this.activityInstance;
        this.activityInstance = null;
        if (!instance || typeof instance.destroy !== 'function') return;

        try {
            instance.destroy();
        } catch (error) {
            console.warn('Could not fully clean up the previous activity:', error);
        }
    }
}
