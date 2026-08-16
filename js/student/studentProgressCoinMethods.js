import { $ } from '../main.js';
import { studentApi as supabaseService } from '../services/studentApi.js';

export class StudentProgressCoins {
    constructor(progress) {
        this.progress = progress;
        this.sm = progress.sm;
    }

    addCoinHistory(type, amount, source, description = '') {
        const timestamp = new Date().toISOString();
        this.sm.coinHistory.push({
            id: `${this.progress.clientId}-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
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

    addCoins(amount, source = 'activity', description = '') {
        this.sm.coinData.balance += amount;
        this.sm.coinData.totalEarned += amount;
        this.sm.coins = this.sm.coinData.balance; // Legacy support
        this.addCoinHistory('earn', amount, source, description);
        this.sm.updateCoinDisplay();
        this.progress.saveLocalProgress();

        // Visual feedback
        const coinEl = $('#coin-balance');
        if (coinEl) {
            coinEl.classList.add('pulse');
            setTimeout(() => coinEl.classList.remove('pulse'), 500);
        }
    }

    async deductCoins(amount) {
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
            });
            this.progress.applyProgressSnapshot(progress, { saveLocal: true });
            this.sm.setAuthStatus('Synced');
            return true;
        } catch (error) {
            console.error('Error spending coins:', error);
            this.sm.setAuthStatus(navigator.onLine ? 'Could not spend coins' : 'Saved locally - offline');
            return false;
        }
    }

    async acceptGiftCoins() {
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
            const progress = await supabaseService.acceptStudentGiftCoins({ clientId: this.progress.clientId });
            this.progress.applyProgressSnapshot(progress, { saveLocal: true });
            this.sm.showToast(`You received ${amount} coins!`);
            this.sm.setAuthStatus('Synced');
        } catch (error) {
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
                window.lucide?.createIcons({ root: coinEl });
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
