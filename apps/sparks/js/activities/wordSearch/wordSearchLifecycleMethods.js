import { removeStudentActivityValue } from '../../student/persistence/studentStorage.js';

export const wordSearchLifecycleMethods = {
getScore() {
        if (this.words.length === 0) {
            return {
                score: 0,
                details: 'No word-search words available',
                isComplete: false
            };
        }

        const percentage = Math.round((this.foundWords.size / this.words.length) * 100);
        const isComplete = this.foundWords.size === this.words.length;
        
        // Show the completion options once when the round is complete.
        if (isComplete && !this.completionOverlay) {
            this.timeouts.schedule(() => this.showCompletionOverlay(), 500);
        }
        
        return {
            score: percentage,
            details: `Found ${this.foundWords.size} of ${this.words.length} words`,
            evidence: { correctCount: this.foundWords.size, totalCount: this.words.length },
            isComplete
        };
    },

startNewPuzzle() {
        if (typeof this.options.onNewPuzzle === 'function') {
            this.options.onNewPuzzle();
        } else {
            this.restart();
        }
    },

restart() {
        // Clear saved state
        const key = `word_search_state_${this.vocabID}`;
        removeStudentActivityValue(key);
        
        // Reset game state
        this.grid = [];
        this.wordPositions = [];
        this.foundWords = new Set();
        this.isSelecting = false;
        this.selectedCells = [];
        
        // Generate new grid
        this.generateGrid();
        
        // Notify progress system of new session
        if (this.onProgress) {
            this.onProgress({ score: 0, details: 'Found 0 of ' + this.words.length + ' words', isComplete: false, isReplay: true });
        }
        
        this.render();
    },

destroy() {
        this.timeouts.clear();
        this.completionOverlay?.remove();
        this.completionOverlay = null;
        this.detachPointerListeners();
        this.onProgress = null;
        this.onSaveState = null;
    }
};

