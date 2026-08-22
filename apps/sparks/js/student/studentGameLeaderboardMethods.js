import { $, closeModal, escapeHtml, openModal } from '../main.js';
import { notifications } from '../notifications.js';
import { studentApi as supabaseService } from '../services/studentApi.js';
import { leaderboardRepository } from '../services/leaderboardRepository.js';
import { getLeaderboardGameIds } from './studentGameRegistry.js';
import { getStudentPageSkeleton } from './studentLoadingSkeletons.js';

const LEADERBOARD_ENABLED_GAMES = getLeaderboardGameIds();
const SCORE_CHECKPOINT_INTERVAL_MS = 15000;

export class StudentGameLeaderboard {
    constructor(games) {
        this.games = games;
        this.sm = games.sm;
        this.scoreSyncStates = new Map();
    }

    isBetterScore(score, previous, lowerIsBetter) {
        if (previous === null || previous === undefined) return true;
        return lowerIsBetter ? score < previous : score > previous;
    }

    buildScoreMetadata(gameId, metadata) {
        if (gameId !== 'trapdoor-trials' || !metadata) return {};
        return {
            level: metadata.level || 0,
            deaths: metadata.deaths || 0,
            totalDeaths: metadata.totalDeaths || 0,
            completedLevels: metadata.completedLevels || 0,
            totalLevels: metadata.totalLevels || 0,
            completed: Boolean(metadata.completed),
            time: metadata.time || 0
        };
    }

    saveHighScore(gameId, score, metadata = null, options = {}) {
        if (this.sm.authDisabled) {
            return Promise.resolve(null);
        }

        // Only save scores for games with leaderboards enabled
        if (!LEADERBOARD_ENABLED_GAMES.includes(gameId)) {
            return Promise.resolve(null); // This game doesn't have leaderboard support
        }
        if (!this.sm.currentUser) {
            return Promise.resolve(null); // Only save if logged in
        }
        if (!this.sm.studentProfile.grade) {
            return Promise.resolve(null); // Need grade for leaderboard
        }

        // Ensure score is a number
        const numericScore = typeof score === 'number' ? score : Number(score) || 0;
        if (numericScore <= 0 && gameId !== 'spacepi') {
            // Don't save zero or negative scores (except for SpacePi where lower can be better)
            return Promise.resolve(null);
        }

        const lowerIsBetter = gameId === 'spacepi';
        let state = this.scoreSyncStates.get(gameId);
        if (!state) {
            state = {
                bestObserved: null,
                bestPersisted: null,
                pending: null,
                inFlight: null,
                timer: null,
                lastSubmittedAt: 0
            };
            this.scoreSyncStates.set(gameId, state);
        }

        if (!this.isBetterScore(numericScore, state.bestObserved, lowerIsBetter)) {
            return state.inFlight || Promise.resolve(null);
        }

        state.bestObserved = numericScore;
        state.pending = {
            gameId,
            score: numericScore,
            metadata: this.buildScoreMetadata(gameId, metadata),
            immediate: Boolean(options.immediate)
        };

        const checkpointDue = Date.now() - state.lastSubmittedAt >= SCORE_CHECKPOINT_INTERVAL_MS;
        if (state.pending.immediate || checkpointDue) return this.flushHighScore(gameId);
        this.scheduleHighScoreFlush(gameId, SCORE_CHECKPOINT_INTERVAL_MS - (Date.now() - state.lastSubmittedAt));
        return state.inFlight || Promise.resolve(null);
    }

    scheduleHighScoreFlush(gameId, delayMs) {
        const state = this.scoreSyncStates.get(gameId);
        if (!state || state.timer) return;
        state.timer = window.setTimeout(() => {
            state.timer = null;
            void this.flushHighScore(gameId);
        }, Math.max(0, delayMs));
    }

    async flushHighScore(gameId) {
        const state = this.scoreSyncStates.get(gameId);
        if (!state) return null;
        if (state.timer) {
            window.clearTimeout(state.timer);
            state.timer = null;
        }
        if (state.inFlight) {
            await state.inFlight;
            return state.pending ? this.flushHighScore(gameId) : null;
        }
        if (!state.pending) return null;

        const submission = state.pending;
        state.pending = null;
        state.lastSubmittedAt = Date.now();
        state.inFlight = (async () => {
            try {
                const saved = await supabaseService.submitStudentGameScore(submission);
                const savedScore = Number(saved?.score);
                if (Number.isFinite(savedScore)) state.bestPersisted = savedScore;
                if (this.games.gamesList[this.games.currentGameIndex]?.id === gameId) {
                    await this.loadLeaderboard(gameId);
                }
                return saved;
            } catch (error) {
                console.error('Error saving score:', error);
                notifications.warning('Could not save your score to the leaderboard. Your game can continue.');
                return null;
            }
        })();

        try {
            return await state.inFlight;
        } finally {
            state.inFlight = null;
            if (state.pending?.immediate) {
                void this.flushHighScore(gameId);
            } else if (state.pending) {
                this.scheduleHighScoreFlush(gameId, SCORE_CHECKPOINT_INTERVAL_MS);
            }
        }
    }

    updateLeaderboardGame() {
        const game = this.games.gamesList[this.games.currentGameIndex];
        const nameEl = $('#current-game-name');
        if (nameEl) nameEl.textContent = game.name;
        
        // Update leaderboard button visibility
        const leaderboardBtn = $('#show-leaderboard-btn');
        if (leaderboardBtn) {
            if (LEADERBOARD_ENABLED_GAMES.includes(game.id)) {
                leaderboardBtn.style.display = 'inline-block';
            } else {
                leaderboardBtn.style.display = 'none';
            }
        }
        
    }

    showLeaderboardModal() {
        const modal = $('#leaderboard-modal');
        if (modal) {
            openModal(modal, { initialFocus: '#close-leaderboard-modal' });
            // Reload leaderboard for current game
            const game = this.games.gamesList[this.games.currentGameIndex];
            if (game) {
                this.loadLeaderboard(game.id);
            }
        }
    }

    hideLeaderboardModal() {
        const modal = $('#leaderboard-modal');
        if (modal) {
            closeModal(modal);
        }
    }

    async loadLeaderboard(gameId) {
        const container = $('#leaderboard-list');
        if (!container) return; // Modal might not be in DOM yet

        if (this.sm.authDisabled) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Leaderboards are disabled in local development.</p>';
            return;
        }

        // Only show if we have a grade to filter by
        if (!this.sm.studentProfile.grade) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Ask your teacher to add your profile grade to see the leaderboard.</p>';
            return;
        }

        container.innerHTML = getStudentPageSkeleton('list', 'Loading scores');

        try {
            // Query: Same grade, same game, order by score (desc for higher=better, asc for lower=better)
            // Note: This requires a composite index in Supabase.
            // If it fails, check console for index creation link.
            // SpacePi uses "lower is better" scoring
            const isLowerBetter = gameId === 'spacepi';
            const scores = await leaderboardRepository.listTop({
                grade: this.sm.studentProfile.grade,
                gameId,
                lowerIsBetter: isLowerBetter,
                limit: 5
            });

            container.innerHTML = '';

            if (scores.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No scores yet. Be the first!</p>';
                return;
            }

            let rank = 1;
            scores.forEach((data) => {
                // Ensure score is a number for display
                const score = Number(data.score) || 0;
                const displayName = escapeHtml(data.name || 'Student');
                const isMe = this.sm.currentUser && data.userId === this.sm.currentUser.uid;

                const row = document.createElement('div');
                row.className = `leaderboard-row ${isMe ? 'highlight' : ''}`;
                row.style.display = 'flex';
                row.style.flexDirection = 'column';
                row.style.padding = '0.75rem 1rem';
                row.style.background = isMe ? 'rgba(139, 92, 246, 0.1)' : 'var(--surface-color)';
                row.style.borderRadius = '8px';
                row.style.border = '1px solid var(--border-color)';
                row.style.marginBottom = '0.5rem';

                if (gameId === 'trapdoor-trials' && data.metadata) {
                    const meta = data.metadata;
                    const level = Math.max(1, Number.parseInt(meta.level, 10) || 1);
                    const completedLevels = Math.max(0, Number.parseInt(meta.completedLevels, 10) || 0);
                    const totalLevels = Math.max(1, Number.parseInt(meta.totalLevels, 10) || 30);
                    const deaths = Math.max(0, Number.parseInt(meta.deaths, 10) || 0);
                    row.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                            <span style="font-weight: bold; width: 30px;">#${rank}</span>
                            <span style="flex-grow: 1; font-weight: 500;">${displayName}</span>
                            <span style="font-weight: bold; color: var(--primary-color); font-size: 0.9rem;">${meta.completed === true ? 'Complete' : `Level ${level}`}</span>
                        </div>
                        <div style="display: flex; gap: 1rem; font-size: 0.85rem; color: var(--text-muted); margin-left: 30px;">
                            <span>Cleared: <strong>${completedLevels}/${totalLevels}</strong></span>
                            <span>Attempts: <strong>${deaths}</strong></span>
                            <span>Score: <strong>${score.toLocaleString()}</strong></span>
                        </div>
                    `;
                } else {
                    // Regular game display
                    row.style.flexDirection = 'row';
                    row.style.justifyContent = 'space-between';
                    row.innerHTML = `
                        <span style="font-weight: bold; width: 30px;">#${rank}</span>
                        <span style="flex-grow: 1;">${displayName}</span>
                        <span style="font-weight: bold; color: var(--primary-color);">${score.toLocaleString()}</span>
                    `;
                }

                container.appendChild(row);
                rank++;
            });

        } catch (error) {
            console.error('Error loading leaderboard:', error);
            container.innerHTML = '<p style="text-align: center; color: var(--danger-color);">Could not load leaderboard. (Index might be building)</p>';
        }
    }
}
