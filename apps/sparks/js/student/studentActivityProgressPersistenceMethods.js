import { StudentActivityResultProcessor } from './studentActivityResultProcessor.js';
import { clearActivitySyncStates } from './studentActivitySyncRegistry.js';
import { sanitizeActivityState, areActivityStatesEquivalent } from './studentActivityStateValues.js';
import { resolveActivityCoinRewards } from '../gamificationConfig.js';
import { requestWithTimeout } from '../services/requestReliability.js';
import { schoolContext } from '../services/schoolContext.js';

export class StudentActivityProgressPersistence {
    constructor(activities, { loadRuntime = () => import('./studentActiveRuntime.js') } = {}) {
        this.activities = activities;
        this.sm = activities.sm;
        this.resultProcessor = new StudentActivityResultProcessor(activities);
        this.runtime = null;
        this.runtimeGeneration = 0;
        this.runtimeController = new AbortController();
        this.loadRuntime = loadRuntime;
        this.runtimeModulePromise = null;
        this.syncStates = new Map();
        this.debounceMs = 1000;
    }

    get attemptService() { return this.runtime?.attemptService || null; }
    get autoSave() { return this.runtime?.autoSave || null; }
    get stateStore() { return this.runtime?.stateStore || null; }
    get syncCoordinator() { return this.runtime?.syncCoordinator || null; }
    get workTimer() { return this.runtime?.workTimer || null; }
    get activitySyncStates() { return this.syncStates; }
    get activityProgressDebounceMs() { return this.syncCoordinator?.activityProgressDebounceMs ?? this.debounceMs; }
    set activityProgressDebounceMs(value) {
        this.debounceMs = value;
        if (this.syncCoordinator) this.syncCoordinator.activityProgressDebounceMs = value;
    }

    async prepareActiveRuntime(options = {}) {
        const user = this.sm.currentUser, mode = this.sm.authDisabled;
        const cloud = this.sm.progress?.cloud, cloudGeneration = cloud?.cloudGeneration;
        const vocab = this.sm.currentVocab, session = this.activities.session;
        const unitKey = vocab ? this.activities.getUnitProgressKey?.(vocab) : null;
        const activityType = this.sm.currentActivityType;
        const launchId = session.activityLaunchId, school = schoolContext.getGeneration();
        const navigation = this.sm.routing?.arcadeReadController?.signal;
        const route = globalThis.location?.hash;
        const lifecycle = this.runtimeController.signal, generation = this.runtimeGeneration;
        const current = () => !lifecycle.aborted && !options.signal?.aborted && generation === this.runtimeGeneration
            && !navigation?.aborted && navigation === this.sm.routing?.arcadeReadController?.signal
            && route === globalThis.location?.hash
            && user === this.sm.currentUser && mode === this.sm.authDisabled
            && cloud === this.sm.progress?.cloud && cloudGeneration === cloud?.cloudGeneration
            && vocab === this.sm.currentVocab && session === this.activities.session && launchId === session.activityLaunchId
            && activityType === this.sm.currentActivityType
            && unitKey === (this.sm.currentVocab ? this.activities.getUnitProgressKey?.(this.sm.currentVocab) : null)
            && school === schoolContext.getGeneration() && (options.isCurrent?.() ?? true);
        const assertCurrent = () => { if (!current()) throw new DOMException('Activity launch changed.', 'AbortError'); };
        assertCurrent();
        if (this.runtime) return this.runtime;
        const controller = new AbortController(), cancel = () => controller.abort();
        const signals = [...new Set([lifecycle, options.signal, navigation].filter(Boolean))];
        for (const signal of signals) {
            if (signal.aborted) cancel();
            else signal.addEventListener('abort', cancel, { once: true });
        }
        let pendingModule;
        try {
            return await requestWithTimeout(async signal => {
                if (!this.runtimeModulePromise) {
                    const pending = Promise.resolve().then(() => this.loadRuntime()).catch(error => {
                        if (this.runtimeModulePromise === pending) this.runtimeModulePromise = null;
                        throw error;
                    });
                    this.runtimeModulePromise = pending;
                }
                pendingModule = this.runtimeModulePromise;
                const { createStudentActiveRuntime } = await pendingModule;
                signal.throwIfAborted(); assertCurrent();
                if (this.runtime) return this.runtime;
                const runtime = createStudentActiveRuntime(this);
                if (!current() || signal.aborted) { runtime.workTimer.destroy(); assertCurrent(); signal.throwIfAborted(); }
                this.runtime = runtime;
                return runtime;
            }, { signal: controller.signal, timeoutMs: options.timeoutMs || 10000, label: 'Loading activity runtime' });
        } catch (error) {
            if (error.code === 'REQUEST_TIMEOUT' && !this.runtime && this.runtimeModulePromise === pendingModule) this.runtimeModulePromise = null;
            throw error;
        } finally {
            for (const signal of signals) signal.removeEventListener('abort', cancel);
        }
    }

    requireRuntime() {
        if (!this.runtime) throw new Error('Start an activity before saving its work.');
        return this.runtime;
    }

    resetForSession() {
        this.activities.menu?.resetForSession?.();
        this.runtimeGeneration++;
        this.runtimeController.abort();
        this.runtimeController = new AbortController();
        this.runtimeModulePromise = null;
        this.activities.launcher?.cancelActivityLaunch?.();
        if (this.activities.session.cancelActivityLaunch) this.activities.session.cancelActivityLaunch();
        else { this.workTimer?.destroy(); this.activities.session.activityAttempt = null; }
        clearActivitySyncStates(this.syncStates);
        this.runtime = null;
    }

    getActivityCoinRewards(activityType, settings = {}) { return resolveActivityCoinRewards(settings, activityType); }
    async startVerifiedActivityAttempt(activityType, options = {}) { return this.requireRuntime().attemptService.startVerifiedActivityAttempt(activityType, options); }
    async reportActiveTime(snapshot) {
        if (!this.attemptService) return null;
        try { return await this.attemptService.reportActiveTime(snapshot); }
        catch (error) { console.warn('Could not report active activity time:', error); return null; }
    }
    handleAutoSave(scoreData) { return this.requireRuntime().autoSave.handleAutoSave(scoreData); }
    buildActivityProgressPayload(activityType, scoreData = {}, settings = {}) { return this.requireRuntime().attemptService.buildActivityProgressPayload(activityType, scoreData, settings); }
    getActivityAttemptMetrics(activityType, scoreData = {}) { return this.requireRuntime().attemptService.getActivityAttemptMetrics(activityType, scoreData); }
    isActivityAttemptFinished(activityType, scoreData = {}) { return this.requireRuntime().attemptService.isActivityAttemptFinished(activityType, scoreData); }
    async syncActivityProgressToCloud(activityType, scoreData = {}, settings = {}) { return this.requireRuntime().syncCoordinator.syncActivityProgressToCloud(activityType, scoreData, settings); }
    getActivityProgressFingerprint(payload = {}) { return this.requireRuntime().syncCoordinator.getActivityProgressFingerprint(payload); }
    isMeaningfulActivityProgressPayload(payload = {}) { return this.requireRuntime().syncCoordinator.isMeaningfulActivityProgressPayload(payload); }
    scheduleActivityProgressFlush(syncKey, immediate = false) { return this.requireRuntime().syncCoordinator.scheduleActivityProgressFlush(syncKey, immediate); }
    async flushActivityProgressSync(syncKey) { return this.syncCoordinator?.flushActivityProgressSync(syncKey); }
    async flushPendingActivityProgress() { return this.syncCoordinator?.flushPendingActivityProgress(); }
    async submitActivityProgressPayload(payload, options = {}) { return this.requireRuntime().syncCoordinator.submitActivityProgressPayload(payload, options); }
    applyActivityProgressResult(progress, payload = {}, options = {}) { return this.resultProcessor.applyActivityProgressResult(progress, payload, options); }
    getAwardedXp(previousTotalXp, progress = {}) { return this.resultProcessor.getAwardedXp(previousTotalXp, progress); }
    getActivityXpRewardText(xpAwarded) { return this.resultProcessor.getActivityXpRewardText(xpAwarded); }
    showActivityXpReward(xpAwarded, activityType = '') { return this.resultProcessor.showActivityXpReward(xpAwarded, activityType); }
    resetActivityState(activityType) { return this.requireRuntime().stateStore.resetActivityState(activityType); }
    sanitizeActivityState(stateData) { return sanitizeActivityState(stateData); }
    areActivityStatesEquivalent(firstState, secondState) { return areActivityStatesEquivalent(firstState, secondState); }
    handleStateSave(stateData) { return this.requireRuntime().stateStore.handleStateSave(stateData); }
}
