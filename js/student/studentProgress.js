/**
 * Student Progress & Coin Management Module
 * Handles progress saving/loading (local & cloud) and coin operations
 */

import { $ } from '../main.js';
import { notifications } from '../notifications.js';
import { supabaseService, doc, getDoc, setDoc, serverTimestamp } from '../supabaseService.js';
import { imageDB } from '../db.js';

const DEFAULT_COIN_DATA = {
    balance: 0,
    giftCoins: 0,
    totalEarned: 0,
    totalSpent: 0,
    totalGifted: 0
};

const COIN_SYNC_INTERVAL_MS = 30000;
const LOCAL_COIN_AUTHORITY_MS = 15000;

export class StudentProgress {
    constructor(studentManager) {
        this.sm = studentManager;
        this.coinRealtimeUnsubscribe = null;
        this.coinSyncInterval = null;
        this.storageSyncHandler = null;
        this.focusSyncHandler = null;
        this.visibilitySyncHandler = null;
        this.onlineSyncHandler = null;
        this.clientId = sessionStorage.getItem('student_coin_client_id') ||
            (crypto.randomUUID ? crypto.randomUUID() : `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
        sessionStorage.setItem('student_coin_client_id', this.clientId);
    }

    migrateCoinData(data) {
        // If already new format, return as-is
        if (data.coinData) {
            return {
                coinData: this.normalizeCoinData(data.coinData),
                coinHistory: this.normalizeCoinHistory(data.coinHistory || [])
            };
        }

        // Migrate from old format
        const oldCoins = data.coins || 0;
        return {
            coinData: this.normalizeCoinData({
                balance: oldCoins,
                giftCoins: 0,
                totalEarned: oldCoins, // Estimate - assume all were earned
                totalSpent: 0,
                totalGifted: 0
            }),
            coinHistory: []
        };
    }

    normalizeCoinData(coinData = {}) {
        return {
            balance: Number(coinData.balance) || 0,
            giftCoins: Number(coinData.giftCoins) || 0,
            totalEarned: Number(coinData.totalEarned) || 0,
            totalSpent: Number(coinData.totalSpent) || 0,
            totalGifted: Number(coinData.totalGifted) || 0
        };
    }

    normalizeTimestamp(timestamp) {
        const date = timestamp ? new Date(timestamp) : new Date();
        return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    }

    coinHistoryFingerprint(entry = {}) {
        return [
            entry.type || '',
            Number(entry.amount) || 0,
            entry.source || '',
            entry.description || '',
            entry.timestamp || ''
        ].join('|');
    }

    normalizeCoinHistory(history = []) {
        if (!Array.isArray(history)) return [];

        const byKey = new Map();
        history.forEach(entry => {
            if (!entry || typeof entry !== 'object') return;
            const normalized = {
                id: entry.id || '',
                type: entry.type || 'earn',
                amount: Number(entry.amount) || 0,
                source: entry.source || 'activity',
                description: entry.description || '',
                timestamp: this.normalizeTimestamp(entry.timestamp),
                clientId: entry.clientId || ''
            };
            normalized.id = normalized.id || `legacy-${this.coinHistoryFingerprint(normalized)}`;
            byKey.set(normalized.id, normalized);
        });

        return Array.from(byKey.values())
            .sort((a, b) => this.timestampMs(a.timestamp) - this.timestampMs(b.timestamp))
            .slice(-100);
    }

    mergeCoinHistories(...histories) {
        return this.normalizeCoinHistory(histories.flat());
    }

    timestampMs(value) {
        if (!value) return 0;
        if (typeof value === 'object' && value.seconds !== undefined) return value.seconds * 1000;
        if (typeof value.toDate === 'function') return value.toDate().getTime();
        const parsed = new Date(value).getTime();
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    latestCoinHistoryMs(history = this.sm.coinHistory) {
        return this.normalizeCoinHistory(history).reduce((latest, entry) => {
            return Math.max(latest, this.timestampMs(entry.timestamp));
        }, 0);
    }

    getUnsyncedLocalCoinHistory(cloudHistory = []) {
        const cloudKeys = new Set(this.normalizeCoinHistory(cloudHistory).map(entry => entry.id));
        return this.normalizeCoinHistory(this.sm.coinHistory).filter(entry => !cloudKeys.has(entry.id));
    }

    hasAuthoritativeLocalCoinActivity(cloudHistory = [], cloudUpdatedAt = null) {
        const unsynced = this.getUnsyncedLocalCoinHistory(cloudHistory);
        if (unsynced.length === 0) return false;

        const newestUnsynced = this.latestCoinHistoryMs(unsynced);
        const cloudUpdated = this.timestampMs(cloudUpdatedAt);
        const isFresh = Date.now() - newestUnsynced <= LOCAL_COIN_AUTHORITY_MS;

        return isFresh || newestUnsynced > cloudUpdated;
    }

    loadLocalProgress() {
        try {
            const saved = localStorage.getItem('student_progress');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object') {
                    this.sm.progressData = parsed;
                    if (this.sm.progressData.studentProfile && typeof this.sm.progressData.studentProfile === 'object') {
                        this.sm.studentProfile = this.sm.mergeStudentProfile(
                            this.sm.studentProfile,
                            this.sm.progressData.studentProfile
                        );
                        this.sm.progressData.studentProfile = this.sm.studentProfile;
                    }
                    
                    // Migrate coin data
                    const migrated = this.migrateCoinData(parsed);
                    this.sm.coinData = migrated.coinData;
                    this.sm.coinHistory = migrated.coinHistory;
                    
                    // Legacy support
                    this.sm.coins = this.sm.coinData.balance;
                    this.sm.updateCoinDisplay();
                }
            }
        } catch (e) {
            console.error('Error loading progress:', e);
            // Reset if corrupt
            this.sm.progressData = { studentProfile: {}, units: {} };
            this.sm.coinData = { ...DEFAULT_COIN_DATA };
            this.sm.coinHistory = [];
        }
    }

    saveLocalProgress(skipCloud = false) {
        try {
            this.sm.progressData.studentProfile = this.sm.studentProfile;
            this.sm.coinData = this.normalizeCoinData(this.sm.coinData);
            this.sm.coinHistory = this.normalizeCoinHistory(this.sm.coinHistory);
            // Save both old and new format for compatibility
            this.sm.coins = this.sm.coinData.balance; // Legacy support
            this.sm.progressData.coins = this.sm.coins;
            this.sm.progressData.coinData = this.sm.coinData;
            this.sm.progressData.coinHistory = this.sm.coinHistory;
            localStorage.setItem('student_progress', JSON.stringify(this.sm.progressData));
            if (!skipCloud) {
                this.sm.scheduleCloudSync();
            }
        } catch (e) {
            console.error('Error saving progress:', e);
        }
    }

    applyCoinSnapshot(coinData, coinHistory, options = {}) {
        const normalizedCoinData = this.normalizeCoinData(coinData);
        const normalizedHistory = this.normalizeCoinHistory(coinHistory || this.sm.coinHistory);

        this.sm.coinData = normalizedCoinData;
        this.sm.coinHistory = normalizedHistory;
        this.sm.coins = normalizedCoinData.balance;
        this.sm.progressData.coinData = normalizedCoinData;
        this.sm.progressData.coinHistory = normalizedHistory;
        this.sm.progressData.coins = normalizedCoinData.balance;
        this.sm.updateCoinDisplay();

        if (options.saveLocal) {
            this.saveLocalProgress(true);
        }
    }

    shouldApplyIncomingLocalCoins(data) {
        const incoming = this.migrateCoinData(data || {});
        const incomingLatest = this.latestCoinHistoryMs(incoming.coinHistory);
        const currentLatest = this.latestCoinHistoryMs(this.sm.coinHistory);

        if (incomingLatest > currentLatest) return true;
        if (incomingLatest < currentLatest) return false;

        const incomingCoins = incoming.coinData;
        if (incomingCoins.balance < this.sm.coinData.balance) return false;
        return (
            incomingCoins.balance !== this.sm.coinData.balance ||
            incomingCoins.giftCoins !== this.sm.coinData.giftCoins ||
            incomingCoins.totalEarned !== this.sm.coinData.totalEarned ||
            incomingCoins.totalSpent !== this.sm.coinData.totalSpent ||
            incomingCoins.totalGifted !== this.sm.coinData.totalGifted
        );
    }

    applyLocalProgressFromStorage(rawValue) {
        if (!rawValue) return;

        try {
            const parsed = JSON.parse(rawValue);
            if (!this.shouldApplyIncomingLocalCoins(parsed)) return;

            const incoming = this.migrateCoinData(parsed);
            this.applyCoinSnapshot(incoming.coinData, incoming.coinHistory);
        } catch (error) {
            console.warn('Ignored invalid local coin sync payload:', error);
        }
    }

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
        this.onlineSyncHandler = () => this.refreshCoinsFromCloud({ silent: true });
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
            this.sm.setAuthStatus('⚠️ Cloud save failed');
        }
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

    addCoinHistory(type, amount, source, description = '') {
        const timestamp = new Date().toISOString();
        this.sm.coinHistory.push({
            id: `${this.clientId}-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
            type,
            amount,
            source,
            description,
            timestamp,
            clientId: this.clientId
        });
        // Keep only last 100 entries
        this.sm.coinHistory = this.normalizeCoinHistory(this.sm.coinHistory);
    }

    addCoins(amount, source = 'activity', description = '') {
        this.sm.coinData.balance += amount;
        this.sm.coinData.totalEarned += amount;
        this.sm.coins = this.sm.coinData.balance; // Legacy support
        this.addCoinHistory('earn', amount, source, description);
        this.sm.updateCoinDisplay();
        this.saveLocalProgress();

        // Visual feedback
        const coinEl = $('#coin-balance');
        if (coinEl) {
            coinEl.classList.add('pulse');
            setTimeout(() => coinEl.classList.remove('pulse'), 500);
        }
    }

    async deductCoins(amount) {
        if (this.sm.coinData.balance >= amount) {
            this.sm.coinData.balance -= amount;
            this.sm.coinData.totalSpent += amount;
            this.sm.coins = this.sm.coinData.balance; // Legacy support
            this.addCoinHistory('spend', amount, 'game', 'Spent on game');
            this.sm.updateCoinDisplay();
            this.saveLocalProgress();
            
            // Immediately save to cloud to prevent sync issues
            try {
                await this.saveProgressToCloud();
            } catch (error) {
                console.error('Error saving coin deduction to cloud:', error);
            }
            
            return true;
        }
        return false;
    }

    async acceptGiftCoins() {
        if (this.sm.authDisabled) {
            this.sm.hideNotificationBadge();
            return;
        }

        if (this.sm.coinData.giftCoins <= 0) {
            this.sm.hideNotificationBadge();
            return;
        }

        const amount = this.sm.coinData.giftCoins;
        
        // Immediately hide badge to prevent multiple clicks
        this.sm.hideNotificationBadge();
        
        // Update coin data
        this.sm.coinData.balance += amount;
        this.sm.coinData.totalGifted += amount;
        this.addCoinHistory('accept', amount, 'teacher', 'Accepted gift from teacher');
        
        // Reset giftCoins BEFORE saving
        this.sm.coinData.giftCoins = 0;
        this.sm.coins = this.sm.coinData.balance; // Legacy support
        
        // Update display immediately
        this.sm.updateCoinDisplay();
        this.sm.showToast(`🎉 You received ${amount} coins!`);
        
        // Save to cloud immediately with giftCoins = 0
        try {
            const db = supabaseService.getDatabase();
            const docRef = doc(db, 'studentProgress', this.sm.currentUser.uid);
            
            const snapshot = await getDoc(docRef);
            let cloudHistory = [];
            if (snapshot.exists()) {
                const data = snapshot.data();
                cloudHistory = this.migrateCoinData(data).coinHistory;
            }
            const mergedHistory = this.mergeCoinHistories(cloudHistory, this.sm.coinHistory);
            
            await setDoc(docRef, {
                coinData: {
                    balance: this.sm.coinData.balance,
                    giftCoins: 0, // Explicitly set to 0
                    totalEarned: this.sm.coinData.totalEarned,
                    totalSpent: this.sm.coinData.totalSpent,
                    totalGifted: this.sm.coinData.totalGifted
                },
                coinHistory: mergedHistory,
                coins: this.sm.coinData.balance, // Legacy support
                updatedAt: serverTimestamp()
            }, { merge: true });
            
            this.sm.coinHistory = mergedHistory;
            this.saveLocalProgress(true);
            this.sm.setAuthStatus('☁️ Synced');
        } catch (error) {
            console.error('Error saving after accepting coins:', error);
            // If save fails, restore the gift coins so user can try again
            this.sm.coinData.giftCoins = amount;
            this.sm.coinData.balance -= amount;
            this.sm.coinData.totalGifted -= amount;
            this.sm.coins = this.sm.coinData.balance;
            this.sm.updateCoinDisplay();
            this.sm.showToast('Error saving. Please try again.', 5000);
        }
    }

    updateCoinDisplay() {
        const coinEl = $('#coin-balance');
        if (coinEl) {
            coinEl.textContent = `🪙 ${this.sm.coinData.balance} `;
            coinEl.style.display = (this.sm.currentUser || this.sm.authDisabled) ? 'flex' : 'none';
        }
        
        // Update notification badge
        if (this.sm.coinData.giftCoins > 0) {
            this.sm.showNotificationBadge();
        } else {
            this.sm.hideNotificationBadge();
        }
    }
}
