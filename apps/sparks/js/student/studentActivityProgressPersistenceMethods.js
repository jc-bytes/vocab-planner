import { StudentActivityAttemptService } from './studentActivityAttemptService.js';
import { StudentActivityAutoSave } from './studentActivityAutoSave.js';
import { StudentActivityResultProcessor } from './studentActivityResultProcessor.js';
import { StudentActivityStateStore } from './studentActivityStateStore.js';
import { StudentActivitySyncCoordinator } from './studentActivitySyncCoordinator.js';

export class StudentActivityProgressPersistence {
    constructor(activities) {
        this.activities = activities;
        this.sm = activities.sm;
        this.attemptService = new StudentActivityAttemptService(this);
        this.autoSave = new StudentActivityAutoSave(this);
        this.resultProcessor = new StudentActivityResultProcessor(activities);
        this.stateStore = new StudentActivityStateStore(activities);
        this.syncCoordinator = new StudentActivitySyncCoordinator(this);
    }

    get activitySyncStates() {
        return this.syncCoordinator.activitySyncStates;
    }

    get activityProgressDebounceMs() {
        return this.syncCoordinator.activityProgressDebounceMs;
    }

    set activityProgressDebounceMs(value) {
        this.syncCoordinator.activityProgressDebounceMs = value;
    }

    resetForSession() {
        this.syncCoordinator.resetForSession();
        this.activities.session.activityAttempt = null;
    }

    getActivityCoinRewards(activityType, settings = {}) {
        return this.autoSave.getActivityCoinRewards(activityType, settings);
    }

    async startVerifiedActivityAttempt(activityType, options = {}) {
        return this.attemptService.startVerifiedActivityAttempt(activityType, options);
    }

    async reportActiveTime(snapshot = {}) {
        try {
            return await this.attemptService.reportActiveTime(snapshot);
        } catch (error) {
            console.warn('Could not report active activity time:', error);
            return null;
        }
    }

    handleAutoSave(scoreData) {
        return this.autoSave.handleAutoSave(scoreData);
    }

    buildActivityProgressPayload(activityType, scoreData = {}, settings = {}) {
        return this.attemptService.buildActivityProgressPayload(activityType, scoreData, settings);
    }

    getActivityAttemptMetrics(activityType, scoreData = {}) {
        return this.attemptService.getActivityAttemptMetrics(activityType, scoreData);
    }

    isActivityAttemptFinished(activityType, scoreData = {}) {
        return this.attemptService.isActivityAttemptFinished(activityType, scoreData);
    }

    async syncActivityProgressToCloud(activityType, scoreData = {}, settings = {}) {
        return this.syncCoordinator.syncActivityProgressToCloud(activityType, scoreData, settings);
    }

    getActivityProgressFingerprint(payload = {}) {
        return this.syncCoordinator.getActivityProgressFingerprint(payload);
    }

    isMeaningfulActivityProgressPayload(payload = {}) {
        return this.syncCoordinator.isMeaningfulActivityProgressPayload(payload);
    }

    scheduleActivityProgressFlush(syncKey, immediate = false) {
        return this.syncCoordinator.scheduleActivityProgressFlush(syncKey, immediate);
    }

    async flushActivityProgressSync(syncKey) {
        return this.syncCoordinator.flushActivityProgressSync(syncKey);
    }

    async flushPendingActivityProgress() {
        return this.syncCoordinator.flushPendingActivityProgress();
    }

    async submitActivityProgressPayload(payload, options = {}) {
        return this.syncCoordinator.submitActivityProgressPayload(payload, options);
    }

    applyActivityProgressResult(progress, payload = {}) {
        return this.resultProcessor.applyActivityProgressResult(progress, payload);
    }

    getAwardedXp(previousTotalXp, progress = {}) {
        return this.resultProcessor.getAwardedXp(previousTotalXp, progress);
    }

    getActivityXpRewardText(xpAwarded) {
        return this.resultProcessor.getActivityXpRewardText(xpAwarded);
    }

    showActivityXpReward(xpAwarded, activityType = '') {
        return this.resultProcessor.showActivityXpReward(xpAwarded, activityType);
    }

    resetActivityState(activityType) {
        return this.stateStore.resetActivityState(activityType);
    }

    sanitizeActivityState(stateData) {
        return this.stateStore.sanitizeActivityState(stateData);
    }

    areActivityStatesEquivalent(firstState, secondState) {
        return this.stateStore.areActivityStatesEquivalent(firstState, secondState);
    }

    handleStateSave(stateData) {
        return this.stateStore.handleStateSave(stateData);
    }
}
