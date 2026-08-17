import { notifications } from '../notifications.js';
import { imageDB } from '../db.js';
import { studentApi } from '../services/studentApi.js';
import { mapSparkResponseRow } from '../services/sparkResponsesRepository.js';
import { classifySyncError } from '../services/syncQueuePolicy.js';
import { getActiveStudentStorageOwner } from './persistence/studentStorage.js';

export class StudentProgressSyncQueue {
    constructor(cloud) {
        this.cloud = cloud;
        this.progress = cloud.progress;
        this.sm = cloud.sm;
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

        return {
            eventId: `unit-work:${globalThis.crypto?.randomUUID?.()
                || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`,
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
        };
    }

    async enqueueProgressSync(options = {}) {
        try {
            const ownerUserId = options.ownerUserId || this.sm.currentUser?.uid || getActiveStudentStorageOwner();
            const payload = this.buildUnitWorkSyncPayload();
            if (payload) {
                await imageDB.enqueueSyncAction('student-unit-work', payload, { ownerUserId });
            }
        } catch (queueError) {
            console.warn('Could not queue progress for later sync:', queueError);
        }
    }

    async flushLocalSyncQueue(options = {}, syncRecord = this.syncQueuedRecord.bind(this)) {
        if (this.sm.authDisabled || !this.sm.currentUser || !navigator.onLine) return;
        const ownerUserId = options.ownerUserId || this.sm.currentUser.uid;
        const generation = options.generation ?? this.cloud.cloudGeneration;
        if (!this.cloud.isCurrentOwner(ownerUserId, options)
            || generation !== this.cloud.cloudGeneration) return;

        let pending = [];
        try {
            pending = await imageDB.getPendingSyncActions({ ownerUserId });
        } catch (error) {
            if (!options.silent) console.warn('Could not read local sync queue:', error);
            return;
        }

        if (pending.length === 0) return;
        this.sm.setAuthStatus('Syncing local changes...');

        let retryableFailures = 0;
        let terminalFailures = 0;

        for (const record of pending) {
            if (!this.cloud.isCurrentOwner(ownerUserId, options)
                || generation !== this.cloud.cloudGeneration) return;
            try {
                await syncRecord(record, { ...options, ownerUserId, generation });
                if (!this.cloud.isCurrentOwner(ownerUserId, options)
                    || generation !== this.cloud.cloudGeneration) return;
                await imageDB.completeSyncAction(record.id, { ownerUserId });
            } catch (error) {
                if (!this.cloud.isCurrentOwner(ownerUserId, options)
                    || generation !== this.cloud.cloudGeneration) return;
                const failure = classifySyncError(error, { online: navigator.onLine });
                const updated = await imageDB.markSyncActionFailed(record, error, {
                    ownerUserId,
                    terminal: !failure.retryable,
                    reason: failure.reason
                });
                if (updated.status === 'failed') terminalFailures += 1;
                else retryableFailures += 1;
                if (!options.silent) console.warn('Could not sync queued local change:', error);
            }
        }

        if (terminalFailures > 0) {
            this.sm.setAuthStatus('Some local changes need attention');
            if (!options.silent) {
                notifications.warning('Some saved changes were rejected, but other work continued syncing.');
            }
        } else if (retryableFailures > 0) {
            this.sm.setAuthStatus('Sync paused - saved locally');
        } else {
            this.sm.setAuthStatus('Synced');
        }
    }

    async syncQueuedRecord(record, options = {}) {
        const ownerUserId = options.ownerUserId || record.ownerUserId;
        if (record.ownerUserId !== ownerUserId || !this.cloud.isCurrentOwner(ownerUserId, options)) {
            const error = new Error('Offline sync record does not belong to the active student.');
            error.code = 'SYNC_OWNER_MISMATCH';
            throw error;
        }
        if (record.type === 'student-unit-work' && typeof studentApi.syncStudentUnitWork === 'function') {
            const progress = await studentApi.syncStudentUnitWork(record.payload || {}, {
                ownerUserId,
                verifyOwner: true
            });
            if (!this.cloud.isCurrentOwner(ownerUserId, options)) return;
            this.cloud.applyUnitProgressResult(progress, record.payload || {});
            return;
        }
        if (record.type === 'student-activity-progress'
            && typeof studentApi.submitStudentActivityProgress === 'function') {
            const progress = await studentApi.submitStudentActivityProgress(record.payload || {}, {
                ownerUserId,
                verifyOwner: true
            });
            if (!this.cloud.isCurrentOwner(ownerUserId, options)) return;
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
            if (!this.cloud.isCurrentOwner(ownerUserId, options)) return;
            const storageKey = String(record.payload?.storageKey || '');
            const sparkId = String(record.payload?.sparkId || '');
            if (storageKey && sparkId) {
                try {
                    const local = JSON.parse(localStorage.getItem(storageKey) || '{}');
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
