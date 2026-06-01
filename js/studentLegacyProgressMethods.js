import { notifications } from './main.js';
import { studentApi as supabaseService, doc, getDoc } from './services/studentApi.js';

class StudentLegacyProgressMethods {
    async _loadCloudProgress_OLD() {
        if (!this.currentUser) return;
        try {
            const db = supabaseService.getDatabase();
            const docRef = doc(db, 'studentProgress', this.currentUser.uid);
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                const data = snapshot.data();

                // Migrate coin data from cloud
                const cloudCoinData = this.progress.migrateCoinData(data);
                const cloudGiftCoins = cloudCoinData.coinData.giftCoins || 0;
                const localGiftCoins = this.coinData.giftCoins || 0;

                // Merge coin data - preserve local earned/spent, but use cloud giftCoins
                // For balance: if we have recent local transactions, prefer local (more recent)
                // Otherwise, use max to prevent losing coins
                const localRecentTransactions = this.coinHistory.slice(-10).some(h => 
                    h.type === 'spend' || h.type === 'earn' || h.type === 'accept'
                );
                const mergedBalance = localRecentTransactions 
                    ? this.coinData.balance  // Use local if we have recent activity
                    : Math.max(this.coinData.balance, cloudCoinData.coinData.balance);
                
                this.coinData = {
                    balance: mergedBalance,
                    giftCoins: cloudGiftCoins, // Always use cloud giftCoins (teacher updates)
                    totalEarned: Math.max(this.coinData.totalEarned, cloudCoinData.coinData.totalEarned),
                    totalSpent: Math.max(this.coinData.totalSpent, cloudCoinData.coinData.totalSpent),
                    totalGifted: Math.max(this.coinData.totalGifted, cloudCoinData.coinData.totalGifted)
                };

                // Check for new gifts
                if (cloudGiftCoins > localGiftCoins) {
                    const newGifts = cloudGiftCoins - localGiftCoins;
                    this.showNotificationBadge();
                    // Don't auto-accept, wait for user to click accept
                }

                // Legacy support
                this.coins = this.coinData.balance;

                this.progressData = {
                    studentProfile: data.studentProfile || this.studentProfile,
                    units: data.units || {},
                    coins: this.coins,
                    coinData: this.coinData,
                    coinHistory: data.coinHistory || this.coinHistory || []
                };
                this.coinHistory = this.progressData.coinHistory;
                this.progress.updateCoinDisplay();
                this.studentProfile = this.progressData.studentProfile || this.studentProfile;
                await this.progress.restoreImagesFromProgress();
                this.progress.saveLocalProgress(true);

                // Sync if local balance is higher
                if (this.coinData.balance > cloudCoinData.coinData.balance) {
                    await this.progress.saveProgressToCloud();
                } else {
                    this.auth.setAuthStatus('☁️ Synced');
                }
            } else {
                // New user or no cloud data - Welcome Bonus
                if (this.coinData.balance === 0) {
                    this.coinData.balance = 100;
                    this.coinData.totalEarned = 100;
                    this.progress.addCoinHistory('earn', 100, 'welcome', 'Welcome bonus!');
                    this.coins = 100; // Legacy
                    this.progress.updateCoinDisplay();
                    this.showToast('🎉 Welcome! You received 100 starting coins!');
                    this.progress.saveLocalProgress();
                    await this.progress.saveProgressToCloud();
                }
                this.auth.setAuthStatus('☁️ Ready');
            }
        } catch (error) {
            console.error('Failed to load cloud progress:', error);
            this.auth.setAuthStatus('⚠️ Cloud load failed');
            notifications.warning('Could not load progress from cloud. Using local data.');
        }
    }
}

export function installStudentLegacyProgressMethods(StudentManager) {
    for (const name of Object.getOwnPropertyNames(StudentLegacyProgressMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentLegacyProgressMethods.prototype, name)
        );
    }
}
