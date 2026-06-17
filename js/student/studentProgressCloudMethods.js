import { notifications } from '../notifications.js';
import { studentApi as supabaseService, doc, getDoc } from '../services/studentApi.js';
import { imageDB } from '../db.js';
import {
    COIN_REALTIME_SAFETY_SYNC_INTERVAL_MS,
    COIN_REFRESH_THROTTLE_MS,
    COIN_SYNC_INTERVAL_MS
} from './studentProgressConstants.js';

class StudentProgressCloudMethods {
    startCoinSync() {
        if (this.sm.authDisabled || !this.sm.currentUser) return;

        this.stopCoinSync();
        const userId = this.sm.currentUser.uid;

        this.storageSyncHandler = event => {
            if (event.key === 'student_progress') {
                this.applyLocalProgressFromStorage(event.newValue);
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

        if (typeof supabaseService.subscribeToStudentProgress === 'function') {
            this.coinRealtimeUnsubscribe = supabaseService.subscribeToStudentProgress(userId, progress => {
                this.sm.logStudentDomUpdate?.('student-progress-realtime', { source: 'subscribeToStudentProgress' });
                this.applyRemoteCoinProgress(progress);
            });
        }

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
        const cloudCoinData = this.migrateCoinData(progress);

        this.applyCoinSnapshot(cloudCoinData.coinData, cloudCoinData.coinHistory, { saveLocal: true });
        this.lastCoinRefreshAt = Date.now();
        this.sm.setAuthStatus('☁️ Synced');
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
            const db = supabaseService.getDatabase();
            const docRef = doc(db, 'studentProgress', this.sm.currentUser.uid);
            const snapshot = await getDoc(docRef);
            if (!snapshot.exists()) return;
            this.sm.logStudentDomUpdate?.('student-progress', {
                source: 'refreshCoinsFromCloud:snapshot',
                reason: options.reason || ''
            });
            this.applyRemoteCoinProgress(snapshot.data());
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

    async loadCloudProgress() {
        if (this.sm.authDisabled) return;
        if (!this.sm.currentUser) return;
        try {
            let data = null;

            if (typeof supabaseService.ensureOwnStudentProgress === 'function') {
                data = await supabaseService.ensureOwnStudentProgress(this.sm.studentProfile);
            } else {
                const db = supabaseService.getDatabase();
                const docRef = doc(db, 'studentProgress', this.sm.currentUser.uid);
                const snapshot = await getDoc(docRef);
                data = snapshot.exists() ? snapshot.data() : null;
            }

            if (!data) {
                this.sm.setAuthStatus('☁️ Ready');
                return;
            }

            const cloudCoinData = this.migrateCoinData(data);
            const cloudGiftCoins = cloudCoinData.coinData.giftCoins || 0;
            const localGiftCoins = this.sm.coinData.giftCoins || 0;
            const hasWelcomeBonus = cloudCoinData.coinHistory.some(entry => entry?.source === 'welcome');
            this.sm.coinData = cloudCoinData.coinData;
            this.sm.coinHistory = cloudCoinData.coinHistory;

            if (cloudGiftCoins > localGiftCoins) {
                this.sm.showNotificationBadge();
            }

            this.sm.coins = this.sm.coinData.balance;

            const mergedStudentProfile = this.sm.mergeStudentProfile(
                this.sm.studentProfile,
                data.studentProfile || {}
            );

            this.sm.progressData = {
                studentProfile: mergedStudentProfile,
                units: data.units || {},
                coins: this.sm.coins,
                coinData: this.sm.coinData,
                coinHistory: this.sm.coinHistory
            };
            this.sm.updateCoinDisplay();
            this.sm.studentProfile = mergedStudentProfile;
            await this.restoreImagesFromProgress();

            if (!hasWelcomeBonus && this.sm.coinData.balance === 0 && typeof supabaseService.claimStudentWelcomeBonus === 'function') {
                const progress = await supabaseService.claimStudentWelcomeBonus({ clientId: this.clientId });
                if (progress) {
                    this.applyProgressSnapshot(progress, { saveLocal: true });
                    const bonusCoinData = this.migrateCoinData(progress);
                    if (bonusCoinData.coinHistory.some(entry => entry?.source === 'welcome')) {
                        this.sm.showToast('🎉 Welcome! You received 100 starting coins!');
                    }
                }
            } else {
                this.saveLocalProgress(true);
            }

            this.sm.setAuthStatus('☁️ Synced');
        } catch (error) {
            console.error('Failed to load cloud progress:', error);
            // Check if we're offline
            const isOffline = !navigator.onLine;
            if (isOffline) {
                this.sm.setAuthStatus('🔐 Signed in (Offline)');
                notifications.info('You are offline. Using local data. Changes will sync when online.');
            } else {
                this.sm.setAuthStatus('⚠️ Cloud load failed');
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
            if (typeof supabaseService.ensureOwnStudentProgress === 'function') {
                progress = await supabaseService.ensureOwnStudentProgress(this.sm.studentProfile);
            }

            const unitPayload = this.buildUnitWorkSyncPayload();
            if (unitPayload && typeof supabaseService.syncStudentUnitWork === 'function') {
                progress = await supabaseService.syncStudentUnitWork(unitPayload);
            }

            if (progress) {
                this.applyProgressSnapshot(progress, { saveLocal: true });
            }

            this.sm.setAuthStatus('☁️ Synced');
        } catch (error) {
            console.error('Failed to save progress to cloud:', error);
            await this.enqueueProgressSync();
            this.sm.setAuthStatus(navigator.onLine ? '⚠️ Sync failed - saved locally' : 'Saved locally - offline');
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
        this.sm.setAuthStatus('☁️ Syncing local changes...');

        for (const record of pending) {
            try {
                if (record.type === 'student-unit-work' && typeof supabaseService.syncStudentUnitWork === 'function') {
                    const progress = await supabaseService.syncStudentUnitWork(record.payload || {});
                    this.applyProgressSnapshot(progress, { saveLocal: true });
                } else if (record.type === 'student-activity-progress' && typeof supabaseService.submitStudentActivityProgress === 'function') {
                    const progress = await supabaseService.submitStudentActivityProgress(record.payload || {});
                    this.applyProgressSnapshot(progress, { saveLocal: true });
                } else if (record.type === 'student-progress') {
                    await this.refreshCoinsFromCloud({ silent: true, reason: 'queued-progress', force: true });
                }
                await imageDB.completeSyncAction(record.id);
            } catch (error) {
                await imageDB.markSyncActionFailed(record, error);
                this.sm.setAuthStatus('⚠️ Sync failed - saved locally');
                if (!options.silent) console.warn('Could not sync queued local change:', error);
                return;
            }
        }

        this.sm.setAuthStatus('☁️ Synced');
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

export function installStudentProgressCloudMethods(StudentProgress) {
    for (const name of Object.getOwnPropertyNames(StudentProgressCloudMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentProgress.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentProgressCloudMethods.prototype, name)
        );
    }
}
