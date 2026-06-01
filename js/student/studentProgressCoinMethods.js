import { $ } from '../main.js';
import { studentApi as supabaseService, doc, getDoc, setDoc, serverTimestamp } from '../services/studentApi.js';

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
