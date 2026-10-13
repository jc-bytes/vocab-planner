import { captureArcadeSession } from './studentGameAccessMethods.js';
import { $, refreshIcons } from '../main.js';
import {
    DEV_GAMIFICATION_SETTINGS_KEY,
    GAMIFICATION_SETTINGS_KEY,
    normalizeExchangeRate,
    resolveArcadeEconomySettings
} from '../gamificationConfig.js';
import { serverStateQuery } from '../services/serverStateQuery.js';
import { settingsRepository } from '../services/settingsRepository.js';
import {
    ARCADE_MINUTE_SECONDS,
    FORMATIVE_PASS_MINUTES
} from './studentArcadePolicy.js';

export class StudentGameSettings {
    constructor(games) {
        this.games = games;
        this.sm = games.sm;
        this.queryService = games.queryService || serverStateQuery;
        this.globalSettings = null;
    }

    formatTime(seconds) {
        if (!seconds) return '0s';
        const mins = Math.floor(seconds / ARCADE_MINUTE_SECONDS);
        const secs = seconds % ARCADE_MINUTE_SECONDS;
        if (mins > 0) {
            return `${mins}m ${secs}s`;
        }
        return `${secs}s`;
    }

    async loadGlobalSettings() {
        const isCurrent = captureArcadeSession(this.games);
        if (!isCurrent()) return null;
        if (this.sm.authDisabled) {
            try {
                const localSettings = JSON.parse(localStorage.getItem(DEV_GAMIFICATION_SETTINGS_KEY) || '{}');
                this.globalSettings = resolveArcadeEconomySettings(localSettings);
            } catch (error) {
                console.error('Error loading local gamification settings:', error);
                this.globalSettings = resolveArcadeEconomySettings();
            }
            return this.globalSettings;
        }

        const accountId = this.sm.currentUser?.uid || this.sm.currentUser?.id;
        if (!accountId) {
            this.globalSettings = resolveArcadeEconomySettings();
            return this.globalSettings;
        }

        try {
            const settings = await this.queryService.ensure({
                accountId,
                key: ['student', 'game-settings', GAMIFICATION_SETTINGS_KEY],
                queryFn: ({ signal }) => settingsRepository.get(GAMIFICATION_SETTINGS_KEY, { signal })
            });
            if (!isCurrent()) return null;
            this.globalSettings = resolveArcadeEconomySettings(settings);
        } catch (error) {
            if (!isCurrent()) return null;
            console.error('Error loading global gamification settings:', error);
            // Fallback to defaults
            this.globalSettings = resolveArcadeEconomySettings();
        }

        return this.globalSettings;
    }

    getExchangeRate() {
        return normalizeExchangeRate(this.globalSettings?.exchangeRate);
    }

    async updateArcadeUI(options = {}) {
        const isCurrent = captureArcadeSession(this.games);
        if (!isCurrent()) return;
        // Load global settings
        await Promise.all([
            this.loadGlobalSettings(),
            this.games.loadArcadeTime({ force: options.force !== false })
        ]);
        if (!isCurrent()) return;
        const exchangeRate = this.getExchangeRate();

        const costEl = $('#galactic-breaker-cost');
        if (costEl) costEl.textContent = `${exchangeRate} Coins / min`;

        const addTimeBtn = $('#add-time-btn');
        if (addTimeBtn) addTimeBtn.textContent = `+1 Min (${exchangeRate} coins)`;

        const timeBalance = $('#arcade-time-balance');
        if (timeBalance) {
            const availableSeconds = this.games.getAvailableArcadeSeconds();
            const balanceText = availableSeconds > 0
                ? `${this.formatTime(availableSeconds)} of earned Arcade time available.`
                : 'No earned Arcade time available.';
            timeBalance.textContent = `${balanceText} Complete a formative activity after every ${FORMATIVE_PASS_MINUTES} minutes of Arcade play.`;
        }
    }

    async updateGameSelectionUI() {
        const isCurrent = captureArcadeSession(this.games);
        if (!isCurrent()) return;
        const game = this.games.gamesList[this.games.currentGameIndex];
        const container = $('#current-game-card');
        if (!container) return;

        // Load global settings
        await Promise.all([this.loadGlobalSettings(), this.games.loadArcadeTime()]);
        if (!isCurrent()) return;
        const exchangeRate = this.getExchangeRate();
        const resumableTime = this.games.gameTimeRemaining;

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
            <div class="game-cost">
                <span>Play rate</span><strong>${exchangeRate} coins / min</strong>
                <span>Learning check</span><strong>One formative activity every ${FORMATIVE_PASS_MINUTES} min</strong>
            </div>
            <button id="play-current-game-btn" class="btn primary-btn"${this.games.isStartingGame || this.games.lifecycle.extensionOperation ? ' disabled aria-busy="true"' : ''}>
                <i data-lucide="play" aria-hidden="true"></i>
                <span>${resumableTime > 0 ? `Resume (${this.formatTime(resumableTime)})` : 'Play game'}</span>
            </button>
        `;
        refreshIcons(container);

        // Re-attach the play button listener
        this.sm.addListener('#play-current-game-btn', 'click', () => {
            this.games.startGame(game.id);
        });
    }
}
