import { $, closeModal, openModal } from '../main.js';
import { notifications } from '../notifications.js';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    studentApi as supabaseService,
    where
} from '../services/studentApi.js';

class StudentGameLeaderboardMethods {
    async saveHighScore(gameId, score, metadata = null) {
        if (this.sm.authDisabled) {
            return;
        }

        // Games with leaderboards enabled
        const gamesWithLeaderboard = ['galactic-breaker', 'level-devil', 'radius-raid', 'packabunchas', 'spacepi'];
        
        // Only save scores for games with leaderboards enabled
        if (!gamesWithLeaderboard.includes(gameId)) {
            return; // This game doesn't have leaderboard support
        }
        if (!this.sm.currentUser) {
            return; // Only save if logged in
        }
        if (!this.sm.studentProfile.grade) {
            return; // Need grade for leaderboard
        }

        // Ensure score is a number
        const numericScore = typeof score === 'number' ? score : Number(score) || 0;
        if (numericScore <= 0 && gameId !== 'spacepi') {
            // Don't save zero or negative scores (except for SpacePi where lower can be better)
            return;
        }

        try {
            const db = supabaseService.getDatabase();
            const scoresRef = collection(db, 'scores');

            // Use a deterministic document ID: userId-gameId
            // This ensures each player has only one entry per game
            const scoreDocId = `${this.sm.currentUser.uid}-${gameId}`;
            const scoreDocRef = doc(scoresRef, scoreDocId);

            // Check if we already have a score
            const existingDoc = await getDoc(scoreDocRef);

            // Only update if this is a new high score or first time playing
            // Note: SpacePi uses "lower is better" scoring, so invert the comparison
            const existingScore = existingDoc.exists() ? (Number(existingDoc.data().score) || 0) : 0;
            const isLowerBetter = gameId === 'spacepi';
            const isNewHighScore = isLowerBetter 
                ? (!existingDoc.exists() || numericScore < existingScore)
                : (!existingDoc.exists() || numericScore > existingScore);
            
            if (isNewHighScore) {
                const scoreMetadata = {};
                if (gameId === 'level-devil' && metadata) {
                    scoreMetadata.level = metadata.level || 0;
                    scoreMetadata.deaths = metadata.deaths || 0;
                    scoreMetadata.time = metadata.time || 0;
                }

                await supabaseService.submitStudentGameScore({
                    gameId,
                    score: numericScore,
                    metadata: scoreMetadata
                });
                console.log(`[Leaderboard] Saved score for ${gameId}: ${numericScore} (previous: ${existingScore})`);

                // Refresh leaderboard if we're viewing this game
                if (this.sm.gamesList && this.sm.gamesList[this.sm.currentGameIndex] && this.sm.gamesList[this.sm.currentGameIndex].id === gameId) {
                    this.loadLeaderboard(gameId);
                }
            } else {
                console.log(`[Leaderboard] Score not saved for ${gameId}: ${numericScore} is not better than ${existingScore} (isLowerBetter: ${isLowerBetter})`);
            }
        } catch (error) {
            console.error('Error saving score:', error);
            notifications.warning('Could not save your score to the leaderboard. Your progress is still saved locally.');
        }
    }

    updateLeaderboardGame() {
        const game = this.sm.gamesList[this.sm.currentGameIndex];
        const nameEl = $('#current-game-name');
        if (nameEl) nameEl.textContent = game.name;
        
        // Games with score reporting enabled should show leaderboard
        const gamesWithLeaderboard = ['level-devil', 'radius-raid', 'packabunchas', 'spacepi', 
                                      'black-hole-square', 'glitch-buster', 'callisto', 'js13k2021',
                                      'mystic-valley', 'slash-knight'];
        
        // Update leaderboard button visibility
        const leaderboardBtn = $('#show-leaderboard-btn');
        if (leaderboardBtn) {
            if (gamesWithLeaderboard.includes(game.id) || !this.sm.htmlGames.includes(game.id)) {
                leaderboardBtn.style.display = 'inline-block';
            } else {
                leaderboardBtn.style.display = 'none';
            }
        }
        
        // Load leaderboard data (will be shown when modal opens)
        if (gamesWithLeaderboard.includes(game.id) || !this.sm.htmlGames.includes(game.id)) {
            this.loadLeaderboard(game.id);
        }
    }

    showLeaderboardModal() {
        const modal = $('#leaderboard-modal');
        if (modal) {
            openModal(modal, { initialFocus: '#close-leaderboard-modal' });
            // Reload leaderboard for current game
            const game = this.sm.gamesList[this.sm.currentGameIndex];
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
        if (!container) return;

        if (this.sm.authDisabled) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Leaderboards are disabled in local development.</p>';
            return;
        }

        // Only show if we have a grade to filter by
        if (!this.sm.studentProfile.grade) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Ask your teacher to add your profile grade to see the leaderboard.</p>';
            return;
        }

        container.innerHTML = '<div class="loading-spinner">Loading scores...</div>';

        try {
            const db = supabaseService.getDatabase();
            const scoresRef = collection(db, 'scores');

            // Query: Same grade, same game, order by score (desc for higher=better, asc for lower=better)
            // Note: This requires a composite index in Supabase.
            // If it fails, check console for index creation link.
            // SpacePi uses "lower is better" scoring
            const isLowerBetter = gameId === 'spacepi';
            const q = query(
                scoresRef,
                where('grade', '==', this.sm.studentProfile.grade),
                where('gameId', '==', gameId),
                orderBy('score', isLowerBetter ? 'asc' : 'desc'),
                limit(5)
            );

            const querySnapshot = await getDocs(q);

            container.innerHTML = '';

            if (querySnapshot.empty) {
                container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No scores yet. Be the first!</p>';
                return;
            }

            let rank = 1;
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Ensure score is a number for display
                const score = Number(data.score) || 0;
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

                // For Level Devil, show metadata
                if (gameId === 'level-devil' && data.metadata) {
                    const meta = data.metadata;
                    row.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                            <span style="font-weight: bold; width: 30px;">#${rank}</span>
                            <span style="flex-grow: 1; font-weight: 500;">${data.name}</span>
                            <span style="font-weight: bold; color: var(--primary-color); font-size: 0.9rem;">Score: ${score.toLocaleString()}</span>
                        </div>
                        <div style="display: flex; gap: 1rem; font-size: 0.85rem; color: var(--text-muted); margin-left: 30px;">
                            <span>Level: <strong>${meta.level || 0}</strong></span>
                            <span>Deaths: <strong>${meta.deaths || 0}</strong></span>
                            <span>Time: <strong>${this.formatTime(meta.time || 0)}</strong></span>
                        </div>
                    `;
                } else {
                    // Regular game display
                    row.style.flexDirection = 'row';
                    row.style.justifyContent = 'space-between';
                    row.innerHTML = `
                        <span style="font-weight: bold; width: 30px;">#${rank}</span>
                        <span style="flex-grow: 1;">${data.name}</span>
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

export function installStudentGameLeaderboardMethods(StudentGames) {
    for (const name of Object.getOwnPropertyNames(StudentGameLeaderboardMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentGames.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentGameLeaderboardMethods.prototype, name)
        );
    }
}
