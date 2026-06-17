import { $ } from '../main.js';
import { notifications } from '../notifications.js';

class StudentGameLifecycleMethods {
    showGameSelection() {
        // Helper function to show game selection
        $('#game-stage').classList.add('hidden');
        $('#game-selection').classList.remove('hidden');
        // Update leaderboard button visibility
        this.updateLeaderboardGame();
    }

    async startGame(type) {
        // Use global gamification settings
        await this.loadGlobalSettings();
        const exchangeRate = this.getExchangeRate();

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
            this.saveHighScore(type, score);

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

        let gameLaunched = true;

        if (type === 'galactic-breaker') {
            import('../games/galacticBreaker.js').then(module => {
                const scoreDisplay = $('#game-score');
                const updateGalacticBreakerScore = (score) => {
                    const numericScore = Number(score) || 0;
                    this.sm.currentGameScore = numericScore;
                    if (scoreDisplay) {
                        scoreDisplay.style.display = 'block';
                        scoreDisplay.textContent = `Score: ${numericScore.toLocaleString()}`;
                    }
                };

                this.sm.currentGameScore = 0;
                this.sm.currentGameMetadata = null;
                updateGalacticBreakerScore(0);

                this.sm.currentGame = new module.GalacticBreaker(canvas, gameOverCallback, updateGalacticBreakerScore);
                this.sm.currentGame.gameType = type;
                this.sm.currentGame.start();
            });
        } else if (type === 'snake') {
            import('../games/snake.js').then(module => {
                this.sm.currentGame = new module.Snake(canvas, gameOverCallback);
                this.sm.currentGame.start();
            });
        } else if (type === 'flappy-bird') {
            import('../games/flappyBird.js').then(module => {
                this.sm.currentGame = new module.FlappyBird(canvas, gameOverCallback);
                this.sm.currentGame.start();
            });
        } else if (type === 'space-invaders') {
            import('../games/spaceInvaders.js').then(module => {
                this.sm.currentGame = new module.SpaceInvaders(canvas, gameOverCallback);
                this.sm.currentGame.start();
            });
        } else if (type === 'target-shooter') {
            import('../games/targetShooter.js').then(module => {
                this.sm.currentGame = new module.TargetShooter(canvas, gameOverCallback);
                this.sm.currentGame.start();
            });
        } else if (type === 'pong') {
            import('../games/pong.js').then(module => {
                this.sm.currentGame = new module.Pong(canvas, gameOverCallback);
                this.sm.currentGame.start();
            });
        } else if (type === 'whack-a-mole') {
            import('../games/whackAMole.js').then(module => {
                this.sm.currentGame = new module.WhackAMole(canvas, gameOverCallback);
                this.sm.currentGame.start();
            });
        } else if (type === 'level-devil') {
            this.loadHTMLGame(
                'level-devil',
                'js/games/Level Devil - NOT A Troll Game.html',
                'level-devil-score',
                gameOverCallback,
                canvas,
                gameStage
            );
        } else if (type === 'ball-roll-3d') {
            this.loadHTMLGame(
                'ball-roll-3d',
                encodeURI('js/games/[3D]ボールころころ2.html'),
                null, // No score reporting for this game
                gameOverCallback,
                canvas,
                gameStage
            );
        } else if (type === 'appel') {
            this.loadHTMLGame(
                'appel',
                encodeURI('js/games/Appel v1.html'),
                null, // No score reporting for this game
                gameOverCallback,
                canvas,
                gameStage
            );
        } else if (type === 'ball-blast') {
            this.loadHTMLGame(
                'ball-blast',
                encodeURI('js/games/Ball Blast - Mobile friendly.html'),
                null, // No score reporting for this game
                gameOverCallback,
                canvas,
                gameStage
            );
        } else if (type === 'radius-raid') {
            this.loadHTMLGame(
                'radius-raid',
                'js/games/radius-raid-master/index.html',
                'radius-raid-score', // Score reporting enabled
                gameOverCallback,
                canvas,
                gameStage
            );
        } else if (type === 'packabunchas') {
            this.loadHTMLGame(
                'packabunchas',
                'js/games/packabunchas-main/index.html',
                'packabunchas-score', // Score reporting enabled
                gameOverCallback,
                canvas,
                gameStage
            );
        } else if (type === 'spacepi') {
            this.loadHTMLGame(
                'spacepi',
                'js/games/spacepi-master/index.html',
                'spacepi-score', // Score reporting enabled
                gameOverCallback,
                canvas,
                gameStage
            );
        } else if (type === 'mystic-valley') {
            this.loadHTMLGame(
                'mystic-valley',
                encodeURI('js/games/Mystic Valley.html'),
                null, // No score reporting initially
                gameOverCallback,
                canvas,
                gameStage
            );
        } else if (type === 'slash-knight') {
            this.loadHTMLGame(
                'slash-knight',
                encodeURI('js/games/Slash Knight.html'),
                null, // No score reporting initially
                gameOverCallback,
                canvas,
                gameStage
            );
        } else if (type === 'black-hole-square') {
            this.loadHTMLGame(
                'black-hole-square',
                'js/games/black-hole-square-master/public/index.html',
                null, // No score reporting initially
                gameOverCallback,
                canvas,
                gameStage
            );
        } else if (type === 'glitch-buster') {
            // Glitch Buster - using standalone HTML file
            const glitchPath = 'js/games/glitch-buster-master/glitch buster.html';
            this.loadHTMLGame(
                'glitch-buster',
                glitchPath,
                null, // No score reporting initially
                gameOverCallback,
                canvas,
                gameStage
            );
        } else if (type === 'callisto') {
            // Callisto - using standalone HTML file
            const callistoPath = 'js/games/js13k-callisto-main/index.html';
            this.loadHTMLGame(
                'callisto',
                callistoPath,
                null, // No score reporting initially
                gameOverCallback,
                canvas,
                gameStage
            );
        } else if (type === 'js13k2021') {
            // Galaxy Rider (JS13K 2021) - using standalone HTML file
            const js13kPath = 'js/games/galaxy_rider.html';
            this.loadHTMLGame(
                'js13k2021',
                js13kPath,
                null, // No score reporting initially
                gameOverCallback,
                canvas,
                gameStage
            );
        } else if (type === 'my-digital-garden') {
            this.loadHTMLGame(
                'my-digital-garden',
                'js/games/my-digital-garden/index.html',
                null, // No leaderboard score reporting for the first test pass
                gameOverCallback,
                canvas,
                gameStage
            );
        } else if (type === 'grow-your-garden') {
            this.loadHTMLGame(
                'grow-your-garden',
                'js/games/grow-your-garden/index.html',
                null, // Upstream game uses local saves; no arcade leaderboard hook yet
                gameOverCallback,
                canvas,
                gameStage
            );
        } else {
            gameLaunched = false;
        }

        if (!gameLaunched) {
            notifications.warning('This game is not available yet. Please refresh and try again.');
            this.stopCurrentGame();
            this.showGameSelection();
        }
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
                this.saveHighScore(currentGameType, this.sm.currentGameScore, this.sm.currentGameMetadata);
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

        // Check if we can auto-extend BEFORE pausing
        const settings = (this.sm.currentVocab && this.sm.currentVocab.activitySettings) ? this.sm.currentVocab.activitySettings : {};
        const exchangeRate = settings.exchangeRate !== undefined ? settings.exchangeRate : 10;

        if (this.sm.coins >= exchangeRate) {
            // Auto-deduct and add time - NO PAUSE, game continues seamlessly
            await this.sm.progress.deductCoins(exchangeRate);
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

        // Only pause if not enough coins
        if (this.sm.currentGame.pause) {
            this.sm.currentGame.pause();
        }
        this.sm.isGamePaused = true;

        // Stop the timer
        this.clearGameTimer();

        // Not enough coins - end game
        notifications.warning('Time up! Not enough coins to continue.');
        this.stopCurrentGame();
        this.showGameSelection();
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

export function installStudentGameLifecycleMethods(StudentGames) {
    for (const name of Object.getOwnPropertyNames(StudentGameLifecycleMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentGames.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentGameLifecycleMethods.prototype, name)
        );
    }
}
