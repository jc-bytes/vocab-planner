import { removeStudentActivityValue } from '../../student/persistence/studentStorage.js';

export const crosswordLifecycleMethods = {
getScore() {
        const solved = this.solvedWordNumbers.size;
        const total = this.placedWords.length;
        const score = total === 0 ? 0 : Math.round((solved / total) * 100);
        return {
            score,
            details: `${solved}/${total} words solved`,
            evidence: { correctCount: solved, totalCount: total },
            isComplete: total > 0 && solved === total
        };
    },

clearPuzzle() {
        this.container.querySelectorAll('.cw-cell').forEach(input => {
            const row = Number(input.dataset.row);
            const col = Number(input.dataset.col);
            input.value = '';
            input.classList.remove('solved', 'word-incorrect', 'hinted');
            input.readOnly = false;
            if (this.grid[row][col]) this.grid[row][col].value = '';
        });
        this.solvedWordNumbers.clear();
        this.activeFeedback = null;
        this.saveState();
        this.checkProgress();
        this.updateProgressUI();
        this.updateActiveClue();
        this.updateCheckButton();
    },

checkProgress() {
        const score = this.getScore();
        if (this.onProgress) {
            this.onProgress(score);
        }
        
        // Show completion overlay when done
        if (score.isComplete && !this.container.querySelector('#replay-crossword')) {
            this.timeouts.schedule(() => this.showCompletionOverlay(), 500);
        }
    },

restart() {
        // Clear saved state
        const key = `crossword_state_${this.words.length}`;
        removeStudentActivityValue(key);
        
        // Reset game state
        this.grid = [];
        this.placedWords = [];
        this.score = 0;
        this.revealedWordNumbers = new Set();
        this.solvedWordNumbers = new Set();
        this.activeFeedback = null;
        
        // Generate new grid
        this.generateGrid();
        
        // Notify progress system of new session
        if (this.onProgress) {
            this.onProgress({ score: 0, details: '0/0 words solved', isComplete: false, isReplay: true });
        }
        
        this.render();
    },

destroy() {
        this.timeouts.clear();
        this.completionOverlay?.remove();
        this.completionOverlay = null;
        this.onProgress = null;
        this.onSaveState = null;
    },
};

