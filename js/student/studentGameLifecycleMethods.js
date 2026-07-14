import { $ } from '../main.js';
import { notifications } from '../notifications.js';
import { getStudentGame } from './studentGameRegistry.js';

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
        // Use global gamification settings
        await this.games.loadGlobalSettings();
        const exchangeRate = this.games.getExchangeRate();

        if (this.sm.coins < exchangeRate) {
            notifications.warning(`You need at least ${exchangeRate} coins to play!`);
            return;
        }

        if (await this.sm.progress.deductCoins(exchangeRate)) {
            this.sm.gameTimeRemaining = 60;
            this.launchGame(type, { resetTimer: true });
        }
    }

    restartCurrentGame(type) {
        this.cleanupCurrentGame({ keepTimer: true, saveScore: false });
        this.launchGame(type, { resetTimer: false });
    }

    launchGame(type, { resetTimer = false } = {}) {
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
        if (resetTimer || !this.sm.gameTimerInterval) {
            this.startGameTimer();
        }

        // Initialize Game Logic
        const canvas = $('#game-canvas');

        // Create a callback that offers replay if time remains
        const gameOverCallback = (score) => {
            this.games.saveHighScore(type, score);

            // If there's time remaining, offer to play again
            if (this.sm.gameTimeRemaining > 0) {
                const playAgain = confirm(`Game Over! Score: ${score}\n\nYou have ${Math.floor(this.sm.gameTimeRemaining / 60)}:${(this.sm.gameTimeRemaining % 60).toString().padStart(2, '0')} remaining.\n\nPlay again?`);

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
            return;
        }

        game.launch.load().then(module => {
            const ExportedGame = module[game.launch.exportName];
            if (!ExportedGame) throw new Error(`Game module ${game.id} does not export ${game.launch.exportName}.`);
            this.sm.currentGame = game.launch.create(ExportedGame, {
                canvas,
                gameOverCallback,
                games: this
            });
            this.sm.currentGame.gameType = type;
            this.sm.currentGame.start();
        }).catch(error => {
            console.error(`Could not launch ${game.id}:`, error);
            notifications.warning('This game could not be loaded. Please refresh and try again.');
            this.stopCurrentGame();
            this.showGameSelection();
        });
    }

    clearGameTimer() {
        if (this.sm.gameTimerInterval) {
            clearInterval(this.sm.gameTimerInterval);
            this.sm.gameTimerInterval = null;
        }
    }

    startGameTimer() {
        this.clearGameTimer();
        this.sm.gameTimerInterval = setInterval(() => {
            this.sm.gameTimeRemaining = Math.max(0, this.sm.gameTimeRemaining - 1);
            this.updateGameTimer();
            if (this.sm.gameTimeRemaining <= 0) {
                this.pauseGame();
            }
        }, 1000);
    }

    cleanupCurrentGame({ keepTimer = false, saveScore = true } = {}) {
        // Store current game type before cleanup for score saving
        const currentGameType = this.sm.currentGame?.gameType || null;
        
        if (this.sm.currentGame) {
            if (typeof this.sm.currentGame.stop === 'function') {
                this.sm.currentGame.stop();
            }
            // Also clean up message handler if it exists
            if (this.sm.currentGame.messageHandler) {
                window.removeEventListener('message', this.sm.currentGame.messageHandler);
            }
            // Report final score if available (for games with score reporting)
            if (saveScore && this.sm.currentGameScore !== undefined && this.sm.currentGameScore > 0 && currentGameType) {
                this.games.saveHighScore(currentGameType, this.sm.currentGameScore, this.sm.currentGameMetadata);
            }
            this.sm.currentGame = null;
            this.sm.currentGameScore = 0;
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
        if (!this.sm.currentGame) return;
        if (this.sm.isHandlingGameMinute) return;

        this.sm.isHandlingGameMinute = true;
        try {
            if (typeof this.sm.currentGame.completeMinute === 'function') {
                this.sm.currentGame.completeMinute();
            }

            // Check if we can auto-extend BEFORE pausing
            const settings = (this.sm.currentVocab && this.sm.currentVocab.activitySettings) ? this.sm.currentVocab.activitySettings : {};
            const exchangeRate = settings.exchangeRate !== undefined ? settings.exchangeRate : 10;

            if (this.sm.coins >= exchangeRate && await this.sm.progress.deductCoins(exchangeRate)) {
                this.addGameTime(60);

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
            if (this.sm.currentGame.pause) {
                this.sm.currentGame.pause();
            }
            this.sm.isGamePaused = true;

            this.clearGameTimer();

            notifications.warning('Time up! The next minute could not be started.');
            this.stopCurrentGame();
            this.showGameSelection();
        } finally {
            this.sm.isHandlingGameMinute = false;
        }
    }

    addGameTime(seconds = 60) {
        const increment = Number.isFinite(seconds) ? seconds : 0;
        this.sm.gameTimeRemaining = Math.max(0, this.sm.gameTimeRemaining + increment);
        this.updateGameTimer();
    }

    updateGameTimer() {
        const mins = Math.floor(this.sm.gameTimeRemaining / 60);
        const secs = this.sm.gameTimeRemaining % 60;
        $('#game-timer').textContent = `Time: ${mins}:${secs.toString().padStart(2, '0')}`;
    }
}
