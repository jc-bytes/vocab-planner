import { imageDB } from '../db.js';
import { studentApi } from '../services/studentApi.js';
import { classifySyncError } from '../services/syncQueuePolicy.js';
import {
    getActiveStudentStorageOwner,
    isActiveStudentStorageOwner
} from './persistence/studentStorage.js';

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
        this.activitySyncStates = new Map();
        this.activityProgressDebounceMs = 1000;
        this.maxSettledSyncStates = 64;
    }

    resetForSession() {
        for (const state of this.activitySyncStates.values()) {
            if (state.timer) clearTimeout(state.timer);
            state.timer = null;
            state.pending = null;
            state.waiters?.splice(0).forEach(waiter => waiter.resolve(null));
        }
        this.activitySyncStates.clear();
    }

    pruneSettledSyncStates() {
        if (this.activitySyncStates.size <= this.maxSettledSyncStates) return;
        for (const [syncKey, state] of this.activitySyncStates) {
            if (this.activitySyncStates.size <= this.maxSettledSyncStates) break;
            if (!state.timer && !state.pending && !state.inFlight && state.waiters?.length === 0) {
                this.activitySyncStates.delete(syncKey);
            }
        }
    }

    async syncActivityProgressToCloud(activityType, scoreData = {}, settings = {}) {
        if (this.sm.authDisabled || !this.sm.currentUser) return;
        const payload = this.persistence.buildActivityProgressPayload(activityType, scoreData, settings);
        if (!payload) return;

        const ownerUserId = getActiveStudentStorageOwner();
        const syncKey = `${ownerUserId}:${payload.unitKey}:${activityType}`;
        const fingerprint = this.getActivityProgressFingerprint(payload);
        let state = this.activitySyncStates.get(syncKey);
        if (!state) {
            state = {
                timer: null,
                inFlight: null,
                pending: null,
                waiters: [],
                lastSubmittedFingerprint: ''
            };
            this.activitySyncStates.set(syncKey, state);
        }

        if (!this.isMeaningfulActivityProgressPayload(payload)
            || fingerprint === state.lastSubmittedFingerprint
            || fingerprint === state.pending?.fingerprint) {
            return state.inFlight || null;
        }

        const promise = new Promise((resolve, reject) => state.waiters.push({ resolve, reject }));
        state.pending = { payload, fingerprint, ownerUserId };
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
            Boolean(payload.isRequired)
        ]);
    }

    isMeaningfulActivityProgressPayload(payload = {}) {
        if (payload.isComplete || payload.isFinished || Number(payload.score) > 0) return true;
        if (Number(payload.details?.accuracy) > 0) return true;
        return Object.keys(payload.details?.evidence || {}).length > 0;
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
            await state.inFlight;
            return this.flushActivityProgressSync(syncKey);
        }
        if (!state.pending) return null;

        const pending = state.pending;
        const waiters = state.waiters.splice(0);
        state.pending = null;
        state.inFlight = this.persistence.submitActivityProgressPayload(pending.payload, {
            ownerUserId: pending.ownerUserId
        });

        try {
            const result = await state.inFlight;
            state.lastSubmittedFingerprint = pending.fingerprint;
            waiters.forEach(waiter => waiter.resolve(result));
            return result;
        } catch (error) {
            waiters.forEach(waiter => waiter.reject(error));
            throw error;
        } finally {
            state.inFlight = null;
            if (state.pending) {
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
            .filter(([, state]) => state.pending || state.inFlight)
            .map(([syncKey]) => syncKey);
        await Promise.all(keys.map(syncKey => this.flushActivityProgressSync(syncKey)));
    }

    async submitActivityProgressPayload(payload, options = {}) {
        const ownerUserId = options.ownerUserId || getActiveStudentStorageOwner();
        try {
            const previousTotalXp = Number(this.sm.progressData?.totalXp) || 0;
            const progress = await studentApi.submitStudentActivityProgress(payload, { ownerUserId });
            if (!isActiveStudentStorageOwner(ownerUserId)
                || this.sm.currentUser?.uid !== ownerUserId) return null;
            const xpAwarded = this.persistence.getAwardedXp(previousTotalXp, progress);
            this.persistence.applyActivityProgressResult(progress, payload);
            this.sm.setAuthStatus('Synced');
            if (payload.isComplete) {
                this.persistence.showActivityXpReward(xpAwarded, payload.activityType);
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
                    this.sm.setAuthStatus(navigator.onLine ? 'Sync failed - saved locally' : 'Saved locally - offline');
                } catch (queueError) {
                    console.warn('Could not queue activity progress event:', queueError);
                    this.sm.setAuthStatus('Local sync storage is full');
                    this.sm.showToast?.('Reconnect before completing more work so your progress can sync.');
                }
            } else {
                this.sm.setAuthStatus('Activity result rejected');
                this.sm.showToast?.('This activity result was not accepted. Refresh and try again.');
            }
            return null;
        }
    }
}
