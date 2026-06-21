import { $ } from '../main.js';

class StudentGameHtmlLoaderMethods {
    async loadHTMLGame(gameId, htmlFile, scoreMessageType, gameOverCallback, canvas, gameStage) {
        // Hide canvas and create iframe for the HTML game
        canvas.style.display = 'none';
        
        // Remove any previous frame for this game.
        const existingFrameShell = gameStage.querySelector(`#${gameId}-frame-shell`);
        if (existingFrameShell) {
            existingFrameShell.remove();
        }
        const existingIframe = gameStage.querySelector(`#${gameId}-iframe`);
        if (existingIframe) {
            existingIframe.remove();
        }
        
        // All games now have standalone HTML files, no build checks needed
        if (gameStage) {
            ['display', 'flex-direction', 'align-items', 'justify-content', 'width', 'min-width'].forEach((property) => {
                gameStage.style.removeProperty(property);
            });
        }
        
        // Create iframe for the HTML game
        const iframe = document.createElement('iframe');
        iframe.id = `${gameId}-iframe`;
        iframe.src = htmlFile;
        let frameWidth = 800;
        let frameHeight = 600;
        let scaleFixedFrame = true;
        
        // The stage owns each game's maximum width. Fill it so the iframe stays
        // aligned with the timer bar instead of collapsing to its 80% minimum.
        iframe.style.width = '100%';
        iframe.style.maxWidth = '100%';

        if (gameId === 'trapdoor-trials') {
            frameWidth = 960;
            frameHeight = 540;
            iframe.style.display = 'block';
            iframe.style.overflow = 'hidden';
        } else if (gameId === 'basic-platformer') {
            frameWidth = 1280;
            frameHeight = 720;
            iframe.style.display = 'block';
            iframe.style.overflow = 'hidden';
        // SpacePi: 960x600 game area
        } else if (gameId === 'spacepi') {
            frameWidth = 960;
            frameHeight = 600;
            iframe.style.display = 'block';
            iframe.style.overflow = 'auto';
        } else if (gameId === 'radius-raid') {
            // Radius Raid: 800x600 canvas + 10px padding each side = 820x620
            frameWidth = 820;
            frameHeight = 620;
            iframe.style.display = 'block';
            iframe.style.overflow = 'auto';
        } else if (gameId === 'mystic-valley' || gameId === 'slash-knight') {
            // Full-screen Scratch/TurboWarp games - let them size themselves
            scaleFixedFrame = false;
            iframe.style.height = '100%';
            iframe.style.minHeight = '600px';
            iframe.style.display = 'block';
            iframe.style.overflow = 'hidden';
        } else if (gameId === 'tilt-maze' || gameId === 'black-hole-square' || gameId === 'glitch-buster' || gameId === 'callisto' || gameId === 'js13k2021' || gameId === 'my-digital-garden' || gameId === 'grow-your-garden') {
            // Responsive games fill the stage and size their own content within it.
            scaleFixedFrame = false;
            if (gameId === 'my-digital-garden' || gameId === 'grow-your-garden') {
                frameHeight = 900;
            } else {
                frameHeight = 600;
            }
            iframe.style.height = `${frameHeight}px`;
            iframe.style.minHeight = '400px';
            iframe.style.display = 'block';
            iframe.style.overflow = 'auto';
        } else {
            iframe.style.display = 'block';
        }

        if (scaleFixedFrame) {
            iframe.style.width = `${frameWidth}px`;
            iframe.style.maxWidth = 'none';
            iframe.style.height = `${frameHeight}px`;
        }

        if (gameStage) {
            gameStage.style.setProperty('--game-frame-width', `${frameWidth}px`);
        }
        
        iframe.style.border = 'none';
        iframe.style.borderRadius = '8px';
        iframe.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        iframe.style.margin = '0 auto';
        iframe.tabIndex = 0; // Make iframe focusable

        let frameShell = null;
        let frameResizeObserver = null;

        if (scaleFixedFrame) {
            frameShell = document.createElement('div');
            frameShell.id = `${gameId}-frame-shell`;
            frameShell.style.position = 'relative';
            frameShell.style.gridColumn = '1';
            frameShell.style.gridRow = '2';
            frameShell.style.justifySelf = 'stretch';
            frameShell.style.alignSelf = 'start';
            frameShell.style.width = '100%';
            frameShell.style.maxWidth = '100%';
            frameShell.style.overflow = 'hidden';
            frameShell.style.borderRadius = '8px';

            iframe.style.position = 'absolute';
            iframe.style.top = '0';
            iframe.style.left = '0';
            iframe.style.margin = '0';
            iframe.style.transformOrigin = 'top left';

            const updateFixedFrameScale = () => {
                const availableWidth = frameShell.clientWidth || frameWidth;
                const scale = Math.min(1, availableWidth / frameWidth);
                iframe.style.transform = `scale(${scale})`;
                frameShell.style.height = `${frameHeight * scale}px`;
            };

            frameShell.appendChild(iframe);
            canvas.parentNode.insertBefore(frameShell, canvas.nextSibling);
            updateFixedFrameScale();

            if (typeof ResizeObserver !== 'undefined') {
                frameResizeObserver = new ResizeObserver(updateFixedFrameScale);
                frameResizeObserver.observe(frameShell);
            }
        } else {
            iframe.style.gridColumn = '1';
            iframe.style.gridRow = '2';
            iframe.style.justifySelf = 'center';
            iframe.style.alignSelf = 'start';
            canvas.parentNode.insertBefore(iframe, canvas.nextSibling);
        }
        
        // Focus iframe when clicked
        iframe.addEventListener('mouseenter', () => {
            iframe.focus();
        });
        
        iframe.addEventListener('click', () => {
            iframe.focus();
            try {
                if (iframe.contentWindow) {
                    iframe.contentWindow.focus();
                }
            } catch (e) {}
        });
        
        // Set up iframe onload handler for optimizations and score reporting
        const originalOnload = iframe.onload;
        iframe.onload = () => {
            // Focus the iframe so keyboard events work
            iframe.focus();
            
            // Also try to focus the iframe's content window
            try {
                if (iframe.contentWindow) {
                    iframe.contentWindow.focus();
                }
            } catch (e) {
                // Cross-origin restrictions may prevent this
                console.log('Could not focus iframe content window');
            }
            try {
                const iframeWindow = iframe.contentWindow;
                const iframeDoc = iframe.contentDocument || iframeWindow.document;
                
                // Performance optimizations for TurboWarp games
                if (gameId === 'mystic-valley') {
                    // Try multiple times to catch the VM when it's ready
                    let attempts = 0;
                    const maxAttempts = 20; // Try for up to 4 seconds (20 * 200ms)
                    
                    const optimizePerformance = () => {
                        attempts++;
                        try {
                            let vm = null;
                            
                            // Try to find VM in various locations
                            if (iframeWindow.vm) {
                                vm = iframeWindow.vm;
                            } else if (iframeWindow.Scratch && iframeWindow.Scratch.vm) {
                                vm = iframeWindow.Scratch.vm;
                            } else if (iframeWindow.packager && iframeWindow.packager.vm) {
                                vm = iframeWindow.packager.vm;
                            }
                            
                            if (vm) {
                                // Don't enable turbo mode (game may not support it)
                                // Just increase framerate from 10 to 60 FPS for better performance
                                if (vm.setFramerate) {
                                    vm.setFramerate(30);
                                    console.log(`[${gameId}] Framerate set to 60 FPS`);
                                }
                                
                                // Enable interpolation for smoother animation
                                if (vm.setInterpolation) {
                                    vm.setInterpolation(true);
                                    console.log(`[${gameId}] Interpolation enabled`);
                                }
                                
                                return true; // Success
                            }
                        } catch (error) {
                            // Silently continue trying
                        }
                        
                        // Try again if we haven't exceeded max attempts
                        if (attempts < maxAttempts) {
                            setTimeout(optimizePerformance, 200);
                        } else {
                            console.warn(`[${gameId}] Could not optimize performance after ${maxAttempts} attempts`);
                        }
                        return false;
                    };
                    
                    // Start trying after a short delay
                    setTimeout(optimizePerformance, 500);
                }
                
                // Inject score reporting script (if scoreMessageType is provided)
                if (scoreMessageType && gameId !== 'trapdoor-trials') {
                    try {
                        const script = iframeDoc.createElement('script');
                        script.textContent = this.getScoreMonitoringScript(gameId, scoreMessageType);
                        iframeDoc.body.appendChild(script);
                    } catch (error) {
                        console.warn(`Could not inject score monitoring for ${gameId}:`, error);
                    }
                }
            } catch (error) {
                // Cross-origin restrictions may prevent access
                console.warn(`Could not access iframe content for ${gameId}:`, error);
            }
            
            // Call original onload if it exists
            if (originalOnload) {
                originalOnload();
            }
        };
        
        // Set up message listener for score reporting (if scoreMessageType is provided)
        let messageHandler = null;
        if (scoreMessageType) {
            messageHandler = (event) => {
                // Verify message is from our iframe (security check)
                if (event.source === iframe.contentWindow && event.data && event.data.type === scoreMessageType) {
                    // Ensure score is a number
                    const score = Number(event.data.score) || 0;
                    const isGameOver = event.data.gameOver || false;
                    
                    // Extract optional progress metadata from HTML games.
                    const metadata = {
                        level: event.data.level,
                        deaths: event.data.deaths,
                        totalDeaths: event.data.totalDeaths,
                        completedLevels: event.data.completedLevels,
                        totalLevels: event.data.totalLevels,
                        completed: event.data.completed,
                        time: event.data.time,
                        originalScore: event.data.originalScore
                    };
                    
                    // Update score display dynamically
                    const scoreDisplay = $('#game-score');
                    if (scoreDisplay) {
                        scoreDisplay.style.display = 'block';
                        if (gameId === 'trapdoor-trials' && metadata.level) {
                            const progress = `${metadata.completedLevels || 0}/${metadata.totalLevels || 30}`;
                            scoreDisplay.textContent = `${metadata.completed ? 'Complete' : `Level ${metadata.level}`} | Cleared ${progress} | Attempts: ${metadata.deaths || 0}`;
                        } else {
                            scoreDisplay.textContent = `Score: ${score.toLocaleString()}`;
                        }
                    }
                    
                    // Store current score for final reporting (ensure it's a number)
                    const currentScore = Number(this.sm.currentGameScore) || 0;
                    this.sm.currentGameScore = Math.max(currentScore, score);
                    this.sm.currentGameMetadata = metadata; // Store metadata
                    
                    // Save score periodically (not just on game over) to ensure it's saved
                    // Compare as numbers to avoid string comparison issues
                    const lastSaved = Number(this.sm.lastSavedScore) || 0;
                    if (score > 0 && score !== lastSaved) {
                        this.sm.lastSavedScore = score;
                        console.log(`[Game] Saving score for ${gameId}: ${score} (previous saved: ${lastSaved})`);
                        this.saveHighScore(gameId, score, metadata).catch(err => {
                            console.error('Error saving score:', err);
                        });
                    }
                    
                    if (isGameOver) {
                        // Game completed - call the callback with final score
                        gameOverCallback(score);
                        // Remove listener after game over
                        window.removeEventListener('message', messageHandler);
                    }
                }
            };
            
            window.addEventListener('message', messageHandler);
        }
        
        // Initialize score tracking
        this.sm.currentGameScore = 0;
        this.sm.lastSavedScore = 0;
        this.sm.currentGameMetadata = null;
        
        // Store reference for cleanup
        this.sm.currentGame = {
            gameType: gameId,
            iframe: iframe,
            messageHandler: messageHandler,
            stop: () => {
                if (frameResizeObserver) {
                    frameResizeObserver.disconnect();
                }
                if (messageHandler) {
                    window.removeEventListener('message', messageHandler);
                }
                if (frameShell && frameShell.parentNode) {
                    frameShell.remove();
                } else if (iframe && iframe.parentNode) {
                    iframe.remove();
                }
                canvas.style.display = 'block';
                canvas.style.margin = '0 auto'; // Center the canvas
            }
        };
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

export function installStudentGameHtmlLoaderMethods(StudentGames) {
    for (const name of Object.getOwnPropertyNames(StudentGameHtmlLoaderMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentGames.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentGameHtmlLoaderMethods.prototype, name)
        );
    }
}
