import {
    DEFAULT_COIN_DATA,
    LOCAL_COIN_AUTHORITY_MS
} from './studentProgressConstants.js';
import { getStudentExperience } from './studentExperience.js';

class StudentProgressCoreMethods {
    getExperience() {
        return getStudentExperience(this.sm.progressData);
    }

    updateLevelDisplay() {
        const levelDisplay = document.querySelector('#student-level-display');
        if (!levelDisplay) return;

        const experience = this.getExperience();
        levelDisplay.textContent = `Level ${experience.level} Explorer`;
        levelDisplay.title = `${experience.completedCount} activities completed | ${experience.totalXp} XP total | ${experience.xpIntoLevel}/${experience.xpPerLevel} XP toward next level`;
        levelDisplay.setAttribute(
            'aria-label',
            `Level ${experience.level} Explorer. ${experience.completedCount} activities completed. ${experience.xpIntoLevel} of ${experience.xpPerLevel} experience points toward the next level.`
        );
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
                    this.updateLevelDisplay();
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
            this.updateLevelDisplay();
            if (!navigator.onLine && this.sm.currentUser) {
                this.sm.setAuthStatus('Saved locally - offline');
            }
            if (!skipCloud) {
                this.sm.scheduleCloudSync();
            }
        } catch (e) {
            console.error('Error saving progress:', e);
        }
    }

    applyCoinSnapshot(coinData, coinHistory, options = {}) {
        this.sm.logStudentDomUpdate?.('student-progress', { source: 'applyCoinSnapshot' });
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

    applyProgressSnapshot(progress, options = {}) {
        if (!progress) return;
        this.sm.logStudentDomUpdate?.('student-progress', { source: 'applyProgressSnapshot' });

        const migrated = this.migrateCoinData(progress);
        const mergedStudentProfile = typeof this.sm.mergeStudentProfile === 'function'
            ? this.sm.mergeStudentProfile(this.sm.studentProfile, progress.studentProfile || {})
            : (progress.studentProfile || this.sm.studentProfile || {});

        this.sm.studentProfile = mergedStudentProfile;
        this.sm.progressData = {
            studentProfile: mergedStudentProfile,
            units: progress.units || {},
            coins: migrated.coinData.balance,
            coinData: migrated.coinData,
            coinHistory: migrated.coinHistory
        };
        this.sm.coinData = migrated.coinData;
        this.sm.coinHistory = migrated.coinHistory;
        this.sm.coins = migrated.coinData.balance;

        if (this.sm.currentVocab && this.sm.activities?.getUnitProgressKey) {
            const unitKey = this.sm.activities.getUnitProgressKey(this.sm.currentVocab);
            const unitProgress = this.sm.progressData.units?.[unitKey];
            if (unitProgress) {
                this.sm.unitScores = unitProgress.scores || {};
                this.sm.unitImages = unitProgress.images || {};
                this.sm.unitWordHunt = unitProgress.wordHunt || {};
                this.sm.unitStates = unitProgress.states || {};
            }
        }

        this.sm.updateCoinDisplay();
        this.updateLevelDisplay();
        if (options.saveLocal !== false) {
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
}

export function installStudentProgressCoreMethods(StudentProgress) {
    for (const name of Object.getOwnPropertyNames(StudentProgressCoreMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentProgress.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentProgressCoreMethods.prototype, name)
        );
    }
}
