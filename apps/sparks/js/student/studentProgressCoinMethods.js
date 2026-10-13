import { getActiveStudentStorageOwner, normalizeStudentOwnerId } from './persistence/studentStorage.js';
import { $, refreshIcons } from '../main.js';
import { studentApi as supabaseService } from '../services/studentApi.js';
import { createUniqueId } from '../randomUtils.js';

export function captureCoinSession(progress) {
    const { sm, cloud } = progress;
    const owner = normalizeStudentOwnerId(sm.currentUser);
    const storageOwner = getActiveStudentStorageOwner();
    const generation = cloud?.cloudGeneration;
    const local = sm.authDisabled;
    return () => sm.progress === progress && progress.cloud === cloud && cloud?.cloudGeneration === generation
        && sm.authDisabled === local && normalizeStudentOwnerId(sm.currentUser) === owner
        && getActiveStudentStorageOwner() === storageOwner && (local || owner && owner === storageOwner);
}

export class StudentProgressCoins {
    constructor(progress) {
        this.progress = progress;
        this.sm = progress.sm;
    }

    addCoinHistory(type, amount, source, description = '') {
        const timestamp = new Date().toISOString();
        this.sm.coinHistory.push({
            id: createUniqueId(`${this.progress.clientId}-${timestamp}-`),
            type,
            amount,
            source,
            description,
            timestamp,
            clientId: this.progress.clientId
        });
        // Keep only last 100 entries
        this.sm.coinHistory = this.progress.normalizeCoinHistory(this.sm.coinHistory);
    }

    addCoins(amount, source = 'activity', description = '', options = {}) {
        this.sm.coinData.balance += amount;
        this.sm.coinData.totalEarned += amount;
        this.sm.coins = this.sm.coinData.balance; // Legacy support
        this.addCoinHistory('earn', amount, source, description);
        this.sm.updateCoinDisplay();
        this.progress.saveLocalProgress(Boolean(options.skipCloud));

        // Visual feedback
        const coinEl = $('#coin-balance');
        if (coinEl) {
            coinEl.classList.add('pulse');
            setTimeout(() => coinEl.classList.remove('pulse'), 500);
        }
    }

    async deductCoins(amount) {
        const isCurrent = captureCoinSession(this.progress);
        if (!isCurrent()) return false;
        if (this.sm.authDisabled) {
            if (this.sm.coinData.balance < amount) return false;
            this.sm.coinData.balance -= amount;
            this.sm.coinData.totalSpent += amount;
            this.sm.coins = this.sm.coinData.balance;
            this.addCoinHistory('spend', amount, 'game', 'Spent on game');
            this.sm.updateCoinDisplay();
            this.progress.saveLocalProgress(true);
            return true;
        }

        if (!this.sm.currentUser || this.sm.coinData.balance < amount) return false;

        try {
            const progress = await supabaseService.spendStudentCoins({
                amount,
                source: 'game',
                description: 'Spent on game',
                clientId: this.progress.clientId
            }, { isCurrent });
            if (!isCurrent()) return false;
            this.progress.cloud.applyRemoteCoinProgress(progress);
            this.sm.setAuthStatus('Synced');
            return true;
        } catch (error) {
            if (!isCurrent()) return false;
            console.error('Error spending coins:', error);
            this.sm.setAuthStatus(navigator.onLine ? 'Could not spend coins' : 'Saved locally - offline');
            return false;
        }
    }

    async acceptGiftCoins() {
        const isCurrent = captureCoinSession(this.progress);
        if (!isCurrent()) return;
        if (this.sm.authDisabled) {
            this.progress.hideNotificationBadge();
            return;
        }

        if (this.sm.coinData.giftCoins <= 0) {
            this.progress.hideNotificationBadge();
            return;
        }

        const amount = this.sm.coinData.giftCoins;

        // Immediately hide badge to prevent multiple clicks
        this.progress.hideNotificationBadge();

        try {
            const progress = await supabaseService.acceptStudentGiftCoins({ clientId: this.progress.clientId }, { isCurrent });
            if (!isCurrent()) return;
            this.progress.cloud.applyRemoteCoinProgress(progress);
            this.sm.showToast(`You received ${amount} coins!`);
            this.sm.setAuthStatus('Synced');
        } catch (error) {
            if (!isCurrent()) return;
            console.error('Error saving after accepting coins:', error);
            this.sm.updateCoinDisplay();
            this.sm.showToast('Error saving. Please try again.', 5000);
        }
    }

    updateCoinDisplay() {
        this.sm.logStudentDomUpdate?.('coin-balance', { source: 'updateCoinDisplay' });
        const coinEl = $('#coin-balance');
        if (coinEl) {
            let balanceValue = coinEl.querySelector?.('[data-coin-balance-value]');
            if (!balanceValue) {
                coinEl.innerHTML = '<i data-lucide="coins" aria-hidden="true"></i><span class="student-coin-label">Coins</span><span data-coin-balance-value></span>';
                balanceValue = coinEl.querySelector?.('[data-coin-balance-value]');
                refreshIcons(coinEl);
            }
            if (balanceValue) balanceValue.textContent = String(this.sm.coinData.balance);
            coinEl.style.display = (this.sm.currentUser || this.sm.authDisabled) ? 'flex' : 'none';
        }

        // Update notification badge
        if (this.sm.coinData.giftCoins > 0) {
            this.progress.showNotificationBadge();
        } else {
            this.progress.hideNotificationBadge();
        }
    }
}
