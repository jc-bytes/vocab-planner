import { $ } from '../main.js';
import { getStudentGame } from './studentGameRegistry.js';
import { StudentGameScoreMonitor } from './studentGameScoreMonitor.js';

const GAME_STORAGE_PREFIX = 'vocab-game-storage:';
const MAX_GAME_STORAGE_ENTRIES = 250;
const MAX_GAME_STORAGE_SIZE = 1_000_000;

function readGameStorage(gameId) {
    try {
        const entries = JSON.parse(localStorage.getItem(`${GAME_STORAGE_PREFIX}${gameId}`) || '[]');
        return Array.isArray(entries) ? entries : [];
    } catch (_error) {
        return [];
    }
}

function isSafeStorageEntries(entries) {
    if (!Array.isArray(entries) || entries.length > MAX_GAME_STORAGE_ENTRIES) return false;
    let size = 0;
    for (const entry of entries) {
        if (!Array.isArray(entry) || entry.length !== 2) return false;
        const key = String(entry[0]);
        const value = String(entry[1]);
        size += key.length + value.length;
        if (size > MAX_GAME_STORAGE_SIZE) return false;
    }
    return true;
}

export class StudentGameHtmlLoader {
    constructor(games) {
        this.games = games;
        this.sm = games.sm;
        this.scoreMonitor = new StudentGameScoreMonitor(this);
    }

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
        const storageChannel = crypto.randomUUID();
        iframe.name = `${GAME_STORAGE_PREFIX}${JSON.stringify({
            gameId,
            channel: storageChannel,
            entries: readGameStorage(gameId)
        })}`;
        iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-downloads allow-pointer-lock');
        iframe.setAttribute('allow', 'fullscreen');
        iframe.referrerPolicy = 'no-referrer';
        iframe.src = htmlFile;
        const game = getStudentGame(gameId);
        const frame = game?.launch?.frame || {};
        const frameWidth = frame.width || 800;
        const frameHeight = frame.height || 600;
        const scaleFixedFrame = frame.responsive !== true;
        
        // The stage owns each game's maximum width. Fill it so the iframe stays
        // aligned with the timer bar instead of collapsing to its 80% minimum.
        iframe.style.width = '100%';
        iframe.style.maxWidth = '100%';

        iframe.style.display = 'block';
        if (frame.overflow) iframe.style.overflow = frame.overflow;

        if (!scaleFixedFrame) {
            // Responsive games fill the stage and size their own content within it.
            iframe.style.height = `${frameHeight}px`;
            iframe.style.minHeight = '400px';
            iframe.style.overflow = frame.overflow || 'auto';
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
            // Call original onload if it exists
            if (originalOnload) {
                originalOnload();
            }
        };
        
        // Set up message listener for score reporting (if scoreMessageType is provided)
        let messageHandler = null;
        const storageMessageHandler = (event) => {
            const data = event.data;
            if (event.source !== iframe.contentWindow
                || data?.type !== 'vocab-game-storage'
                || data.gameId !== gameId
                || data.channel !== storageChannel
                || !isSafeStorageEntries(data.entries)) return;
            try {
                localStorage.setItem(`${GAME_STORAGE_PREFIX}${gameId}`, JSON.stringify(data.entries));
            } catch (error) {
                console.warn(`Could not persist sandboxed storage for ${gameId}:`, error);
            }
        };
        window.addEventListener('message', storageMessageHandler);
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
                    const currentScore = Number(this.games.currentGameScore) || 0;
                    this.games.currentGameScore = Math.max(currentScore, score);
                    this.games.currentGameMetadata = metadata; // Store metadata
                    
                    // Save score periodically (not just on game over) to ensure it's saved
                    // Compare as numbers to avoid string comparison issues
                    const lastSaved = Number(this.games.lastSavedScore) || 0;
                    if (score > 0 && score !== lastSaved) {
                        this.games.lastSavedScore = score;
                        console.log(`[Game] Saving score for ${gameId}: ${score} (previous saved: ${lastSaved})`);
                        this.games.saveHighScore(gameId, score, metadata).catch(err => {
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
        this.games.currentGameScore = 0;
        this.games.lastSavedScore = 0;
        this.games.currentGameMetadata = null;
        
        // Store reference for cleanup
        this.games.currentGame = {
            gameType: gameId,
            iframe: iframe,
            messageHandler: messageHandler,
            storageMessageHandler,
            stop: () => {
                if (frameResizeObserver) {
                    frameResizeObserver.disconnect();
                }
                if (messageHandler) {
                    window.removeEventListener('message', messageHandler);
                }
                window.removeEventListener('message', storageMessageHandler);
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
        return this.scoreMonitor.getScoreMonitoringScript(gameId, messageType);
    }

}
