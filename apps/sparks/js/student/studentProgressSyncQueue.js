import { notifications } from '../notifications.js';
import { imageDB } from '../db.js';
import { studentApi } from '../services/studentApi.js';
import { mapSparkResponseRow } from '../services/sparkResponsesRepository.js';
import { classifySyncError } from '../services/syncQueuePolicy.js';
import { getActiveStudentStorageOwner } from './persistence/studentStorage.js';
import { createUniqueId } from '../randomUtils.js';

export class StudentProgressSyncQueue {
    constructor(cloud) {
        this.cloud = cloud;
        this.progress = cloud.progress;
        this.sm = cloud.sm;
        this.scheduler = {
            now: () => Date.now(),
            setTimeout: (callback, delay) => setTimeout(callback, delay),
            clearTimeout: timer => clearTimeout(timer)
        };
        this.retryTimer = null;
        this.latestUnitSnapshots = new Map();
        this.snapshotClock = 0;
        this.unitWriteLanes = new Map();
    }

    getAuthStatus(fallback = 'Synced') {
        const state = this.queueStatus;
        return state && state.ownerUserId === this.sm.currentUser?.uid
            && state.generation === this.cloud.cloudGeneration ? state.message : fallback;
    }

    setQueueStatus(message, ownerUserId, generation) {
        this.queueStatus = message ? { message, ownerUserId, generation } : null;
        this.sm.setAuthStatus(message || 'Synced');
    }

    cancelRetry() {
        if (this.retryTimer !== null) this.scheduler.clearTimeout(this.retryTimer);
        this.retryTimer = null;
    }

    scheduleRetry(options = {}, delay = 1000) {
        const ownerUserId = options.ownerUserId || this.sm.currentUser?.uid;
        const generation = options.generation ?? this.cloud.cloudGeneration;
        if (this.sm.authDisabled || !navigator.onLine
            || !this.cloud.isCurrentOwner(ownerUserId, options)
            || generation !== this.cloud.cloudGeneration) return;
        this.cancelRetry();
        this.retryTimer = this.scheduler.setTimeout(() => {
            this.retryTimer = null;
            if (!this.cloud.isCurrentOwner(ownerUserId, options)
                || generation !== this.cloud.cloudGeneration) return;
            void this.cloud.flushLocalSyncQueue({ silent: true, ownerUserId, generation }).catch(error => {
                if (!this.cloud.isCurrentOwner(ownerUserId, options)
                    || generation !== this.cloud.cloudGeneration) return;
                this.setQueueStatus('Local sync needs attention', ownerUserId, generation);
                console.warn('Could not retry saved local changes:', error);
            });
        }, Math.max(1000, Math.min(2147483647, delay)));
        this.retryTimer?.unref?.();
    }

    resetUnitSnapshots() {
        this.latestUnitSnapshots.clear();
        this.snapshotClock = 0;
    }

    isLatestUnitSnapshot(payload = {}) {
        const latest = this.latestUnitSnapshots.get(payload.unitKey);
        return latest === undefined || (Number(payload.snapshotOrder) || 0) >= latest;
    }

    buildUnitWorkSyncPayload() {
        if (!this.sm.currentVocab || !this.sm.activities?.getUnitProgressKey) return null;
        const unitKey = this.sm.activities.getUnitProgressKey(this.sm.currentVocab);
        const unitProgress = this.sm.progressData.units?.[unitKey];
        if (!unitKey || !unitProgress) return null;

        const {
            scores: _scores,
            coins: _coins,
            coinData: _coinData,
            coinHistory: _coinHistory,
            ...workPatch
        } = unitProgress;

        const snapshotOrder = this.snapshotClock = Math.max(Date.now(), this.snapshotClock + 1);
        this.latestUnitSnapshots.set(unitKey, snapshotOrder);
        // Match the RPC JSON transport, including legacy timestamp objects with methods.
        return JSON.parse(JSON.stringify({
            eventId: createUniqueId('unit-work:'),
            snapshotOrder,
            unitKey,
            unitContext: {
                unitId: unitProgress.unitId || this.sm.getVocabRouteId?.(this.sm.currentVocab) || this.sm.currentVocab.id || '',
                unitName: unitProgress.unitName || this.sm.currentVocab.name || '',
                subjectSlug: unitProgress.subjectSlug || '',
                trimester: unitProgress.trimester || '',
                schoolYear: unitProgress.schoolYear || '',
                grade: unitProgress.grade || this.sm.studentProfile?.grade || ''
            },
            workPatch
        }));
    }

    executeUnitWork(payload, options = {}) {
        const ownerUserId = options.ownerUserId || this.sm.currentUser?.uid;
        const generation = options.generation ?? this.cloud.cloudGeneration;
        // Keep the lane across generation changes: a prior same-owner RPC may still commit.
        const key = `${ownerUserId}:${payload.unitKey}`;
        const previous = this.unitWriteLanes.get(key);
        const run = async () => {
            if (!this.cloud.isCurrentOwner(ownerUserId, options)
                || generation !== this.cloud.cloudGeneration
                || !this.isLatestUnitSnapshot(payload)) return { skipped: true };
            const progress = await studentApi.syncStudentUnitWork(payload, { ...options, ownerUserId });
            if (!this.cloud.isCurrentOwner(ownerUserId, options)
                || generation !== this.cloud.cloudGeneration) return { skipped: true };
            await imageDB.retireUnitSyncActions(payload, { ownerUserId });
            return { progress };
        };
        const request = previous ? previous.catch(() => {}).then(run) : run();
        const tail = request.finally(() => {
            if (this.unitWriteLanes.get(key) === tail) this.unitWriteLanes.delete(key);
        });
        this.unitWriteLanes.set(key, tail);
        return tail;
    }

    async enqueueProgressSync(options = {}) {
        const ownerUserId = options.ownerUserId || this.sm.currentUser?.uid || getActiveStudentStorageOwner();
        const generation = options.generation ?? this.cloud.cloudGeneration;
        const payload = Object.prototype.hasOwnProperty.call(options, 'payload')
            ? options.payload : this.buildUnitWorkSyncPayload();
        if (!payload) return null;
        if (!this.isLatestUnitSnapshot(payload)) return { skipped: true };
        const queued = await imageDB.enqueueSyncAction('student-unit-work', payload, { ownerUserId });
        this.scheduleRetry({ ownerUserId, generation });
        return queued;
    }

    async flushLocalSyncQueue(options = {}, syncRecord = this.syncQueuedRecord.bind(this)) {
        const owner = options.ownerUserId || this.sm.currentUser?.uid;
        const generation = options.generation ?? this.cloud.cloudGeneration;
        const key = `${owner}:${generation}`;
        this.activeFlushes ||= new Map();
        if (this.activeFlushes.has(key)) return this.activeFlushes.get(key);
        const flush = this.runLocalSyncQueue(options, syncRecord).finally(() => {
            if (this.activeFlushes.get(key) === flush) this.activeFlushes.delete(key);
        });
        this.activeFlushes.set(key, flush);
        return flush;
    }

    async runLocalSyncQueue(options, syncRecord) {
        if (this.sm.authDisabled || !this.sm.currentUser || !navigator.onLine) return;
        const ownerUserId = options.ownerUserId || this.sm.currentUser.uid;
        const generation = options.generation ?? this.cloud.cloudGeneration;
        if (!this.cloud.isCurrentOwner(ownerUserId, options)
            || generation !== this.cloud.cloudGeneration) return;

        this.cancelRetry();
        let pending = [];
        try {
            pending = await imageDB.getPendingSyncActions({ ownerUserId, includeDeferred: true });
        } catch (error) {
            if (!options.silent) console.warn('Could not read local sync queue:', error);
            return;
        }

        if (pending.length > 0) this.sm.setAuthStatus('Syncing local changes...');

        let retryableFailures = 0;
        let terminalFailures = 0;
        let deferred = 0;

        for (const record of pending) {
            if (!this.cloud.isCurrentOwner(ownerUserId, options)
                || generation !== this.cloud.cloudGeneration) return;
            if (Math.max(Date.parse(record.nextAttemptAt) || 0,
                Number(record.payload?.retryNotBefore) || 0) > this.scheduler.now()) {
                deferred += 1;
                continue;
            }
            try {
                await syncRecord(record, { ...options, ownerUserId, generation });
                if (!this.cloud.isCurrentOwner(ownerUserId, options)
                    || generation !== this.cloud.cloudGeneration) return;
                await imageDB.completeSyncAction(record.id, { ownerUserId, expectedRevision: record.revision || 0 });
            } catch (error) {
                if (!this.cloud.isCurrentOwner(ownerUserId, options)
                    || generation !== this.cloud.cloudGeneration) return;
                const failure = classifySyncError(error, { online: navigator.onLine });
                const updated = await imageDB.markSyncActionFailed(record, error, {
                    ownerUserId,
                    terminal: !failure.retryable,
                    reason: failure.reason
                });
                if (updated.skipped) continue;
                if (updated.status === 'failed') terminalFailures += 1;
                else retryableFailures += 1;
                if (!options.silent) console.warn('Could not sync queued local change:', error);
            }
        }

        if (!this.cloud.isCurrentOwner(ownerUserId, options)
            || generation !== this.cloud.cloudGeneration) return;
        let remaining = [];
        let failed = [];
        try {
            remaining = await imageDB.getPendingSyncActions({ ownerUserId, includeDeferred: true });
            failed = await imageDB.getFailedSyncActions({ ownerUserId });
        } catch (error) {
            if (!options.silent) console.warn('Could not inspect remaining local changes:', error);
            this.setQueueStatus(terminalFailures > 0 ? 'Some local changes need attention' : 'Local sync needs attention', ownerUserId, generation);
            return;
        }
        if (!this.cloud.isCurrentOwner(ownerUserId, options)
            || generation !== this.cloud.cloudGeneration) return;
        if (remaining.length > 0) {
            const next = Math.min(...remaining.map(record => Math.max(
                Date.parse(record.nextAttemptAt) || 0,
                Number(record.payload?.retryNotBefore) || 0
            )));
            this.scheduleRetry({ ownerUserId, generation }, next - this.scheduler.now());
        }
        if (terminalFailures > 0 || failed.length > 0) {
            this.setQueueStatus('Some local changes need attention', ownerUserId, generation);
            if (!options.silent) {
                notifications.warning('Some saved changes were rejected, but other work continued syncing.');
            }
        } else if (deferred > 0 || remaining.length > 0) {
            this.setQueueStatus('Saved locally - checking in background', ownerUserId, generation);
        } else if (retryableFailures > 0) {
            this.setQueueStatus('Sync paused - saved locally', ownerUserId, generation);
        } else {
            this.setQueueStatus(null, ownerUserId, generation);
        }
    }

    async syncQueuedRecord(record, options = {}) {
        const ownerUserId = options.ownerUserId || record.ownerUserId;
        const isCurrent = () => this.cloud.isCurrentOwner(ownerUserId, options)
            && (options.generation === undefined || options.generation === this.cloud.cloudGeneration);
        if (record.ownerUserId !== ownerUserId || !isCurrent()) {
            const error = new Error('Offline sync record does not belong to the active student.');
            error.code = 'SYNC_OWNER_MISMATCH';
            throw error;
        }
        if (record.type === 'student-unit-work' && typeof studentApi.syncStudentUnitWork === 'function') {
            const result = await this.executeUnitWork(record.payload || {}, {
                ...options, ownerUserId, verifyOwner: true
            });
            if (result.skipped) return;
            const progress = result.progress;
            if (!isCurrent()) return;
            if (this.isLatestUnitSnapshot(record.payload)) {
                this.cloud.applyUnitProgressResult(progress, record.payload || {});
            }
            return;
        }
        if (record.type === 'student-activity-progress'
            && typeof studentApi.submitStudentActivityProgress === 'function') {
            const progress = await studentApi.submitStudentActivityProgress(record.payload || {}, {
                ownerUserId,
                verifyOwner: true
            });
            if (!isCurrent()) return;
            if (this.sm.activities?.progressPersistence?.applyActivityProgressResult) {
                this.sm.activities.progressPersistence.applyActivityProgressResult(progress, record.payload || {});
            } else {
                this.progress.applyProgressSnapshot(progress, { saveLocal: true });
            }
            return;
        }
        if (record.type === 'student-spark-response'
            && typeof studentApi.submitStudentSparkResponse === 'function') {
            const saved = await studentApi.submitStudentSparkResponse(record.payload || {}, {
                ownerUserId,
                verifyOwner: true
            });
            if (!isCurrent()) return;
            const storageKey = String(record.payload?.storageKey || '');
            const sparkId = String(record.payload?.sparkId || '');
            if (storageKey && sparkId) {
                try {
                    const local = JSON.parse(localStorage.getItem(storageKey) || '{}');
                    // A later edit can be saved while this older request is in flight.
                    const currentAnswers = local[sparkId]?.answers || {};
                    const sentAnswers = record.payload?.answers || {};
                    const keys = Object.keys(currentAnswers);
                    if (keys.length !== Object.keys(sentAnswers).length
                        || keys.some(key => currentAnswers[key] !== sentAnswers[key])) return;
                    local[sparkId] = mapSparkResponseRow(saved);
                    localStorage.setItem(storageKey, JSON.stringify(local));
                    this.sm.activities?.updateArcadeGateDisplay?.();
                } catch (storageError) {
                    console.warn('Could not refresh the locally cached Spark response:', storageError);
                }
            }
            return;
        }
        if (record.type === 'student-progress') {
            await this.cloud.refreshCoinsFromCloud({
                ...options,
                silent: true,
                reason: 'queued-progress',
                force: true
            });
            return;
        }
        const error = new Error(`Unsupported offline sync action: ${record.type || 'unknown'}`);
        error.code = 'INVALID_SYNC_ACTION';
        error.status = 422;
        throw error;
    }
}
