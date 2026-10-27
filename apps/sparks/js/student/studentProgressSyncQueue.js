import { StudentSyncDrainScheduler } from './studentSyncDrainScheduler.js';
import { notifications } from '../notifications.js';
import { imageDB } from '../db.js';
import { studentApi } from '../services/studentApi.js';
import { mapSparkResponseRow } from '../services/sparkResponsesRepository.js';
import { classifySyncError } from '../services/syncQueuePolicy.js';
import { getActiveStudentStorageOwner } from './persistence/studentStorage.js';
import { createUniqueId } from '../randomUtils.js';
import { requireActivityProgressResult } from './studentActivityProgressResult.js';

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
        this.durableUnitSnapshots = new Map();
        this.snapshotClock = 0;
        this.unitWriteLanes = new Map();
        this.drainScheduler = new StudentSyncDrainScheduler((owner, generation) =>
            this.cloud.isCurrentOwner(owner)
            && (generation === undefined || generation === this.cloud.cloudGeneration));
    }

    hasUnpersistedUnitDraft(ownerUserId, unitKey) {
        return (this.latestUnitSnapshots.get(unitKey) || 0)
            > (this.durableUnitSnapshots.get(`${ownerUserId}:${unitKey}`) || 0);
    }

    async restorePendingUnitWork(units, options) {
        const pending = await imageDB.getPendingSyncActions({ ...options, includeDeferred: true });
        if (!this.cloud.isCurrentOwner(options.ownerUserId, options)
            || options.generation !== this.cloud.cloudGeneration) return units;
        const restored = { ...units };
        const pendingOrders = new Map();
        const project = (key, source, context) => {
            if (!source || typeof source !== 'object' || Array.isArray(source)) return;
            // Match unit-work RPC semantics: educational fields merge shallowly,
            // only an object state map replaces states, and rewards stay remote.
            const { scores: _scores, states, coins: _coins, coinData: _coinData,
                coinHistory: _coinHistory, ...work } = source;
            const previous = restored[key] || {};
            const next = { ...previous, ...work, scores: previous.scores || {} };
            if (states && typeof states === 'object' && !Array.isArray(states)) next.states = states;
            for (const [field, length] of Object.entries({ unitId: 160, unitName: 240,
                subjectSlug: 80, trimester: 80, schoolYear: 20, grade: 20 })) {
                const value = String(context?.[field] ?? '').slice(0, length);
                next[field] = value || previous[field];
            }
            restored[key] = next;
        };
        for (const record of pending) {
            if (record.type !== 'student-unit-work' || !record.payload?.unitKey) continue;
            const key = record.payload.unitKey;
            pendingOrders.set(key, Math.max(pendingOrders.get(key) || 0,
                Number(record.payload.snapshotOrder) || 0));
            project(key, record.payload.workPatch, record.payload.unitContext);
        }
        // A successful concurrent replay may retire the queued row while this
        // read is held. A captured newer RAM intent still must survive hydration.
        for (const key of this.latestUnitSnapshots.keys()) {
            // A committed distinct event wins an equal snapshot-order tie.
            // The pending records already carry their durable enqueue order.
            if (this.hasUnpersistedUnitDraft(options.ownerUserId, key)
                && (!pendingOrders.has(key)
                    || this.latestUnitSnapshots.get(key) > pendingOrders.get(key))) {
                const unit = this.sm.progressData.units?.[key];
                project(key, unit, unit);
            }
        }
        return restored;
    }

    getAuthStatus(fallback = 'Synced') {
        const state = this.queueStatus;
        if (state?.message === 'Newer work is not synced. Keep this page open.'
            && ![...this.latestUnitSnapshots.keys()].some(key => this.hasUnpersistedUnitDraft(state.ownerUserId, key))) {
            return fallback;
        }
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
                try {
                    this.setQueueStatus('Local sync needs attention', ownerUserId, generation);
                } catch { /* A disposed status observer cannot reject the background retry. */ }
                console.warn('Could not retry saved local changes:', error);
            });
        }, Math.max(1000, Math.min(2147483647, delay)));
        this.retryTimer?.unref?.();
    }

    resetUnitSnapshots() {
        this.latestUnitSnapshots.clear();
        this.durableUnitSnapshots.clear();
        this.snapshotClock = 0;
        this.drainScheduler.cancelObsolete();
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
            if (!progress || typeof progress !== 'object' || Array.isArray(progress) || !Object.keys(progress).length) {
                const error = new Error('The unit server returned an empty response.');
                error.code = 'EMPTY_UNIT_RESPONSE';
                throw error;
            }
            await imageDB.retireUnitSyncActions(payload, { ownerUserId });
            if (this.cloud.isCurrentOwner(ownerUserId, options) && generation === this.cloud.cloudGeneration) {
                this.durableUnitSnapshots.set(key, Math.max(this.durableUnitSnapshots.get(key) || 0,
                    Number(payload.snapshotOrder) || 0));
            }
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
        const key = `${ownerUserId}:${payload.unitKey}`;
        if (this.cloud.isCurrentOwner(ownerUserId, options) && generation === this.cloud.cloudGeneration) {
            this.durableUnitSnapshots.set(key, Math.max(this.durableUnitSnapshots.get(key) || 0,
                Number(queued?.payload?.snapshotOrder ?? payload.snapshotOrder) || 0));
        }
        this.scheduleRetry({ ownerUserId, generation });
        return queued;
    }

    async flushLocalSyncQueue(options = {}, syncRecord = this.syncQueuedRecord.bind(this)) {
        const owner = options.ownerUserId || this.sm.currentUser?.uid;
        const generation = options.generation ?? this.cloud.cloudGeneration;
        return this.drainScheduler.run(owner, generation, signal =>
            this.runLocalSyncQueue({ ...options, ownerUserId: owner, generation, signal }, syncRecord));
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
            await imageDB.reviveRetryableSyncActions({ ownerUserId });
        } catch (error) {
            // Existing pending records can still sync and free storage even if
            // recovery of an older retired record could not commit locally.
            if (!options.silent) console.warn('Could not recover older local changes:', error);
        }
        try {
            pending = await imageDB.getPendingSyncActions({ ownerUserId, includeDeferred: true });
        } catch (error) {
            if (!options.silent) console.warn('Could not read local sync queue:', error);
            return;
        }

        if (!this.cloud.isCurrentOwner(ownerUserId, options)
            || generation !== this.cloud.cloudGeneration) return;
        if (pending.length > 0) this.sm.setAuthStatus('Syncing local changes...');

        let retryableFailures = 0;
        let terminalFailures = 0;

        const cycle = this.drainScheduler.cycle(ownerUserId, pending, {
            now: () => this.scheduler.now(),
            maxAttempts: this.maxDrainAttempts,
            maxDurationMs: this.maxDrainDurationMs
        });
        let record;
        while ((record = cycle.next(pending))) {
            if (!this.cloud.isCurrentOwner(ownerUserId, options)
                || generation !== this.cloud.cloudGeneration) return;
            try {
                await syncRecord(record, { ...options, ownerUserId, generation });
                if (!this.cloud.isCurrentOwner(ownerUserId, options)
                    || generation !== this.cloud.cloudGeneration) return;
                const completed = await imageDB.completeSyncAction(record.id, { ownerUserId, expectedRevision: record.revision || 0 });
                if (!completed) cycle.block(record);
                pending = pending.filter(row => row.id !== record.id);
            } catch (error) {
                if (!this.cloud.isCurrentOwner(ownerUserId, options)
                    || generation !== this.cloud.cloudGeneration) return;
                const failure = classifySyncError(error, { online: navigator.onLine });
                const updated = await imageDB.markSyncActionFailed(record, error, {
                    ownerUserId,
                    terminal: !failure.retryable,
                    reason: failure.reason
                });
                cycle.block(record);
                pending = updated.skipped ? pending.filter(row => row.id !== record.id)
                    : pending.map(row => row.id === record.id ? updated : row);
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
            const next = cycle.finish(remaining);
            this.scheduleRetry({ ownerUserId, generation }, next - this.scheduler.now());
        }
        if ([...this.latestUnitSnapshots.keys()].some(key => this.hasUnpersistedUnitDraft(ownerUserId, key))
            || remaining.some(record => record.failureReason === 'unit_work_newer_draft')) {
            this.setQueueStatus('Newer work is not synced. Keep this page open.', ownerUserId, generation);
        } else if (terminalFailures > 0 || failed.length > 0) {
            this.setQueueStatus('Some local changes need attention', ownerUserId, generation);
            if (!options.silent) {
                notifications.warning('Some saved changes were rejected, but other work continued syncing.');
            }
        } else if (remaining.length > 0) {
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
            if (result.skipped) {
                const durableOrder = this.durableUnitSnapshots.get(`${ownerUserId}:${record.payload?.unitKey}`) || 0;
                if (isCurrent() && !this.isLatestUnitSnapshot(record.payload)
                    && durableOrder <= (Number(record.payload?.snapshotOrder) || 0)) {
                    // A newer RAM snapshot may have failed both transport and
                    // storage. Refusing old work is not its acknowledgement.
                    const error = new Error('Newer work is not synced. Keep this page open.');
                    error.code = 'UNIT_WORK_NEWER_DRAFT';
                    throw error;
                }
                return;
            }
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
                ...options,
                ownerUserId,
                verifyOwner: true
            });
            if (!isCurrent()) return;
            requireActivityProgressResult(progress);
            // An older receipt can acknowledge its score without replacing a
            // newer draft that neither the server nor local queue has accepted.
            const unitKey = record.payload?.unitKey;
            const successor = await imageDB.getNewerUnitSyncAction(record, { ownerUserId });
            if (!isCurrent()) return;
            const successorStates = successor?.payload?.workPatch?.states;
            const hasSuccessorStates = Boolean(successorStates && typeof successorStates === 'object'
                && !Array.isArray(successorStates));
            const preserveLocalState = this.hasUnpersistedUnitDraft(ownerUserId, unitKey) || hasSuccessorStates;
            const localStates = successor && (this.latestUnitSnapshots.get(unitKey) || 0)
                <= (Number(successor.payload.snapshotOrder) || 0)
                && hasSuccessorStates
                ? successorStates : undefined;
            if (this.sm.activities?.progressPersistence?.applyActivityProgressResult) {
                this.sm.activities.progressPersistence.applyActivityProgressResult(progress, record.payload || {}, { preserveLocalState, localStates });
            } else {
                this.progress.applyProgressSnapshot(progress, { saveLocal: true,
                    preserveLocalStateForUnit: preserveLocalState ? unitKey : undefined,
                    preservedUnitStates: localStates });
            }
            return;
        }
        if (record.type === 'student-spark-response'
            && typeof studentApi.submitStudentSparkResponse === 'function') {
            const saved = await studentApi.submitStudentSparkResponse(record.payload || {}, {
                ...options,
                ownerUserId,
                verifyOwner: true
            });
            if (!isCurrent()) return;
            if (!saved || typeof saved !== 'object' || Array.isArray(saved) || !Object.keys(saved).length) {
                const error = new Error('The Spark server returned an empty response.');
                error.code = 'EMPTY_SPARK_RESPONSE';
                throw error;
            }
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
