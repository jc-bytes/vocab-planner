import { $ } from '../main.js';
import { studentApi as supabaseService } from '../services/studentApi.js';

class StudentProgressCoinMethods {
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
        if (this.sm.authDisabled) {
            if (this.sm.coinData.balance < amount) return false;
            this.sm.coinData.balance -= amount;
            this.sm.coinData.totalSpent += amount;
            this.sm.coins = this.sm.coinData.balance;
            this.addCoinHistory('spend', amount, 'game', 'Spent on game');
            this.sm.updateCoinDisplay();
            this.saveLocalProgress(true);
            return true;
        }

        if (!this.sm.currentUser || this.sm.coinData.balance < amount) return false;

        try {
            const progress = await supabaseService.spendStudentCoins({
                amount,
                source: 'game',
                description: 'Spent on game',
                clientId: this.clientId
            });
            this.applyProgressSnapshot(progress, { saveLocal: true });
            this.sm.setAuthStatus('☁️ Synced');
            return true;
        } catch (error) {
            console.error('Error spending coins:', error);
            this.sm.setAuthStatus(navigator.onLine ? '⚠️ Could not spend coins' : 'Saved locally - offline');
            return false;
        }
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

        try {
            const progress = await supabaseService.acceptStudentGiftCoins({ clientId: this.clientId });
            this.applyProgressSnapshot(progress, { saveLocal: true });
            this.sm.showToast(`🎉 You received ${amount} coins!`);
            this.sm.setAuthStatus('☁️ Synced');
        } catch (error) {
            console.error('Error saving after accepting coins:', error);
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

export function installStudentProgressCoinMethods(StudentProgress) {
    for (const name of Object.getOwnPropertyNames(StudentProgressCoinMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentProgress.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentProgressCoinMethods.prototype, name)
        );
    }
}
