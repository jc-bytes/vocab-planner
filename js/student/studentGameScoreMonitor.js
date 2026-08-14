export class StudentGameScoreMonitor {
    constructor(htmlLoader) {
        this.htmlLoader = htmlLoader;
        this.games = htmlLoader.games;
        this.sm = htmlLoader.sm;
    }

    getScoreMonitoringScript(gameId, messageType) {
        if (gameId === 'radius-raid') {
            return `
                (function() {
                    let lastScore = 0;
                    let lastState = '';
                    let checkInterval = setInterval(function() {
                        try {
                            // Radius Raid uses $.score and $.state
                            if (typeof $ !== 'undefined' && $.score !== undefined) {
                                const currentScore = $.score || 0;
                                const currentState = $.state || '';

                                // Report score updates
                                if (currentScore !== lastScore) {
                                    lastScore = currentScore;
                                    window.parent.postMessage({
                                        type: '${messageType}',
                                        score: currentScore,
                                        gameOver: false
                                    }, '*');
                                }

                                // Check for game over (state changes to 'gameover' or 'menu')
                                if (currentState === 'gameover' && lastState !== 'gameover') {
                                    // Final score is stored in $.storage['score']
                                    const finalScore = (typeof $.storage !== 'undefined' && $.storage['score'])
                                        ? Math.max($.storage['score'], $.score)
                                        : $.score;

                                    window.parent.postMessage({
                                        type: '${messageType}',
                                        score: finalScore || 0,
                                        gameOver: true
                                    }, '*');

                                    clearInterval(checkInterval);
                                }

                                lastState = currentState;
                            }
                        } catch (e) {
                            console.warn('Score monitoring error:', e);
                        }
                    }, 500); // Check every 500ms

                    // Cleanup on unload
                    window.addEventListener('beforeunload', function() {
                        clearInterval(checkInterval);
                    });
                })();
            `;
        } else if (gameId === 'spacepi') {
            return `
                (function() {
                    let lastScore = -1;
                    let lastLevel = -1;
                    let lastMenuMode = true;
                    let checkInterval = setInterval(function() {
                        try {
                            // SpacePi uses sp.levelStats.score and sp.level
                            // The game instance is stored as 'sp' in global scope
                            let game = null;
                            if (typeof sp !== 'undefined' && sp.levelStats) {
                                game = sp;
                            } else {
                                // Try to find it in window
                                for (let key in window) {
                                    if (window[key] && typeof window[key] === 'object' && window[key].levelStats) {
                                        game = window[key];
                                        break;
                                    }
                                }
                            }

                            if (game && game.levelStats) {
                                const currentScore = Math.round(game.levelStats.score || 0);
                                const currentLevel = game.level !== undefined ? game.level : -1;
                                const currentMenuMode = game.menuMode !== undefined ? game.menuMode : true;

                                // When level ends (menuMode changes from false to true), report final score
                                if (lastMenuMode === false && currentMenuMode === true && lastLevel >= 0) {
                                    // Level just ended - report the final score
                                    window.parent.postMessage({
                                        type: '${messageType}',
                                        score: lastScore > 0 ? lastScore : currentScore,
                                        level: lastLevel + 1,
                                        gameOver: false
                                    }, '*');
                                }

                                // Report score updates during gameplay
                                if (currentScore !== lastScore && !currentMenuMode && game.levelPlaying) {
                                    lastScore = currentScore;
                                    window.parent.postMessage({
                                        type: '${messageType}',
                                        score: currentScore,
                                        level: currentLevel + 1,
                                        gameOver: false
                                    }, '*');
                                }

                                // Track level changes
                                if (currentLevel !== lastLevel) {
                                    lastLevel = currentLevel;
                                }

                                lastMenuMode = currentMenuMode;
                            }
                        } catch (e) {
                            console.warn('Score monitoring error:', e);
                        }
                    }, 500); // Check every 500ms for more responsive updates

                    // Cleanup on unload
                    window.addEventListener('beforeunload', function() {
                        clearInterval(checkInterval);
                    });
                })();
            `;
        } else if (gameId === 'packabunchas') {
            return `
                (function() {
                    let lastScore = 0;
                    let checkInterval = setInterval(function() {
                        try {
                            // Packabunchas - need to find the score variable
                            // Check common patterns
                            let score = 0;

                            // Try to access game object
                            if (typeof game !== 'undefined' && game.score !== undefined) {
                                score = game.score;
                            } else if (typeof Game !== 'undefined' && Game.score !== undefined) {
                                score = Game.score;
                            } else {
                                // Try to find score in global scope
                                for (let key in window) {
                                    if (window[key] && typeof window[key] === 'object' && window[key].score !== undefined) {
                                        score = window[key].score;
                                        break;
                                    }
                                }
                            }

                            if (score !== lastScore) {
                                lastScore = score;
                                window.parent.postMessage({
                                    type: '${messageType}',
                                    score: score,
                                    gameOver: false
                                }, '*');
                            }
                        } catch (e) {
                            console.warn('Score monitoring error:', e);
                        }
                    }, 1000); // Check every second

                    // Cleanup on unload
                    window.addEventListener('beforeunload', function() {
                        clearInterval(checkInterval);
                    });
                })();
            `;
        }

        return ''; // No script for unknown games
    }
}
