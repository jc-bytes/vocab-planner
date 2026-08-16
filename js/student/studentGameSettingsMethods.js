import { $ } from '../main.js';
import { settingsRepository } from '../services/settingsRepository.js';

export class StudentGameSettings {
    constructor(games) {
        this.games = games;
        this.sm = games.sm;
        this.globalSettings = null;
    }

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
            const settings = await settingsRepository.get('gamification');
            if (settings) {
                this.globalSettings = settings;
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
        const game = this.games.gamesList[this.games.currentGameIndex];
        const container = $('#current-game-card');
        if (!container) return;

        // Load global settings
        await this.loadGlobalSettings();
        const exchangeRate = this.getExchangeRate();
        
        // Game counter (e.g., "3/20")
        const currentNum = this.games.currentGameIndex + 1;
        const totalGames = this.games.gamesList.length;
        const totalEl = $('#arcade-game-total');
        if (totalEl) totalEl.textContent = totalGames;

        const gameArt = game.art
            ? `<img class="game-art" src="${game.art}" alt="" loading="lazy">`
            : `<i data-lucide="${game.icon}"></i>`;

        container.innerHTML = `
            <div class="game-counter">Game ${currentNum} of ${totalGames}</div>
            <div class="game-icon${game.art ? ' has-art' : ''}" aria-hidden="true">${gameArt}</div>
            <div class="game-card-copy">
                <h3>${game.name}</h3>
                <p>${game.desc}</p>
            </div>
            <div class="game-cost"><span>Play rate</span><strong>${exchangeRate} coins / min</strong></div>
            <button id="play-current-game-btn" class="btn primary-btn">
                <i data-lucide="play" aria-hidden="true"></i>
                <span>Play game</span>
            </button>
        `;
        window.lucide?.createIcons({ root: container });

        // Re-attach the play button listener
        this.sm.addListener('#play-current-game-btn', 'click', () => {
            this.games.startGame(game.id);
        });
    }
}
