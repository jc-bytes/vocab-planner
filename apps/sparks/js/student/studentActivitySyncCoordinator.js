import { imageDB } from '../db.js';
import { studentApi } from '../services/studentApi.js';
import { classifySyncError } from '../services/syncQueuePolicy.js';
import {
    getActiveStudentStorageOwner,
    isActiveStudentStorageOwner
} from './persistence/studentStorage.js';
import { ARCADE_MINUTE_SECONDS } from './studentArcadePolicy.js';
import { requireActivityProgressResult } from './studentActivityProgressResult.js';
import { clearActivitySyncStates } from './studentActivitySyncRegistry.js';

function getSyncErrorSummary(error) {
    const parts = [error?.code, error?.message, error?.details, error?.hint]
        .map(value => String(value || '').trim())
        .filter(Boolean);
    return parts.join(' | ') || String(error || 'Unknown sync error');
}

export class StudentActivitySyncCoordinator {
    constructor(persistence) {
        this.persistence = persistence;
        this.activities = persistence.activities;
        this.sm = persistence.sm;
        this.activitySyncStates = persistence.activitySyncStates || new Map();
        this.activityProgressDebounceMs = persistence.activityProgressDebounceMs ?? 1000;
        this.maxSettledSyncStates = 64;
    }

    resetForSession() {
        clearActivitySyncStates(this.activitySyncStates);
    }

    pruneSettledSyncStates(limit = this.maxSettledSyncStates) {
        if (this.activitySyncStates.size <= limit) return;
        for (const [syncKey, state] of this.activitySyncStates) {
            if (this.activitySyncStates.size <= limit) break;
            if (!state.timer && !state.pending && !state.unsaved && !state.inFlight && state.waiters?.length === 0) {
                this.activitySyncStates.delete(syncKey);
            }
        }
    }

    async syncActivityProgressToCloud(activityType, scoreData = {}, settings = {}) {
        if (this.sm.authDisabled || !this.sm.currentUser) return;
        const payload = this.persistence.buildActivityProgressPayload(activityType, scoreData, settings);
        if (!payload) return;
        payload.notifyArcadeRefresh = Boolean(settings.notifyArcadeRefresh);

        const ownerUserId = getActiveStudentStorageOwner();
        const syncKey = `${ownerUserId}:${payload.unitKey}:${activityType}`;
        const fingerprint = this.getActivityProgressFingerprint(payload);
        let state = this.activitySyncStates.get(syncKey);
        if (!state) {
            this.pruneSettledSyncStates(this.maxSettledSyncStates - 1);
            if (this.activitySyncStates.size >= this.maxSettledSyncStates) {
                this.showUnsavedProgress(ownerUserId);
                return null;
            }
            state = {
                timer: null,
                inFlight: null,
                pending: null,
                unsaved: null,
                waiters: [],
                lastSubmittedFingerprint: ''
            };
            this.activitySyncStates.set(syncKey, state);
        }

        if (state.unsaved) {
            if (this.isMeaningfulActivityProgressPayload(payload)
                && fingerprint !== state.unsaved.fingerprint
                && fingerprint !== state.pending?.fingerprint
                && fingerprint !== state.lastSubmittedFingerprint) {
                state.pending = { payload: JSON.parse(JSON.stringify(payload)), fingerprint, ownerUserId };
            }
            await this.flushActivityProgressSync(syncKey);
            if (state.unsaved || this.activitySyncStates.get(syncKey) !== state
                || !isActiveStudentStorageOwner(ownerUserId)
                || this.sm.currentUser?.uid !== ownerUserId) return null;
        }

        if (!this.isMeaningfulActivityProgressPayload(payload)
            || fingerprint === state.lastSubmittedFingerprint
            || fingerprint === state.inFlightFingerprint
            || fingerprint === state.pending?.fingerprint) {
            return state.inFlight || null;
        }

        this.sm.setAuthStatus?.('Saving...');
        const promise = new Promise((resolve, reject) => state.waiters.push({ resolve, reject }));
        state.pending = { payload: JSON.parse(JSON.stringify(payload)), fingerprint, ownerUserId };
        this.scheduleActivityProgressFlush(syncKey, Boolean(payload.isFinished || payload.isComplete));
        return promise;
    }

    getActivityProgressFingerprint(payload = {}) {
        return JSON.stringify([
            payload.unitKey || '',
            payload.activityType || '',
            Number(payload.score) || 0,
            Boolean(payload.isComplete),
            Boolean(payload.isFinished),
            payload.details || {},
            payload.metrics || {},
            payload.stateSnapshot || null,
            payload.activitySettings || {},
            payload.attemptId || '',
            Number(payload.activeSeconds) || 0,
            Number(payload.timeLimitSeconds) || 0,
            Boolean(payload.isRequired),
            Boolean(payload.notifyArcadeRefresh)
        ]);
    }

    isMeaningfulActivityProgressPayload(payload = {}) {
        if (payload.isComplete || payload.isFinished || Number(payload.score) > 0) return true;
        if (Number(payload.details?.accuracy) > 0) return true;
        const contextOnlyEvidence = new Set(['totalCount', 'targetRounds', 'accuracy']);
        return Object.entries(payload.details?.evidence || {}).some(([key, value]) => {
            if (contextOnlyEvidence.has(key)) return false;
            if (typeof value === 'number') return Number.isFinite(value) && value > 0;
            if (typeof value === 'boolean') return value;
            if (Array.isArray(value)) return value.length > 0;
            if (value && typeof value === 'object') return Object.keys(value).length > 0;
            return typeof value === 'string' && value.trim() !== '';
        });
    }

    scheduleActivityProgressFlush(syncKey, immediate = false) {
        const state = this.activitySyncStates.get(syncKey);
        if (!state) return;
        if (state.timer) {
            clearTimeout(state.timer);
            state.timer = null;
        }
        if (immediate) {
            void this.flushActivityProgressSync(syncKey);
            return;
        }
        state.timer = setTimeout(() => {
            state.timer = null;
            void this.flushActivityProgressSync(syncKey);
        }, this.activityProgressDebounceMs);
    }

    async flushActivityProgressSync(syncKey) {
        const state = this.activitySyncStates.get(syncKey);
        if (!state) return null;
        if (state.timer) {
            clearTimeout(state.timer);
            state.timer = null;
        }
        if (state.inFlight) {
            const result = await state.inFlight;
            if (state.unsaved || this.activitySyncStates.get(syncKey) !== state) return result;
            return this.flushActivityProgressSync(syncKey);
        }
        if (!state.pending && !state.unsaved) return null;

        // Publish the handled operation before invoking the adapter, which can
        // throw synchronously. Every duplicate/flush caller joins this promise.
        let complete;
        const operation = new Promise(resolve => { complete = resolve; });
        state.inFlight = operation;
        void this.runActivityProgressSync(syncKey, state).then(complete, error => {
            console.warn('Could not finish activity persistence cleanup:', error);
            complete(null);
        });
        const result = await operation;
        if (this.activitySyncStates.get(syncKey) === state && !state.unsaved && (state.pending || state.inFlight)) {
            return this.flushActivityProgressSync(syncKey);
        }
        return result;
    }

    async runActivityProgressSync(syncKey, state) {
        const pending = state.unsaved || state.pending;
        const waiters = state.waiters.splice(0);
        if (state.unsaved) state.unsaved = null;
        else state.pending = null;
        let outcome;
        state.inFlightFingerprint = pending.fingerprint;
        try {
            const result = await this.persistence.submitActivityProgressPayload(JSON.parse(JSON.stringify(pending.payload)), {
                ownerUserId: pending.ownerUserId,
                onPersistenceOutcome: value => { outcome = value; }
            });
            if (outcome === 'acknowledged' || outcome === 'queued' || (outcome === undefined && result != null)) {
                state.lastSubmittedFingerprint = pending.fingerprint;
            } else if (outcome === 'unsaved' && this.activitySyncStates.get(syncKey) === state) {
                state.unsaved = pending;
                state.waiters.splice(0).forEach(waiter => waiter.resolve(null));
            }
            waiters.forEach(waiter => waiter.resolve(result));
            return result;
        } catch (error) {
            if (this.activitySyncStates.get(syncKey) === state) {
                if (outcome === 'acknowledged' || outcome === 'queued') {
                    state.lastSubmittedFingerprint = pending.fingerprint;
                } else if (isActiveStudentStorageOwner(pending.ownerUserId)
                    && this.sm.currentUser?.uid === pending.ownerUserId) {
                    state.unsaved = pending;
                    this.showUnsavedProgress(pending.ownerUserId);
                }
                state.waiters.splice(0).forEach(waiter => waiter.resolve(null));
            }
            console.warn('Could not finish activity persistence:', error);
            waiters.forEach(waiter => waiter.resolve(null));
            return null;
        } finally {
            state.inFlight = null;
            state.inFlightFingerprint = null;
            if (this.activitySyncStates.get(syncKey) !== state) {
                // Session teardown owns the discarded lane; late results cannot restore it.
            } else if (state.pending && !state.unsaved) {
                this.scheduleActivityProgressFlush(
                    syncKey,
                    Boolean(state.pending.payload.isFinished || state.pending.payload.isComplete)
                );
            } else {
                this.activitySyncStates.delete(syncKey);
                this.activitySyncStates.set(syncKey, state);
                this.pruneSettledSyncStates();
            }
        }
    }

    async flushPendingActivityProgress() {
        const keys = [...this.activitySyncStates.entries()]
            .filter(([, state]) => state.pending || state.unsaved || state.inFlight)
            .map(([syncKey]) => syncKey);
        await Promise.all(keys.map(syncKey => this.flushActivityProgressSync(syncKey)));
    }

    async submitActivityProgressPayload(payload, options = {}) {
        const queueGeneration = this.sm.progress?.syncQueue?.cloud?.cloudGeneration;
        const ownerUserId = options.ownerUserId || getActiveStudentStorageOwner();
        const session = this.activities.session;
        const timer = session.workTimer;
        const isCurrentAttempt = () => isActiveStudentStorageOwner(ownerUserId)
            && this.sm.currentUser?.uid === ownerUserId
            && this.activities.session === session
            && this.sm.currentActivityType === payload.activityType
            && this.activities.getUnitProgressKey(this.sm.currentVocab) === payload.unitKey
            && session.activityAttempt?.attemptId === payload.attemptId;
        let durable = false;
        const reportOutcome = outcome => {
            if (durable) return;
            durable = outcome === 'acknowledged' || outcome === 'queued';
            try {
                const observed = options.onPersistenceOutcome?.(outcome);
                observed?.catch?.(() => console.warn('Could not observe activity persistence status.'));
            }
            catch { console.warn('Could not observe activity persistence status.'); }
        };
        try {
            const previousTotalXp = Number(this.sm.progressData?.totalXp) || 0;
            if (Number(payload.timeLimitSeconds) > 0) {
                await this.persistence.reportActiveTime({
                    attemptId: payload.attemptId,
                    activeSeconds: payload.activeSeconds,
                    timeLimitSeconds: payload.timeLimitSeconds
                });
            }
            let progress;
            try {
                progress = await studentApi.submitStudentActivityProgress(payload, { ownerUserId });
            } catch (error) {
                const isMinimumTimeRejection = payload.isComplete
                    && error?.code === 'P0001'
                    && error?.message === 'The activity was completed too quickly to verify.';
                if (!isMinimumTimeRejection) throw error;
                const attempt = this.activities.session.activityAttempt;
                const minimum = attempt?.attemptId === payload.attemptId
                    ? Number(attempt.minimumSeconds) : 60;
                const delayMs = Math.max(5, Math.min(60, minimum || 60)) * 1000 + 250;
                if (!isActiveStudentStorageOwner(ownerUserId)
                    || this.sm.currentUser?.uid !== ownerUserId) return null;
                await imageDB.enqueueSyncAction('student-activity-progress', {
                    ...payload, retryNotBefore: Date.now() + delayMs
                }, { ownerUserId });
                reportOutcome('queued');
                this.sm.setAuthStatus('Saved locally - checking in background');
                this.sm.progress.syncQueue?.scheduleRetry({ ownerUserId, generation: queueGeneration }, delayMs);
                return null;
            }
            requireActivityProgressResult(progress);
            reportOutcome('acknowledged');
            if (!isActiveStudentStorageOwner(ownerUserId)
                || this.sm.currentUser?.uid !== ownerUserId) return null;
            const xpAwarded = this.persistence.getAwardedXp(previousTotalXp, progress);
            this.persistence.applyActivityProgressResult(progress, payload);
            this.sm.setAuthStatus('Synced');
            if (payload.isComplete && isCurrentAttempt()) {
                this.persistence.showActivityXpReward(xpAwarded, payload.activityType);
            }
            await this.showArcadeRefreshFeedback(progress, payload, ownerUserId);
            if (payload.isFinished && isCurrentAttempt() && session.workTimer === timer
                && timer?.attemptId === payload.attemptId) {
                session.finishActivityTimer?.();
            }
            return progress;
        } catch (error) {
            if (!isActiveStudentStorageOwner(ownerUserId)
                || this.sm.currentUser?.uid !== ownerUserId) return null;
            console.warn(`Could not sync activity progress event: ${getSyncErrorSummary(error)}`);
            const failure = classifySyncError(error, { online: navigator.onLine });
            if (failure.retryable) {
                try {
                    await imageDB.enqueueSyncAction('student-activity-progress', payload, { ownerUserId });
                    reportOutcome('queued');
                    this.sm.progress.syncQueue?.scheduleRetry({ ownerUserId, generation: queueGeneration });
                    this.sm.setAuthStatus(navigator.onLine ? 'Sync failed - saved locally' : 'Saved locally - offline');
                } catch (queueError) {
                    console.warn('Could not queue activity progress event:', queueError);
                    reportOutcome('unsaved');
                    this.showUnsavedProgress(ownerUserId);
                }
            } else {
                this.sm.setAuthStatus('Activity result rejected');
                this.sm.showToast?.('This activity result was not accepted. Refresh and try again.');
            }
            return null;
        }
    }

    showUnsavedProgress(ownerUserId) {
        const message = 'Progress is not synced. Keep this page open.';
        const queue = this.sm.progress?.syncQueue;
        try {
            if (queue) queue.setQueueStatus(message, ownerUserId, queue.cloud?.cloudGeneration);
            else this.sm.setAuthStatus(message);
        } catch { console.warn('Could not display activity sync status.'); }
        try { this.sm.showToast?.(message); }
        catch { console.warn('Could not display activity sync reminder.'); }
    }

    async showArcadeRefreshFeedback(progress, payload, ownerUserId) {
        if (!payload.notifyArcadeRefresh
            || payload.activityType === 'flashcards'
            || !progress?.activity?.isComplete
            || !progress.activity.verified) return null;

        try {
            const wallet = await studentApi.getOwnArcadeTime();
            if (!isActiveStudentStorageOwner(ownerUserId)
                || this.sm.currentUser?.uid !== ownerUserId) return null;

            const availableSeconds = Math.max(0, Number(wallet?.availableSeconds) || 0);
            if (availableSeconds < ARCADE_MINUTE_SECONDS) {
                this.sm.showToast?.('Activity saved, but Arcade time was not added.');
                return wallet;
            }

            const availableMinutes = Math.floor(availableSeconds / ARCADE_MINUTE_SECONDS);
            const minuteLabel = availableMinutes === 1 ? 'minute' : 'minutes';
            const hasRemainingWork = this.activities.getPendingRequiredWork?.().isBlocked;
            const remainingWorkMessage = hasRemainingWork
                ? ' Finish remaining required work to unlock Arcade.'
                : '';
            this.sm.showToast?.(
                `Arcade ready: ${availableMinutes} ${minuteLabel} available.${remainingWorkMessage}`
            );
            return wallet;
        } catch (error) {
            console.warn('Could not refresh Arcade time after activity completion:', error);
            return null;
        }
    }
}
