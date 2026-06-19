import { $ } from '../main.js';
import { doc, getDoc, studentApi as supabaseService } from '../services/studentApi.js';

class StudentGameSettingsMethods {
    formatTime(seconds) {
        if (!seconds) return '0s';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0) {
            return `${mins}m ${secs}s`;
        }
        return `${secs}s`;
    }

    async loadGlobalSettings() {
        // Return cached settings if available
        if (this.globalSettings) return this.globalSettings;

        if (this.sm.authDisabled) {
            try {
                const localSettings = JSON.parse(localStorage.getItem('dev_gamification_settings') || '{}');
                this.globalSettings = {
                    exchangeRate: localSettings.exchangeRate || 10,
                    completionBonus: localSettings.completionBonus || 50,
                    progressReward: localSettings.progressReward || 1
                };
            } catch (error) {
                console.error('Error loading local gamification settings:', error);
                this.globalSettings = {
                    exchangeRate: 10,
                    completionBonus: 50,
                    progressReward: 1
                };
            }
            return this.globalSettings;
        }

        try {
            const db = supabaseService.getDatabase();
            const settingsRef = doc(db, 'appSettings', 'gamification');
            const settingsSnap = await getDoc(settingsRef);
            
            if (settingsSnap.exists()) {
                this.globalSettings = settingsSnap.data();
            } else {
                // Default settings if none exist
                this.globalSettings = {
                    exchangeRate: 10,
                    completionBonus: 50,
                    progressReward: 1
                };
            }
        } catch (error) {
            console.error('Error loading global gamification settings:', error);
            // Fallback to defaults
            this.globalSettings = {
                exchangeRate: 10,
                completionBonus: 50,
                progressReward: 1
            };
        }

        return this.globalSettings;
    }

    getExchangeRate() {
        // Return cached value or default
        return this.globalSettings?.exchangeRate || 10;
    }

    async updateArcadeUI() {
        // Load global settings
        await this.loadGlobalSettings();
        const exchangeRate = this.getExchangeRate();

        const costEl = $('#galactic-breaker-cost');
        if (costEl) costEl.textContent = `${exchangeRate} Coins / min`;

        const addTimeBtn = $('#add-time-btn');
        if (addTimeBtn) addTimeBtn.textContent = `+1 Min (${exchangeRate} Coins)`;
    }

    async updateGameSelectionUI() {
        const game = this.sm.gamesList[this.sm.currentGameIndex];
        const container = $('#current-game-card');
        if (!container) return;

        // Load global settings
        await this.loadGlobalSettings();
        const exchangeRate = this.getExchangeRate();
        
        // Game counter (e.g., "3/20")
        const currentNum = this.sm.currentGameIndex + 1;
        const totalGames = this.sm.gamesList.length;
        const totalEl = $('#arcade-game-total');
        if (totalEl) totalEl.textContent = totalGames;

        container.innerHTML = `
            <div class="game-counter">Game ${currentNum} of ${totalGames}</div>
            <div class="game-icon" aria-hidden="true">${game.icon}</div>
            <div class="game-card-copy">
                <h3>${game.name}</h3>
                <p>${game.desc}</p>
            </div>
            <div class="game-cost"><span>Play rate</span><strong>${exchangeRate} coins / min</strong></div>
            <button id="play-current-game-btn" class="btn primary-btn">Play game <span aria-hidden="true">→</span></button>
        `;

        // Re-attach the play button listener
        this.sm.addListener('#play-current-game-btn', 'click', () => {
            this.startGame(game.id);
        });
    }
}

export function installStudentGameSettingsMethods(StudentGames) {
    for (const name of Object.getOwnPropertyNames(StudentGameSettingsMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentGames.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentGameSettingsMethods.prototype, name)
        );
    }
}
