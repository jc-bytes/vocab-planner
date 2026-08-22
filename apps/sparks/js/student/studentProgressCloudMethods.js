import { notifications } from '../notifications.js';
import { studentApi as supabaseService } from '../services/studentApi.js';
import { studentProgressRepository } from '../services/studentProgressRepository.js';
import { imageDB } from '../db.js';
import { classifySyncError } from '../services/syncQueuePolicy.js';
import { StudentProgressSyncQueue } from './studentProgressSyncQueue.js';
import {
    COIN_REALTIME_SAFETY_SYNC_INTERVAL_MS,
    COIN_REFRESH_THROTTLE_MS,
    COIN_SYNC_INTERVAL_MS
} from './studentProgressConstants.js';
import {
    getActiveStudentStorageOwner,
    getStudentProgressStorageKey,
    isActiveStudentStorageOwner
} from './persistence/studentStorage.js';

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

        this.visibilitySyncHandler = () => {
            if (document.visibilityState === 'visible') {
                if (this.sm.shouldDebugStudentDom?.()) console.log('VISIBILITY', document.visibilityState);
                this.scheduleCoinRefresh({ silent: true, reason: 'visibilitychange', ownerUserId: userId, generation });
            }
        };
        document.addEventListener('visibilitychange', this.visibilitySyncHandler);

        this.focusSyncHandler = () => {
            if (this.sm.shouldDebugStudentDom?.()) console.log('FOCUS');
            this.scheduleCoinRefresh({ silent: true, reason: 'focus', ownerUserId: userId, generation });
        };
        this.onlineSyncHandler = () => {
            this.flushLocalSyncQueue({ silent: true, ownerUserId: userId, generation });
            this.scheduleCoinRefresh({ silent: true, reason: 'online', force: true, ownerUserId: userId, generation });
        };
        window.addEventListener('focus', this.focusSyncHandler);
        window.addEventListener('online', this.onlineSyncHandler);

        this.coinRealtimeUnsubscribe = studentProgressRepository.subscribe(userId, progress => {
            if (!this.isCurrentOwner(userId) || generation !== this.cloudGeneration) return;
            this.sm.logStudentDomUpdate?.('student-progress-realtime', { source: 'studentProgressRepository.subscribe' });
            this.applyRemoteCoinProgress(progress);
        });

        const syncInterval = this.coinRealtimeUnsubscribe
            ? COIN_REALTIME_SAFETY_SYNC_INTERVAL_MS
            : COIN_SYNC_INTERVAL_MS;
        this.coinSyncInterval = window.setInterval(() => {
            if (document.visibilityState === 'hidden') return;
            this.scheduleCoinRefresh({ silent: true, reason: 'interval', ownerUserId: userId, generation });
        }, syncInterval);

        this.flushLocalSyncQueue({ silent: true, ownerUserId: userId, generation });
    }

    stopCoinSync() {
        this.cloudGeneration += 1;
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
        const ownerUserId = options.ownerUserId || this.sm.currentUser.uid;
        if (!this.isCurrentOwner(ownerUserId)
            || (options.generation !== undefined && options.generation !== this.cloudGeneration)) return;

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
        const ownerUserId = options.ownerUserId || this.sm.currentUser.uid;
        const generation = options.generation ?? this.cloudGeneration;
        if (!this.isCurrentOwner(ownerUserId, options) || generation !== this.cloudGeneration) return;
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
            const progress = await studentProgressRepository.getSummary(ownerUserId, options);
            if (!this.isCurrentOwner(ownerUserId, options) || generation !== this.cloudGeneration) return;
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
            if (generation !== this.cloudGeneration) return;
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
        const ownerUserId = options.ownerUserId || this.sm.currentUser.uid;
        if (!this.isCurrentOwner(ownerUserId, options)) return;
        try {
            let data = null;

            if (typeof supabaseService.ensureOwnStudentProgress === 'function') {
                data = await supabaseService.ensureOwnStudentProgress(this.sm.studentProfile, options);
            } else {
                data = await studentProgressRepository.get(ownerUserId, options);
            }

            if (!this.isCurrentOwner(ownerUserId, options)) return;

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
            await this.restoreImagesFromProgress({ ...options, ownerUserId });
            if (!this.isCurrentOwner(ownerUserId, options)) return;

            if (!hasWelcomeBonus && this.sm.coinData.balance === 0 && typeof supabaseService.claimStudentWelcomeBonus === 'function') {
                const progress = await supabaseService.claimStudentWelcomeBonus({ clientId: this.progress.clientId });
                if (!this.isCurrentOwner(ownerUserId, options)) return;
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
            if (!this.isCurrentOwner(ownerUserId, options)) return;
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
        try {
            let progress = null;
            const unitPayload = this.buildUnitWorkSyncPayload();
            if (unitPayload && typeof supabaseService.syncStudentUnitWork === 'function') {
                progress = await supabaseService.syncStudentUnitWork(unitPayload, { ownerUserId });
            } else if (typeof supabaseService.ensureOwnStudentProgress === 'function') {
                // Unit sync already ensures the row exists. Avoid a duplicate round trip
                // whenever the current save contains unit work.
                progress = await supabaseService.ensureOwnStudentProgress(this.sm.studentProfile);
            }

            if (!this.isCurrentOwner(ownerUserId)) return;

            if (progress) {
                this.applyUnitProgressResult(progress, unitPayload || {});
            }

            this.sm.setAuthStatus('Synced');
        } catch (error) {
            if (!this.isCurrentOwner(ownerUserId)) return;
            console.error('Failed to save progress to cloud:', error);
            const failure = classifySyncError(error, { online: navigator.onLine });
            if (failure.retryable) {
                await this.enqueueProgressSync({ ownerUserId });
                this.sm.setAuthStatus(navigator.onLine ? 'Sync failed - saved locally' : 'Saved locally - offline');
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
