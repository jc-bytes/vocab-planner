import { notifications } from '../notifications.js';
import { studentApi as supabaseService } from '../services/studentApi.js';
import { studentProgressRepository } from '../services/studentProgressRepository.js';
import { serverStateQuery } from '../services/serverStateQuery.js';
import { imageDB } from '../db.js';
import { classifySyncError } from '../services/syncQueuePolicy.js';
import { StudentProgressSyncQueue } from './studentProgressSyncQueue.js';
import {
    COIN_REALTIME_SAFETY_SYNC_INTERVAL_MS,
    COIN_REFRESH_THROTTLE_MS
} from './studentProgressConstants.js';
import {
    getActiveStudentStorageOwner,
    getStudentProgressStorageKey,
    isActiveStudentStorageOwner
} from './persistence/studentStorage.js';

const STUDENT_PROGRESS_SUMMARY_QUERY_KEY = ['student', 'progress-summary'];

export class StudentProgressCloud {
    constructor(progress) {
        this.progress = progress;
        this.sm = progress.sm;
        this.queryService = progress.queryService || this.sm.serverStateQuery || serverStateQuery;
        this.coinRealtimeUnsubscribe = null;
        this.coinSummaryObservation = null;
        this.lastAppliedSummary = null;
        this.lastAppliedSummaryUpdatedAt = 0;
        this.storageSyncHandler = null;
        this.onlineSyncHandler = null;
        this.cloudGeneration = 0;
        this.syncQueue = new StudentProgressSyncQueue(this);
    }

    isCurrentOwner(ownerUserId, options = {}) {
        return Boolean(
            ownerUserId
            && this.sm.currentUser?.uid === ownerUserId
            && isActiveStudentStorageOwner(ownerUserId)
            && (!options.isCurrent || options.isCurrent())
            && (!options.signal || !options.signal.aborted)
        );
    }

    startCoinSync() {
        if (this.sm.authDisabled || !this.sm.currentUser) return;

        this.stopCoinSync();
        const userId = this.sm.currentUser.uid;
        const generation = this.cloudGeneration;

        this.storageSyncHandler = event => {
            if (this.isCurrentOwner(userId)
                && event.key === getStudentProgressStorageKey(userId)) {
                this.progress.applyLocalProgressFromStorage(event.newValue);
            }
        };
        window.addEventListener('storage', this.storageSyncHandler);

        this.onlineSyncHandler = () => {
            void this.syncSavedChangesInBackground({ silent: true, ownerUserId: userId, generation });
        };
        window.addEventListener('online', this.onlineSyncHandler);

        this.coinSummaryObservation = this.queryService.observe({
            accountId: userId,
            key: STUDENT_PROGRESS_SUMMARY_QUERY_KEY,
            scope: 'account',
            queryFn: ({ signal }) => studentProgressRepository.getSummary(userId, { signal }),
            staleTime: COIN_REFRESH_THROTTLE_MS,
            refetchInterval: COIN_REALTIME_SAFETY_SYNC_INTERVAL_MS,
            refetchIntervalInBackground: false,
            refetchOnWindowFocus: true,
            refetchOnReconnect: 'always'
        }, result => this.applyObservedCoinSummary(result, { ownerUserId: userId, generation }));

        this.coinRealtimeUnsubscribe = studentProgressRepository.subscribe(userId, progress => {
            if (!this.isCurrentOwner(userId) || generation !== this.cloudGeneration) return;
            this.sm.logStudentDomUpdate?.('student-progress-realtime', { source: 'studentProgressRepository.subscribe' });
            this.queryService.setData({
                accountId: userId,
                key: STUDENT_PROGRESS_SUMMARY_QUERY_KEY,
                scope: 'account',
                updater: progress
            });
        });

        void this.syncSavedChangesInBackground({ silent: true, ownerUserId: userId, generation });
    }

    async syncSavedChangesInBackground(options) {
        try {
            await this.flushLocalSyncQueue(options);
        } catch {
            if (!this.isCurrentOwner(options.ownerUserId)
                || options.generation !== this.cloudGeneration) return;
            // An event listener cannot return a rejected promise to its caller.
            // Explicit awaited flushes still reject; the receipt remains intact.
            try {
                this.syncQueue.setQueueStatus('Local sync needs attention', options.ownerUserId, options.generation);
            } catch { /* A failed status observer must not escape the background boundary. */ }
        }
    }

    stopCoinSync() {
        this.syncQueue.cancelRetry();
        this.cloudGeneration += 1;
        this.syncQueue.resetUnitSnapshots();
        if (this.coinRealtimeUnsubscribe) {
            this.coinRealtimeUnsubscribe();
            this.coinRealtimeUnsubscribe = null;
        }
        if (this.coinSummaryObservation) {
            this.coinSummaryObservation.unsubscribe();
            this.coinSummaryObservation = null;
        }
        this.lastAppliedSummary = null;
        this.lastAppliedSummaryUpdatedAt = 0;
        if (this.storageSyncHandler) {
            window.removeEventListener('storage', this.storageSyncHandler);
            this.storageSyncHandler = null;
        }
        if (this.onlineSyncHandler) {
            window.removeEventListener('online', this.onlineSyncHandler);
            this.onlineSyncHandler = null;
        }
    }

    applyObservedCoinSummary(result, options = {}) {
        if (!result?.isSuccess || !result.data) return;
        const ownerUserId = options.ownerUserId || this.sm.currentUser?.uid;
        if (!this.isCurrentOwner(ownerUserId)
            || options.generation !== this.cloudGeneration
            || (result.data === this.lastAppliedSummary
                && result.dataUpdatedAt === this.lastAppliedSummaryUpdatedAt)) return;

        this.lastAppliedSummary = result.data;
        this.lastAppliedSummaryUpdatedAt = result.dataUpdatedAt;
        this.sm.logStudentDomUpdate?.('student-progress', { source: 'studentProgressSummaryQuery' });
        this.applyRemoteCoinProgress(result.data);
    }

    scheduleCoinRefresh(options = {}) {
        if (this.sm.authDisabled || !this.sm.currentUser) return;
        const ownerUserId = options.ownerUserId || this.sm.currentUser.uid;
        if (!this.isCurrentOwner(ownerUserId)
            || (options.generation !== undefined && options.generation !== this.cloudGeneration)) return;

        return this.refreshCoinsFromCloud(options);
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
        this.sm.setAuthStatus(this.syncQueue.getAuthStatus());
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
        const ownerUserId = options.ownerUserId || this.sm.currentUser.uid;
        const generation = options.generation ?? this.cloudGeneration;
        if (!this.isCurrentOwner(ownerUserId, options) || generation !== this.cloudGeneration) return;
        try {
            this.sm.logStudentDomUpdate?.('student-progress', {
                source: 'refreshCoinsFromCloud:start',
                reason: options.reason || ''
            });
            const progress = await this.queryService.refresh({
                accountId: ownerUserId,
                key: STUDENT_PROGRESS_SUMMARY_QUERY_KEY,
                scope: 'account',
                queryFn: ({ signal }) => studentProgressRepository.getSummary(ownerUserId, { ...options, signal }),
                staleTime: COIN_REFRESH_THROTTLE_MS
            });
            if (!this.isCurrentOwner(ownerUserId, options) || generation !== this.cloudGeneration) return;
            if (!progress) return;
            if (!this.coinSummaryObservation) {
                this.sm.logStudentDomUpdate?.('student-progress', {
                    source: 'refreshCoinsFromCloud:snapshot',
                    reason: options.reason || ''
                });
                this.applyRemoteCoinProgress(progress);
            }
            return progress;
        } catch (error) {
            if (!options.silent) {
                console.warn('Could not refresh coins from cloud:', error);
            }
        }
    }

    async loadCloudProgress(options = {}) {
        if (this.sm.authDisabled) return;
        if (!this.sm.currentUser) return;
        const ownerUserId = options.ownerUserId || this.sm.currentUser.uid;
        const generation = options.generation ?? this.cloudGeneration;
        const isCurrent = () => this.isCurrentOwner(ownerUserId, options) && generation === this.cloudGeneration;
        if (!isCurrent()) return;
        try {
            let data = null;

            if (typeof supabaseService.ensureOwnStudentProgress === 'function') {
                data = await supabaseService.ensureOwnStudentProgress(this.sm.studentProfile, options);
            } else {
                data = await studentProgressRepository.get(ownerUserId, options);
            }

            if (!isCurrent()) return;

            if (!data) {
                this.sm.setAuthStatus('Ready');
                return;
            }

            const units = await this.syncQueue.restorePendingUnitWork(data.units || {}, {
                ...options, ownerUserId, generation
            });
            if (!isCurrent()) return;
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
                units,
                totalXp: Number(data.totalXp) || 0,
                coins: this.sm.coins,
                coinData: this.sm.coinData,
                coinHistory: this.sm.coinHistory
            };
            this.sm.updateCoinDisplay();
            this.sm.studentProfile = mergedStudentProfile;
            await this.restoreImagesFromProgress({ ...options, ownerUserId });
            if (!isCurrent()) return;

            if (!hasWelcomeBonus && this.sm.coinData.balance === 0 && typeof supabaseService.claimStudentWelcomeBonus === 'function') {
                const progress = await supabaseService.claimStudentWelcomeBonus({ clientId: this.progress.clientId });
                if (!isCurrent()) return;
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

            this.sm.setAuthStatus(this.syncQueue.getAuthStatus());
        } catch (error) {
            if (!isCurrent()) return;
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
        const ownerUserId = this.sm.currentUser.uid;
        const generation = this.cloudGeneration;
        const unitPayload = this.buildUnitWorkSyncPayload();
        try {
            let progress = null;
            if (unitPayload && typeof supabaseService.syncStudentUnitWork === 'function') {
                const result = await this.syncQueue.executeUnitWork(unitPayload, { ownerUserId, generation });
                if (result.skipped) return;
                progress = result.progress;
            } else if (typeof supabaseService.ensureOwnStudentProgress === 'function') {
                // Unit sync already ensures the row exists. Avoid a duplicate round trip
                // whenever the current save contains unit work.
                progress = await supabaseService.ensureOwnStudentProgress(this.sm.studentProfile);
            }

            if (!this.isCurrentOwner(ownerUserId) || generation !== this.cloudGeneration) return;

            if (progress && this.syncQueue.isLatestUnitSnapshot(unitPayload || {})) {
                this.applyUnitProgressResult(progress, unitPayload || {});
            }

            this.sm.setAuthStatus(this.syncQueue.getAuthStatus());
        } catch (error) {
            if (!this.isCurrentOwner(ownerUserId) || generation !== this.cloudGeneration) return;
            console.error('Failed to save progress to cloud:', error);
            const failure = classifySyncError(error, { online: navigator.onLine });
            if (failure.retryable) {
                try {
                    const queued = await this.enqueueProgressSync({ ownerUserId, generation, payload: unitPayload });
                    if (!this.isCurrentOwner(ownerUserId) || generation !== this.cloudGeneration) return;
                    if (queued?.skipped) return;
                    if (!queued) {
                        this.sm.setAuthStatus('Cloud save failed');
                        return;
                    }
                    this.sm.setAuthStatus(navigator.onLine ? 'Sync failed - saved locally' : 'Saved locally - offline');
                } catch (queueError) {
                    if (!this.isCurrentOwner(ownerUserId) || generation !== this.cloudGeneration) return;
                    console.warn('Could not queue progress for later sync:', queueError);
                    this.syncQueue.setQueueStatus(queueError?.code === 'SYNC_QUEUE_FULL'
                        ? 'Local sync storage is full' : 'Could not save changes for sync', ownerUserId, this.cloudGeneration);
                    notifications.warning('Your latest changes could not be queued. Reconnect and save again.');
                }
            } else {
                this.sm.setAuthStatus('Cloud rejected this change');
                notifications.warning('This change could not be accepted. Refresh and try again, or ask your teacher for help.');
            }
        }
    }

    buildUnitWorkSyncPayload() {
        return this.syncQueue.buildUnitWorkSyncPayload();
    }

    async enqueueProgressSync(options = {}) {
        return this.syncQueue.enqueueProgressSync(options);
    }

    async flushLocalSyncQueue(options = {}) {
        return this.syncQueue.flushLocalSyncQueue(
            options,
            (record, syncOptions) => this.syncQueuedRecord(record, syncOptions)
        );
    }

    async syncQueuedRecord(record, options = {}) {
        return this.syncQueue.syncQueuedRecord(record, options);
    }

    async restoreImagesFromProgress(options = {}) {
        const ownerUserId = options.ownerUserId || this.sm.currentUser?.uid || getActiveStudentStorageOwner();
        if (!this.isCurrentOwner(ownerUserId, options)) return;
        if (!this.sm.progressData.units) return;
        for (const [unitName, unitData] of Object.entries(this.sm.progressData.units)) {
            if (!unitData.images) continue;
            for (const [word, dataUrl] of Object.entries(unitData.images)) {
                if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) continue;

                try {
                    if (!this.isCurrentOwner(ownerUserId, options)) return;
                    const blob = await this.dataURLToBlob(dataUrl);
                    if (!this.isCurrentOwner(ownerUserId, options)) return;
                    await imageDB.saveDrawing(unitName, word, blob, { ownerUserId });
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
