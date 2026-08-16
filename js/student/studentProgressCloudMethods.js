import { notifications } from '../notifications.js';
import { studentApi as supabaseService } from '../services/studentApi.js';
import { mapSparkResponseRow } from '../services/sparkResponsesRepository.js';
import { studentProgressRepository } from '../services/studentProgressRepository.js';
import { imageDB } from '../db.js';
import { classifySyncError } from '../services/syncQueuePolicy.js';
import {
    COIN_REALTIME_SAFETY_SYNC_INTERVAL_MS,
    COIN_REFRESH_THROTTLE_MS,
    COIN_SYNC_INTERVAL_MS
} from './studentProgressConstants.js';

export class StudentProgressCloud {
    constructor(progress) {
        this.progress = progress;
        this.sm = progress.sm;
        this.coinRealtimeUnsubscribe = null;
        this.coinSyncInterval = null;
        this.coinRefreshTimeout = null;
        this.coinRefreshInFlight = false;
        this.coinRefreshPendingOptions = null;
        this.lastCoinRefreshAt = 0;
        this.storageSyncHandler = null;
        this.focusSyncHandler = null;
        this.visibilitySyncHandler = null;
        this.onlineSyncHandler = null;
    }

    startCoinSync() {
        if (this.sm.authDisabled || !this.sm.currentUser) return;

        this.stopCoinSync();
        const userId = this.sm.currentUser.uid;

        this.storageSyncHandler = event => {
            if (event.key === 'student_progress') {
                this.progress.applyLocalProgressFromStorage(event.newValue);
            }
        };
        window.addEventListener('storage', this.storageSyncHandler);

        this.visibilitySyncHandler = () => {
            if (document.visibilityState === 'visible') {
                if (this.sm.shouldDebugStudentDom?.()) console.log('VISIBILITY', document.visibilityState);
                this.scheduleCoinRefresh({ silent: true, reason: 'visibilitychange' });
            }
        };
        document.addEventListener('visibilitychange', this.visibilitySyncHandler);

        this.focusSyncHandler = () => {
            if (this.sm.shouldDebugStudentDom?.()) console.log('FOCUS');
            this.scheduleCoinRefresh({ silent: true, reason: 'focus' });
        };
        this.onlineSyncHandler = () => {
            this.flushLocalSyncQueue({ silent: true });
            this.scheduleCoinRefresh({ silent: true, reason: 'online', force: true });
        };
        window.addEventListener('focus', this.focusSyncHandler);
        window.addEventListener('online', this.onlineSyncHandler);

        this.coinRealtimeUnsubscribe = studentProgressRepository.subscribe(userId, progress => {
            this.sm.logStudentDomUpdate?.('student-progress-realtime', { source: 'studentProgressRepository.subscribe' });
            this.applyRemoteCoinProgress(progress);
        });

        const syncInterval = this.coinRealtimeUnsubscribe
            ? COIN_REALTIME_SAFETY_SYNC_INTERVAL_MS
            : COIN_SYNC_INTERVAL_MS;
        this.coinSyncInterval = window.setInterval(() => {
            if (document.visibilityState === 'hidden') return;
            this.scheduleCoinRefresh({ silent: true, reason: 'interval' });
        }, syncInterval);

        this.flushLocalSyncQueue({ silent: true });
    }

    stopCoinSync() {
        if (this.coinRealtimeUnsubscribe) {
            this.coinRealtimeUnsubscribe();
            this.coinRealtimeUnsubscribe = null;
        }
        if (this.coinSyncInterval) {
            window.clearInterval(this.coinSyncInterval);
            this.coinSyncInterval = null;
        }
        if (this.coinRefreshTimeout) {
            window.clearTimeout(this.coinRefreshTimeout);
            this.coinRefreshTimeout = null;
        }
        this.coinRefreshInFlight = false;
        this.coinRefreshPendingOptions = null;
        if (this.storageSyncHandler) {
            window.removeEventListener('storage', this.storageSyncHandler);
            this.storageSyncHandler = null;
        }
        if (this.visibilitySyncHandler) {
            document.removeEventListener('visibilitychange', this.visibilitySyncHandler);
            this.visibilitySyncHandler = null;
        }
        if (this.focusSyncHandler) {
            window.removeEventListener('focus', this.focusSyncHandler);
            this.focusSyncHandler = null;
        }
        if (this.onlineSyncHandler) {
            window.removeEventListener('online', this.onlineSyncHandler);
            this.onlineSyncHandler = null;
        }
    }

    scheduleCoinRefresh(options = {}) {
        if (this.sm.authDisabled || !this.sm.currentUser) return;

        if (this.coinRefreshInFlight) {
            this.coinRefreshPendingOptions = {
                ...this.coinRefreshPendingOptions,
                ...options,
                reason: options.reason || this.coinRefreshPendingOptions?.reason
            };
            return;
        }

        const now = Date.now();
        const throttleDelay = options.force
            ? 0
            : Math.max(0, COIN_REFRESH_THROTTLE_MS - (now - this.lastCoinRefreshAt));

        if (this.coinRefreshTimeout) {
            window.clearTimeout(this.coinRefreshTimeout);
            this.coinRefreshTimeout = null;
        }

        this.coinRefreshTimeout = window.setTimeout(() => {
            this.coinRefreshTimeout = null;
            this.refreshCoinsFromCloud(options);
        }, throttleDelay);
    }

    applyRemoteCoinProgress(progress) {
        if (!progress) return;
        this.sm.logStudentDomUpdate?.('student-progress', { source: 'applyRemoteCoinProgress' });
        const cloudCoinData = this.progress.migrateCoinData(progress);
        this.sm.progressData.totalXp = Number(progress.totalXp) || 0;

        const coinHistory = Array.isArray(progress.coinHistory)
            ? cloudCoinData.coinHistory
            : this.sm.coinHistory;
        this.progress.applyCoinSnapshot(cloudCoinData.coinData, coinHistory, { saveLocal: true });
        this.progress.updateLevelDisplay();
        this.lastCoinRefreshAt = Date.now();
        this.sm.setAuthStatus('Synced');
    }

    applyUnitProgressResult(progress, fallbackPayload = {}) {
        if (!progress?.unit) {
            this.progress.applyProgressSnapshot(progress, { saveLocal: true });
            return;
        }
        const unitKey = progress.unit.unitKey || fallbackPayload.unitKey;
        if (!unitKey) return;
        const units = this.sm.progressData.units ||= {};
        const previous = units[unitKey] || {};
        const { unitKey: _unitKey, ...unitData } = progress.unit;
        units[unitKey] = {
            ...previous,
            ...unitData,
            scores: previous.scores || {},
            states: unitData.states || previous.states || {}
        };
        this.sm.progressData.totalXp = Number(progress.totalXp) || 0;
        this.sm.progressData.version = Number(progress.version) || this.sm.progressData.version || 0;
        if (progress.coinData) {
            this.progress.applyCoinSnapshot(progress.coinData, this.sm.coinHistory, { saveLocal: false });
        }
        if (this.sm.currentVocab && this.sm.activities?.getUnitProgressKey?.(this.sm.currentVocab) === unitKey) {
            this.sm.unitScores = units[unitKey].scores;
            this.sm.unitStates = units[unitKey].states;
            this.sm.unitImages = units[unitKey].images || {};
            this.sm.unitWordHunt = units[unitKey].wordHunt || {};
        }
        this.progress.saveLocalProgress(true);
    }

    async refreshCoinsFromCloud(options = {}) {
        if (this.sm.authDisabled || !this.sm.currentUser) return;
        if (this.coinRefreshInFlight) {
            this.coinRefreshPendingOptions = {
                ...this.coinRefreshPendingOptions,
                ...options,
                reason: options.reason || this.coinRefreshPendingOptions?.reason
            };
            return;
        }

        this.coinRefreshInFlight = true;
        try {
            this.sm.logStudentDomUpdate?.('student-progress', {
                source: 'refreshCoinsFromCloud:start',
                reason: options.reason || ''
            });
            this.lastCoinRefreshAt = Date.now();
            const progress = await studentProgressRepository.getSummary(this.sm.currentUser.uid);
            if (!progress) return;
            this.sm.logStudentDomUpdate?.('student-progress', {
                source: 'refreshCoinsFromCloud:snapshot',
                reason: options.reason || ''
            });
            this.applyRemoteCoinProgress(progress);
        } catch (error) {
            if (!options.silent) {
                console.warn('Could not refresh coins from cloud:', error);
            }
        } finally {
            this.coinRefreshInFlight = false;
            const pendingOptions = this.coinRefreshPendingOptions;
            this.coinRefreshPendingOptions = null;
            if (pendingOptions) {
                this.scheduleCoinRefresh(pendingOptions);
            }
        }
    }

    async loadCloudProgress(options = {}) {
        if (this.sm.authDisabled) return;
        if (!this.sm.currentUser) return;
        try {
            let data = null;

            if (typeof supabaseService.ensureOwnStudentProgress === 'function') {
                data = await supabaseService.ensureOwnStudentProgress(this.sm.studentProfile, options);
            } else {
                data = await studentProgressRepository.get(this.sm.currentUser.uid, options);
            }

            if (!data) {
                this.sm.setAuthStatus('Ready');
                return;
            }

            const cloudCoinData = this.progress.migrateCoinData(data);
            const cloudGiftCoins = cloudCoinData.coinData.giftCoins || 0;
            const localGiftCoins = this.sm.coinData.giftCoins || 0;
            const hasWelcomeBonus = cloudCoinData.coinHistory.some(entry => entry?.source === 'welcome');
            this.sm.coinData = cloudCoinData.coinData;
            this.sm.coinHistory = cloudCoinData.coinHistory;

            if (cloudGiftCoins > localGiftCoins) {
                this.progress.showNotificationBadge();
            }

            this.sm.coins = this.sm.coinData.balance;

            const mergedStudentProfile = this.sm.mergeStudentProfile(
                this.sm.studentProfile,
                data.studentProfile || {}
            );

            this.sm.progressData = {
                studentProfile: mergedStudentProfile,
                units: data.units || {},
                totalXp: Number(data.totalXp) || 0,
                coins: this.sm.coins,
                coinData: this.sm.coinData,
                coinHistory: this.sm.coinHistory
            };
            this.sm.updateCoinDisplay();
            this.sm.studentProfile = mergedStudentProfile;
            await this.restoreImagesFromProgress();

            if (!hasWelcomeBonus && this.sm.coinData.balance === 0 && typeof supabaseService.claimStudentWelcomeBonus === 'function') {
                const progress = await supabaseService.claimStudentWelcomeBonus({ clientId: this.progress.clientId });
                if (progress) {
                    const previousBalance = this.sm.coinData.balance;
                    this.applyRemoteCoinProgress(progress);
                    if (previousBalance === 0 && this.sm.coinData.balance === 100) {
                        this.sm.showToast('Welcome! You received 100 starting coins!');
                    }
                }
            } else {
                this.progress.saveLocalProgress(true);
            }

            this.sm.setAuthStatus('Synced');
        } catch (error) {
            console.error('Failed to load cloud progress:', error);
            // Check if we're offline
            const isOffline = !navigator.onLine;
            if (isOffline) {
                this.sm.setAuthStatus('Signed in (Offline)');
                notifications.info('You are offline. Using local data. Changes will sync when online.');
            } else {
                this.sm.setAuthStatus('Cloud load failed');
                notifications.warning('Could not load progress from cloud. Using local data.');
            }
            // Re-throw so caller knows we're offline/failed
            throw error;
        }
    }

    async saveProgressToCloud() {
        if (this.sm.authDisabled) return;
        if (!this.sm.currentUser) return;
        try {
            let progress = null;
            const unitPayload = this.buildUnitWorkSyncPayload();
            if (unitPayload && typeof supabaseService.syncStudentUnitWork === 'function') {
                progress = await supabaseService.syncStudentUnitWork(unitPayload);
            } else if (typeof supabaseService.ensureOwnStudentProgress === 'function') {
                // Unit sync already ensures the row exists. Avoid a duplicate round trip
                // whenever the current save contains unit work.
                progress = await supabaseService.ensureOwnStudentProgress(this.sm.studentProfile);
            }

            if (progress) {
                this.applyUnitProgressResult(progress, unitPayload || {});
            }

            this.sm.setAuthStatus('Synced');
        } catch (error) {
            console.error('Failed to save progress to cloud:', error);
            const failure = classifySyncError(error, { online: navigator.onLine });
            if (failure.retryable) {
                await this.enqueueProgressSync();
                this.sm.setAuthStatus(navigator.onLine ? 'Sync failed - saved locally' : 'Saved locally - offline');
            } else {
                this.sm.setAuthStatus('Cloud rejected this change');
                notifications.warning('This change could not be accepted. Refresh and try again, or ask your teacher for help.');
            }
        }
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

    async enqueueProgressSync() {
        try {
            const payload = this.buildUnitWorkSyncPayload();
            if (payload) {
                await imageDB.enqueueSyncAction('student-unit-work', payload);
            }
        } catch (queueError) {
            console.warn('Could not queue progress for later sync:', queueError);
        }
    }

    async flushLocalSyncQueue(options = {}) {
        if (this.sm.authDisabled || !this.sm.currentUser || !navigator.onLine) return;

        let pending = [];
        try {
            pending = await imageDB.getPendingSyncActions();
        } catch (error) {
            if (!options.silent) console.warn('Could not read local sync queue:', error);
            return;
        }

        if (pending.length === 0) return;
        this.sm.setAuthStatus('Syncing local changes...');

        let retryableFailures = 0;
        let terminalFailures = 0;

        for (const record of pending) {
            try {
                await this.syncQueuedRecord(record);
                await imageDB.completeSyncAction(record.id);
            } catch (error) {
                const failure = classifySyncError(error, { online: navigator.onLine });
                const updated = await imageDB.markSyncActionFailed(record, error, {
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

    async syncQueuedRecord(record) {
        if (record.type === 'student-unit-work' && typeof supabaseService.syncStudentUnitWork === 'function') {
            const progress = await supabaseService.syncStudentUnitWork(record.payload || {});
            this.applyUnitProgressResult(progress, record.payload || {});
            return;
        }
        if (record.type === 'student-activity-progress' && typeof supabaseService.submitStudentActivityProgress === 'function') {
            const progress = await supabaseService.submitStudentActivityProgress(record.payload || {});
            if (this.sm.activities?.progressPersistence?.applyActivityProgressResult) {
                this.sm.activities.progressPersistence.applyActivityProgressResult(progress, record.payload || {});
            } else {
                this.progress.applyProgressSnapshot(progress, { saveLocal: true });
            }
            return;
        }
        if (record.type === 'student-spark-response'
            && typeof supabaseService.submitStudentSparkResponse === 'function') {
            const saved = await supabaseService.submitStudentSparkResponse(record.payload || {});
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
            await this.refreshCoinsFromCloud({ silent: true, reason: 'queued-progress', force: true });
            return;
        }
        const error = new Error(`Unsupported offline sync action: ${record.type || 'unknown'}`);
        error.code = 'INVALID_SYNC_ACTION';
        error.status = 422;
        throw error;
    }

    async restoreImagesFromProgress() {
        if (!this.sm.progressData.units) return;
        for (const [unitName, unitData] of Object.entries(this.sm.progressData.units)) {
            if (!unitData.images) continue;
            for (const [word, dataUrl] of Object.entries(unitData.images)) {
                if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) continue;

                try {
                    const blob = await this.dataURLToBlob(dataUrl);
                    await imageDB.saveDrawing(unitName, word, blob);
                } catch (error) {
                    console.error('Failed to restore image', unitName, word, error);
                }
            }
        }
    }

    dataURLToBlob(dataUrl) {
        return fetch(dataUrl).then(res => res.blob());
    }
}
