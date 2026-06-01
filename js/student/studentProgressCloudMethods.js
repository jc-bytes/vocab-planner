import { notifications } from '../notifications.js';
import { studentApi as supabaseService, doc, getDoc, setDoc, serverTimestamp } from '../services/studentApi.js';
import { imageDB } from '../db.js';
import {
    COIN_SYNC_INTERVAL_MS,
    DEFAULT_COIN_DATA
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
                this.refreshCoinsFromCloud({ silent: true });
            }
        };
        document.addEventListener('visibilitychange', this.visibilitySyncHandler);

        this.focusSyncHandler = () => this.refreshCoinsFromCloud({ silent: true });
        this.onlineSyncHandler = () => {
            this.flushLocalSyncQueue({ silent: true });
            this.refreshCoinsFromCloud({ silent: true });
        };
        window.addEventListener('focus', this.focusSyncHandler);
        window.addEventListener('online', this.onlineSyncHandler);

        this.coinSyncInterval = window.setInterval(() => {
            this.refreshCoinsFromCloud({ silent: true });
        }, COIN_SYNC_INTERVAL_MS);

        if (typeof supabaseService.subscribeToStudentProgress === 'function') {
            this.coinRealtimeUnsubscribe = supabaseService.subscribeToStudentProgress(userId, progress => {
                this.applyRemoteCoinProgress(progress);
            });
        }

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

    applyRemoteCoinProgress(progress) {
        if (!progress) return;
        const cloudCoinData = this.migrateCoinData(progress);

        if (this.hasAuthoritativeLocalCoinActivity(cloudCoinData.coinHistory, progress.updatedAt)) {
            this.saveProgressToCloud();
            return;
        }

        this.applyCoinSnapshot(cloudCoinData.coinData, cloudCoinData.coinHistory, { saveLocal: true });
        this.sm.setAuthStatus('☁️ Synced');
    }

    async refreshCoinsFromCloud(options = {}) {
        if (this.sm.authDisabled || !this.sm.currentUser) return;

        try {
            const db = supabaseService.getDatabase();
            const docRef = doc(db, 'studentProgress', this.sm.currentUser.uid);
            const snapshot = await getDoc(docRef);
            if (!snapshot.exists()) return;
            this.applyRemoteCoinProgress(snapshot.data());
        } catch (error) {
            if (!options.silent) {
                console.warn('Could not refresh coins from cloud:', error);
            }
        }
    }

    async loadCloudProgress() {
        if (this.sm.authDisabled) return;
        if (!this.sm.currentUser) return;
        try {
            const db = supabaseService.getDatabase();
            const docRef = doc(db, 'studentProgress', this.sm.currentUser.uid);
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                const data = snapshot.data();
                const cloudCoinData = this.migrateCoinData(data);
                const cloudGiftCoins = cloudCoinData.coinData.giftCoins || 0;
                const localGiftCoins = this.sm.coinData.giftCoins || 0;
                const localHasAuthority = this.hasAuthoritativeLocalCoinActivity(
                    cloudCoinData.coinHistory,
                    data.updatedAt
                );
                const mergedHistory = localHasAuthority
                    ? this.mergeCoinHistories(cloudCoinData.coinHistory, this.sm.coinHistory)
                    : cloudCoinData.coinHistory;

                this.sm.coinData = localHasAuthority
                    ? this.normalizeCoinData({
                        ...this.sm.coinData,
                        giftCoins: cloudGiftCoins,
                        totalEarned: Math.max(this.sm.coinData.totalEarned, cloudCoinData.coinData.totalEarned),
                        totalSpent: Math.max(this.sm.coinData.totalSpent, cloudCoinData.coinData.totalSpent),
                        totalGifted: Math.max(this.sm.coinData.totalGifted, cloudCoinData.coinData.totalGifted)
                    })
                    : cloudCoinData.coinData;
                this.sm.coinHistory = mergedHistory;

                // Check for new gifts
                if (cloudGiftCoins > localGiftCoins) {
                    this.sm.showNotificationBadge();
                    // Don't auto-accept, wait for user to click accept
                }

                // Legacy support
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
                this.saveLocalProgress(true);

                if (localHasAuthority) {
                    await this.saveProgressToCloud();
                } else {
                    this.sm.setAuthStatus('☁️ Synced');
                }
            } else {
                // New user or no cloud data - Welcome Bonus
                if (this.sm.coinData.balance === 0) {
                    this.sm.coinData.balance = 100;
                    this.sm.coinData.totalEarned = 100;
                    this.sm.addCoinHistory('earn', 100, 'welcome', 'Welcome bonus!');
                    this.sm.coins = 100; // Legacy
                    this.sm.updateCoinDisplay();
                    this.sm.showToast('🎉 Welcome! You received 100 starting coins!');
                    this.saveLocalProgress();
                    await this.saveProgressToCloud();
                }
                this.sm.setAuthStatus('☁️ Ready');
            }
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
            const db = supabaseService.getDatabase();
            const docRef = doc(db, 'studentProgress', this.sm.currentUser.uid);

            // Get current cloud data first to prevent overwriting newer data
            const snapshot = await getDoc(docRef);
            let cloudCoinData = null;
            let cloudUpdatedAt = null;
            if (snapshot.exists()) {
                const data = snapshot.data();
                cloudCoinData = this.migrateCoinData(data);
                cloudUpdatedAt = data.updatedAt;
            }

            const cloudHistory = cloudCoinData?.coinHistory || [];
            const localHasAuthority = this.hasAuthoritativeLocalCoinActivity(cloudHistory, cloudUpdatedAt);
            const localUnsynced = this.getUnsyncedLocalCoinHistory(cloudHistory);
            const recentLocalAccept = localUnsynced.some(entry => entry.type === 'accept');
            const cloudCoins = cloudCoinData?.coinData || { ...DEFAULT_COIN_DATA };
            const mergedBalance = !cloudCoinData || localHasAuthority
                ? this.sm.coinData.balance
                : cloudCoins.balance;
            const mergedGiftCoins = recentLocalAccept && this.sm.coinData.giftCoins === 0
                ? 0
                : Math.max(this.sm.coinData.giftCoins, cloudCoins.giftCoins || 0);
            
            const mergedCoinData = {
                balance: mergedBalance,
                giftCoins: mergedGiftCoins,
                totalEarned: Math.max(this.sm.coinData.totalEarned, cloudCoins.totalEarned || 0),
                totalSpent: Math.max(this.sm.coinData.totalSpent, cloudCoins.totalSpent || 0),
                totalGifted: Math.max(this.sm.coinData.totalGifted, cloudCoins.totalGifted || 0)
            };

            const mergedHistory = this.mergeCoinHistories(cloudHistory, this.sm.coinHistory);

            const payload = {
                studentProfile: this.sm.studentProfile,
                units: this.sm.progressData.units || {},
                coins: mergedCoinData.balance, // Legacy support
                coinData: mergedCoinData,
                coinHistory: mergedHistory,
                email: this.sm.currentUser?.email || this.sm.studentProfile.email || '',
                role: this.sm.currentRole || 'student',
                updatedAt: serverTimestamp()
            };
            await setDoc(docRef, payload, { merge: true });

            // Update local
            this.sm.coinData = mergedCoinData;
            this.sm.coinHistory = mergedHistory;
            this.sm.coins = this.sm.coinData.balance; // Legacy
            this.sm.updateCoinDisplay();
            this.saveLocalProgress(true);

            this.sm.setAuthStatus('☁️ Synced');
        } catch (error) {
            console.error('Failed to save progress to cloud:', error);
            await this.enqueueProgressSync();
            this.sm.setAuthStatus(navigator.onLine ? '⚠️ Sync failed - saved locally' : 'Saved locally - offline');
        }
    }

    buildProgressSyncPayload() {
        return {
            studentProfile: this.sm.studentProfile,
            units: this.sm.progressData.units || {},
            coins: this.sm.coinData.balance,
            coinData: this.normalizeCoinData(this.sm.coinData),
            coinHistory: this.normalizeCoinHistory(this.sm.coinHistory),
            email: this.sm.currentUser?.email || this.sm.studentProfile.email || '',
            role: this.sm.currentRole || 'student'
        };
    }

    async enqueueProgressSync() {
        try {
            await imageDB.enqueueSyncAction('student-progress', this.buildProgressSyncPayload());
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
                if (record.type === 'student-progress') {
                    const db = supabaseService.getDatabase();
                    const docRef = doc(db, 'studentProgress', this.sm.currentUser.uid);
                    await setDoc(docRef, {
                        ...(record.payload || {}),
                        updatedAt: serverTimestamp()
                    }, { merge: true });
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
