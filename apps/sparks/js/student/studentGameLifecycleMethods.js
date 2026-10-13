import { $ } from '../main.js';
import { notifications } from '../notifications.js';
import { getStudentGame } from './studentGameRegistry.js';
import {
    ARCADE_MINUTE_SECONDS,
    FORMATIVE_PASS_MINUTES,
    MAX_QUEUED_ARCADE_SECONDS
} from './studentArcadePolicy.js';
import { writeLocalArcadeSession } from './studentArcadeTimeStorage.js';
import { captureArcadeSession } from './studentGameAccessMethods.js';

export class StudentGameLifecycle {
    constructor(games) {
        this.games = games;
        this.sm = games.sm;
        this.arrowKeyHandler = null;
        this.launchGeneration = 0;
        this.operationGeneration = 0;
        this.startOperation = null;
        this.extensionOperation = null;
    }

    showGameSelection() {
        // Helper function to show game selection
        $('#game-stage').classList.add('hidden');
        $('#game-selection').classList.remove('hidden');
        // Update leaderboard button visibility
        this.games.updateLeaderboardGame();
    }

    exitToGameSelection() {
        this.stopCurrentGame();
        this.showGameSelection();
    }

    selectAdjacentGame(offset) {
        const gameCount = this.games.gamesList.length;
        if (gameCount === 0) return false;

        const step = Number.isFinite(offset) ? Math.trunc(offset) : 0;
        this.games.currentGameIndex = (
            this.games.currentGameIndex + step + gameCount
        ) % gameCount;
        this.games.updateGameSelectionUI();
        this.games.updateLeaderboardGame();
        return true;
    }

    beginExtension(flag) {
        const isSessionCurrent = captureArcadeSession(this.games);
        if (!isSessionCurrent() || this.startOperation || this.extensionOperation) return null;
        const game = this.games.currentGame;
        const generation = this.launchGeneration;
        const operation = {
            flag,
            isSessionCurrent,
            current: () => isSessionCurrent() && this.games.currentGame === game
                && this.launchGeneration === generation,
            owns: () => isSessionCurrent() && this.extensionOperation === operation
        };
        this.extensionOperation = operation;
        this.games[flag] = true;
        this.updateStartButton();
        return operation;
    }

    finishExtension(operation) {
        if (this.extensionOperation !== operation) return;
        this.extensionOperation = null;
        this.games[operation.flag] = false;
        if (operation.isSessionCurrent()) {
            this.updateGameTimer({ preserveFeedback: operation.current() && operation.extended });
            this.updateStartButton();
        }
    }

    async requestAdditionalTime() {
        if (this.startOperation || this.extensionOperation) return false;
        if (this.games.gameTimeRemaining > MAX_QUEUED_ARCADE_SECONDS - ARCADE_MINUTE_SECONDS) {
            notifications.warning(`You can queue a maximum of ${FORMATIVE_PASS_MINUTES} minutes.`);
            this.updateGameTimer();
            return false;
        }

        const operation = this.beginExtension('isAddingGameTime');
        if (!operation) return false;
        const gameId = this.games.currentGame?.gameType || 'arcade';
        this.updateGameTimer();
        try {
            const minute = await this.games.startArcadeMinute(gameId);
            if (!operation.owns()) return false;
            if (!minute) {
                if (!operation.current()) return false;
                notifications.warning('Complete another formative activity before continuing your Arcade break.');
                return false;
            }

            this.addGameTime(minute.minuteSeconds || ARCADE_MINUTE_SECONDS);
            if (!operation.current()) return false;
            await this.games.updateArcadeUI({ force: false });
            if (!operation.current()) return false;
            return true;
        } catch (error) {
            if (!operation.current()) return false;
            notifications.warning(error?.message || 'Could not add Arcade time.');
            return false;
        } finally {
            this.finishExtension(operation);
        }
    }

    async startGame(type) {
        const isSessionCurrent = captureArcadeSession(this.games);
        if (!isSessionCurrent() || this.startOperation || this.extensionOperation) return false;
        const operation = { cancelled: false };
        this.startOperation = operation;
        this.games.isStartingGame = true;
        this.updateStartButton();
        const operationGeneration = this.operationGeneration;
        const ownsOperation = () => isSessionCurrent() && this.startOperation === operation
            && operationGeneration === this.operationGeneration;
        const current = () => ownsOperation() && !operation.cancelled;
        try {
            await this.sm.activities?.refreshCurrentSparkGate?.({ updateDisplay: false });
            if (!current()) return false;
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
            if (!current()) return false;
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

            const minute = await this.games.startArcadeMinute(type);
            if (!ownsOperation()) return false;
            if (minute) {
                this.games.savedGameId = type;
                // A completed purchase remains resumable when Stop cancelled only the launch.
                this.addGameTime(minute.minuteSeconds || ARCADE_MINUTE_SECONDS);
                if (!current()) return false;
                await this.games.updateArcadeUI({ force: false });
                if (!current()) return false;
                this.launchGame(type, { resetTimer: true });
                return true;
            }
        } catch (error) {
            if (!current()) return false;
            console.error('Could not start Arcade minute:', error);
            notifications.warning(error?.message || 'Could not start Arcade time. Please try again.');
        } finally {
            if (this.startOperation === operation) {
                this.startOperation = null;
                this.games.isStartingGame = false;
                if (isSessionCurrent()) this.updateStartButton();
            }
        }
        return false;
    }

    updateStartButton() {
        const button = $('#play-current-game-btn');
        if (button) {
            const pending = this.games.isStartingGame || !!this.extensionOperation;
            button.disabled = pending;
            button.setAttribute('aria-busy', String(pending));
            const label = button.querySelector?.('span');
            if (label) label.textContent = this.games.gameTimeRemaining > 0
                ? `Resume (${this.games.formatTime(this.games.gameTimeRemaining)})` : 'Play game';
        }
    }

    restartCurrentGame(type) {
        this.cleanupCurrentGame({ keepTimer: true, saveScore: false });
        this.launchGame(type, { resetTimer: false });
    }

    launchGame(type, { resetTimer = false } = {}) {
        if (this.games.destroyed) return false;
        const launchGeneration = ++this.launchGeneration;
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
                const playAgain = confirm(`Game Over! Score: ${score}\n\nYou have ${Math.floor(this.games.gameTimeRemaining / ARCADE_MINUTE_SECONDS)}:${(this.games.gameTimeRemaining % ARCADE_MINUTE_SECONDS).toString().padStart(2, '0')} remaining.\n\nPlay again?`);

                if (playAgain) {
                    this.restartCurrentGame(type);
                } else {
                    this.exitToGameSelection();
                }
            } else {
                this.exitToGameSelection();
            }
        };

        const game = getStudentGame(type);
        if (!game) {
            notifications.warning('This game is not available yet. Please refresh and try again.');
            this.exitToGameSelection();
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
            if (this.games.destroyed || launchGeneration !== this.launchGeneration) return;
            const ExportedGame = module[game.launch.exportName];
            if (!ExportedGame) throw new Error(`Game module ${game.id} does not export ${game.launch.exportName}.`);
            this.games.currentGame = game.launch.create(ExportedGame, {
                canvas,
                gameOverCallback,
                games: this.games
            });
            this.games.currentGame.gameType = type;
            this.games.currentGame.start();
        }).catch(error => {
            if (this.games.destroyed || launchGeneration !== this.launchGeneration) return;
            console.error(`Could not launch ${game.id}:`, error);
            notifications.warning('This game could not be loaded. Please refresh and try again.');
            this.exitToGameSelection();
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
        this.launchGeneration += 1;
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
        if (this.startOperation) this.startOperation.cancelled = true;
        // Remove arrow key prevention handler
        if (this.arrowKeyHandler) {
            window.removeEventListener('keydown', this.arrowKeyHandler);
        }
        this.cleanupCurrentGame();
    }

    destroy() {
        this.startOperation = null;
        this.extensionOperation = null;
        this.games.isStartingGame = false;
        this.operationGeneration += 1;
        this.launchGeneration += 1;
        if (this.arrowKeyHandler) {
            window.removeEventListener('keydown', this.arrowKeyHandler);
            this.arrowKeyHandler = null;
        }
        this.cleanupCurrentGame({ saveScore: false });
        this.games.isHandlingGameMinute = false;
        this.games.isAddingGameTime = false;
    }

    async pauseGame() {
        if (!this.games.currentGame) return;
        const operation = this.beginExtension('isHandlingGameMinute');
        if (!operation) return;
        try {
            if (typeof this.games.currentGame.completeMinute === 'function') {
                this.games.currentGame.completeMinute();
            }
            if (!operation.current()) return;

            const exchangeRate = this.games.getExchangeRate();
            const gameId = this.games.currentGame?.gameType || 'arcade';
            let minute = null;
            try {
                minute = await this.games.startArcadeMinute(gameId);
                if (!operation.owns()) return;
            } catch (error) {
                if (!operation.current()) return;
                console.warn('Could not extend Arcade time:', error);
            }

            if (minute) {
                this.addGameTime(minute.minuteSeconds || ARCADE_MINUTE_SECONDS);
                if (!operation.current()) return;
                await this.games.updateArcadeUI({ force: false });
                if (!operation.current()) return;

                // Visual feedback for extension (non-blocking)
                const timerEl = $('#game-timer');
                const originalColor = timerEl.style.color;
                operation.extended = true;
                timerEl.style.color = '#4ade80'; // Green
                timerEl.textContent = 'Time Extended! -' + exchangeRate + ' Coins';
                setTimeout(() => {
                    if (!operation.current()) return;
                    timerEl.style.color = originalColor;
                    this.updateGameTimer();
                }, 1500);

                return; // Continue game without any interruption
            }

            // Only the game which requested the minute may be paused or removed.
            if (!operation.current()) return;
            if (this.games.currentGame?.pause) {
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
            this.finishExtension(operation);
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

    updateGameTimer({ preserveFeedback = false } = {}) {
        const mins = Math.floor(this.games.gameTimeRemaining / ARCADE_MINUTE_SECONDS);
        const secs = this.games.gameTimeRemaining % ARCADE_MINUTE_SECONDS;
        const timerEl = $('#game-timer');
        if (timerEl && !preserveFeedback) timerEl.textContent = `Time: ${mins}:${secs.toString().padStart(2, '0')}`;
        const addTimeBtn = $('#add-time-btn');
        if (addTimeBtn) {
            const atManualLimit = this.games.gameTimeRemaining > MAX_QUEUED_ARCADE_SECONDS - ARCADE_MINUTE_SECONDS;
            addTimeBtn.disabled = atManualLimit || this.games.isAddingGameTime || this.games.isHandlingGameMinute || this.games.isStartingGame;
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
