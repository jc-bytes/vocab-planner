import { $ } from '../main.js';
import { notifications } from '../notifications.js';
import { getStudentGame } from './studentGameRegistry.js';
import {
    ARCADE_MINUTE_SECONDS,
    FORMATIVE_PASS_MINUTES,
    MAX_QUEUED_ARCADE_SECONDS
} from './studentArcadePolicy.js';
import { writeLocalArcadeSession } from './studentArcadeTimeStorage.js';

export class StudentGameLifecycle {
    constructor(games) {
        this.games = games;
        this.sm = games.sm;
        this.arrowKeyHandler = null;
    }

    showGameSelection() {
        // Helper function to show game selection
        $('#game-stage').classList.add('hidden');
        $('#game-selection').classList.remove('hidden');
        // Update leaderboard button visibility
        this.games.updateLeaderboardGame();
    }

    async startGame(type) {
        await this.sm.activities?.refreshCurrentSparkGate?.({ updateDisplay: false });
        const access = this.sm.activities?.getPendingRequiredWork?.();
        if (access?.isBlocked) {
            this.sm.activities.updateArcadeGateDisplay(access);
            notifications.warning('Complete your required activities before playing Arcade games.');
            await this.sm.navigateTo({ view: 'arcade' });
            return false;
        }

        // Use global gamification settings
        await Promise.all([
            this.games.loadGlobalSettings(),
            this.games.loadArcadeTime({ force: true })
        ]);
        const exchangeRate = this.games.getExchangeRate();

        if (this.games.gameTimeRemaining > 0) {
            this.games.savedGameId = type;
            this.updateGameTimer();
            this.launchGame(type, { resetTimer: false });
            return true;
        }

        if (this.games.getAvailableArcadeSeconds() < ARCADE_MINUTE_SECONDS) {
            notifications.warning(`Complete a formative activity before starting another ${FORMATIVE_PASS_MINUTES}-minute Arcade break.`);
            await this.sm.navigateTo({ view: 'units' });
            return false;
        }
        if (this.sm.coins < exchangeRate) {
            notifications.warning(`You need at least ${exchangeRate} coins to play!`);
            return false;
        }

        try {
            const minute = await this.games.startArcadeMinute(type);
            if (minute) {
                this.games.gameTimeRemaining = minute.minuteSeconds || ARCADE_MINUTE_SECONDS;
                this.games.savedGameId = type;
                await this.games.updateArcadeUI({ force: false });
                this.launchGame(type, { resetTimer: true });
                return true;
            }
        } catch (error) {
            console.error('Could not start Arcade minute:', error);
            notifications.warning(error?.message || 'Could not start Arcade time. Please try again.');
        }
        return false;
    }

    restartCurrentGame(type) {
        this.cleanupCurrentGame({ keepTimer: true, saveScore: false });
        this.launchGame(type, { resetTimer: false });
    }

    launchGame(type, { resetTimer = false } = {}) {
        const access = this.sm.activities?.getPendingRequiredWork?.();
        if (access?.isBlocked) {
            this.sm.activities.updateArcadeGateDisplay(access);
            notifications.warning('Arcade is locked until required activities are complete.');
            return false;
        }

        $('#game-selection').classList.add('hidden');
        const gameStage = $('#game-stage');
        gameStage.classList.remove('hidden');
        gameStage.style.removeProperty('--game-frame-width');

        // Prevent arrow keys from scrolling the page during gameplay
        if (!this.arrowKeyHandler) {
            this.arrowKeyHandler = (e) => {
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                    e.preventDefault();
                }
            };
        }
        window.addEventListener('keydown', this.arrowKeyHandler);

        this.updateGameTimer();
        if (resetTimer || !this.games.gameTimerInterval) {
            this.startGameTimer();
        }

        // Initialize Game Logic
        const canvas = $('#game-canvas');

        // Create a callback that offers replay if time remains
        const gameOverCallback = (score) => {
            this.games.saveHighScore(type, score, null, { immediate: true });

            // If there's time remaining, offer to play again
            if (this.games.gameTimeRemaining > 0) {
                const playAgain = confirm(`Game Over! Score: ${score}\n\nYou have ${Math.floor(this.games.gameTimeRemaining / 60)}:${(this.games.gameTimeRemaining % 60).toString().padStart(2, '0')} remaining.\n\nPlay again?`);

                if (playAgain) {
                    this.restartCurrentGame(type);
                } else {
                    // Exit game
                    this.stopCurrentGame();
                    this.showGameSelection();
                }
            } else {
                // No time left, just exit
                this.stopCurrentGame();
                this.showGameSelection();
            }
        };

        const game = getStudentGame(type);
        if (!game) {
            notifications.warning('This game is not available yet. Please refresh and try again.');
            this.stopCurrentGame();
            this.showGameSelection();
            return;
        }

        if (game.launch.mode === 'html') {
            this.games.loadHTMLGame(
                game.id,
                game.launch.path,
                game.launch.scoreMessageType,
                gameOverCallback,
                canvas,
                gameStage
            );
            return true;
        }

        game.launch.load().then(module => {
            const ExportedGame = module[game.launch.exportName];
            if (!ExportedGame) throw new Error(`Game module ${game.id} does not export ${game.launch.exportName}.`);
            this.games.currentGame = game.launch.create(ExportedGame, {
                canvas,
                gameOverCallback,
                games: this
            });
            this.games.currentGame.gameType = type;
            this.games.currentGame.start();
        }).catch(error => {
            console.error(`Could not launch ${game.id}:`, error);
            notifications.warning('This game could not be loaded. Please refresh and try again.');
            this.stopCurrentGame();
            this.showGameSelection();
        });
        return true;
    }

    clearGameTimer() {
        if (this.games.gameTimerInterval) {
            clearInterval(this.games.gameTimerInterval);
            this.games.gameTimerInterval = null;
        }
    }

    startGameTimer() {
        this.clearGameTimer();
        this.games.gameTimerInterval = setInterval(() => {
            this.games.gameTimeRemaining = Math.max(0, this.games.gameTimeRemaining - 1);
            this.updateGameTimer();
            if (this.games.gameTimeRemaining <= 0) {
                this.pauseGame();
            }
        }, 1000);
    }

    cleanupCurrentGame({ keepTimer = false, saveScore = true } = {}) {
        // Store current game type before cleanup for score saving
        const currentGameType = this.games.currentGame?.gameType || null;
        
        if (this.games.currentGame) {
            if (typeof this.games.currentGame.stop === 'function') {
                this.games.currentGame.stop();
            }
            // Also clean up message handler if it exists
            if (this.games.currentGame.messageHandler) {
                window.removeEventListener('message', this.games.currentGame.messageHandler);
            }
            // Report final score if available (for games with score reporting)
            if (saveScore && this.games.currentGameScore > 0 && currentGameType) {
                this.games.saveHighScore(
                    currentGameType,
                    this.games.currentGameScore,
                    this.games.currentGameMetadata,
                    { immediate: true }
                );
            }
            this.games.currentGame = null;
            this.games.currentGameScore = 0;
        }
        
        // Clean up any remaining iframes (fallback cleanup)
        const iframes = document.querySelectorAll('[id$="-iframe"]');
        iframes.forEach(iframe => {
            if (iframe.parentNode) {
                iframe.remove();
            }
        });
        document.querySelectorAll('[id$="-frame-shell"]').forEach(frameShell => frameShell.remove());
        
        // Show canvas again
        const canvas = $('#game-canvas');
        if (canvas) {
            canvas.style.display = 'block';
            canvas.style.margin = '0 auto'; // Center the canvas
        }
        
        // Hide score display
        const scoreDisplay = $('#game-score');
        if (scoreDisplay) {
            scoreDisplay.style.display = 'none';
        }

        if (!keepTimer) {
            this.clearGameTimer();
        }
    }

    stopCurrentGame() {
        // Remove arrow key prevention handler
        if (this.arrowKeyHandler) {
            window.removeEventListener('keydown', this.arrowKeyHandler);
        }
        this.cleanupCurrentGame();
    }

    async pauseGame() {
        if (!this.games.currentGame) return;
        if (this.games.isHandlingGameMinute) return;

        this.games.isHandlingGameMinute = true;
        try {
            if (typeof this.games.currentGame.completeMinute === 'function') {
                this.games.currentGame.completeMinute();
            }

            const exchangeRate = this.games.getExchangeRate();
            const gameId = this.games.currentGame?.gameType || 'arcade';
            let minute = null;
            try {
                minute = await this.games.startArcadeMinute(gameId);
            } catch (error) {
                console.warn('Could not extend Arcade time:', error);
            }

            if (minute) {
                this.addGameTime(minute.minuteSeconds || ARCADE_MINUTE_SECONDS);
                await this.games.updateArcadeUI({ force: false });

                // Visual feedback for extension (non-blocking)
                const timerEl = $('#game-timer');
                const originalColor = timerEl.style.color;
                timerEl.style.color = '#4ade80'; // Green
                timerEl.textContent = 'Time Extended! -' + exchangeRate + ' Coins';
                setTimeout(() => {
                    timerEl.style.color = originalColor;
                    this.updateGameTimer();
                }, 1500);

                return; // Continue game without any interruption
            }

            // Only pause if there are not enough coins or the deduction failed.
            if (this.games.currentGame.pause) {
                this.games.currentGame.pause();
            }
            this.games.isGamePaused = true;

            this.clearGameTimer();

            const needsFormativeCheck = this.games.getAvailableArcadeSeconds() < ARCADE_MINUTE_SECONDS;
            const message = needsFormativeCheck
                ? `Your ${FORMATIVE_PASS_MINUTES}-minute Arcade break is complete. Finish another formative activity to continue.`
                : `Time up! You need ${exchangeRate} coins for the next minute.`;
            notifications.warning(message);
            this.stopCurrentGame();
            if (needsFormativeCheck) {
                await this.sm.navigateTo({ view: 'units' });
            } else {
                this.showGameSelection();
            }
        } finally {
            this.games.isHandlingGameMinute = false;
        }
    }

    addGameTime(seconds = ARCADE_MINUTE_SECONDS) {
        const increment = Number.isFinite(seconds) ? seconds : 0;
        this.games.gameTimeRemaining = Math.min(
            MAX_QUEUED_ARCADE_SECONDS,
            Math.max(0, this.games.gameTimeRemaining + increment)
        );
        this.updateGameTimer();
    }

    updateGameTimer() {
        const mins = Math.floor(this.games.gameTimeRemaining / ARCADE_MINUTE_SECONDS);
        const secs = this.games.gameTimeRemaining % ARCADE_MINUTE_SECONDS;
        const timerEl = $('#game-timer');
        if (timerEl) timerEl.textContent = `Time: ${mins}:${secs.toString().padStart(2, '0')}`;
        const addTimeBtn = $('#add-time-btn');
        if (addTimeBtn) {
            const atManualLimit = this.games.gameTimeRemaining > MAX_QUEUED_ARCADE_SECONDS - ARCADE_MINUTE_SECONDS;
            addTimeBtn.disabled = atManualLimit || this.games.isAddingGameTime;
            addTimeBtn.title = atManualLimit
                ? `Maximum queued Arcade time is ${FORMATIVE_PASS_MINUTES} minutes.`
                : '';
        }
        writeLocalArcadeSession(this.games.sessionOwnerId, {
            remainingSeconds: this.games.gameTimeRemaining,
            gameId: this.games.currentGame?.gameType || this.games.savedGameId || ''
        });
    }
}
