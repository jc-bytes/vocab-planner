import {
    readStudentActivityValue,
    writeStudentActivityValue
} from '../../student/persistence/studentStorage.js';

export const crosswordGridStateMethods = {
init() {
        if (!this.restoreState()) {
            this.generateGrid();
        }
        this.render();
    },

restoreState() {
        // Try initial state passed from StudentManager (Cloud/Local consolidated)
        if (this.initialState) {
            this.grid = this.initialState.grid;
            this.placedWords = this.initialState.placedWords;
            this.revealedWordNumbers = new Set(this.initialState.revealedWordNumbers || []);
            this.solvedWordNumbers = new Set(
                this.initialState.solvedWordNumbers || this.findCompletedWordNumbers()
            );
            return true;
        }

        // Fallback to local storage if not found in manager (legacy or direct usage)
        const key = `crossword_state_${this.words.length}`; // Simple key
        const saved = readStudentActivityValue(key);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.grid = state.grid;
                this.placedWords = state.placedWords;
                this.revealedWordNumbers = new Set(state.revealedWordNumbers || []);
                this.solvedWordNumbers = new Set(
                    state.solvedWordNumbers || this.findCompletedWordNumbers()
                );
                return true;
            } catch (e) {
                console.error('Failed to restore crossword state', e);
            }
        }
        return false;
    },

saveState() {
        const state = {
            grid: this.grid,
            placedWords: this.placedWords,
            revealedWordNumbers: Array.from(this.revealedWordNumbers),
            solvedWordNumbers: Array.from(this.solvedWordNumbers)
        };

        // Save via callback (to StudentManager -> backend)
        if (this.onSaveState) {
            this.onSaveState(state);
        }

        // Also save locally as backup/legacy
        const key = `crossword_state_${this.words.length}`;
        writeStudentActivityValue(key, JSON.stringify(state));
    },

generateGrid() {
        // Initialize empty grid
        for (let i = 0; i < this.gridSize; i++) {
            this.grid[i] = new Array(this.gridSize).fill(null);
        }

        // Sort words by length descending
        const sortedWords = [...this.words].sort((a, b) => b.word.length - a.word.length);

        this.placedWords = [];

        // Place first word in the middle
        if (sortedWords.length > 0) {
            const first = sortedWords[0];
            const startRow = Math.floor(this.gridSize / 2);
            const startCol = Math.floor((this.gridSize - first.word.length) / 2);
            this.placeWord(first, startRow, startCol, 'across');
        }

        // Try to place remaining words
        for (let i = 1; i < sortedWords.length; i++) {
            const wordObj = sortedWords[i];
            this.findSpotForWord(wordObj);
        }
    },

placeWord(wordObj, row, col, direction) {
        const word = wordObj.word.toUpperCase();
        for (let i = 0; i < word.length; i++) {
            const r = direction === 'across' ? row : row + i;
            const c = direction === 'across' ? col + i : col;
            // Ensure the cell object exists before assigning
            if (!this.grid[r][c]) {
                this.grid[r][c] = { char: word[i], wordIndex: this.placedWords.length, isStart: i === 0, value: '' };
            } else {
                // Overlap, just update properties if needed, but preserve existing object structure if complex
                // actually, just ensure we don't overwrite if it's already there?
                // The original code overwrote: this.grid[r][c] = { ... }
                // We need to preserve 'value' if we are restoring? No, generateGrid is only called if NOT restoring.
                // So we can just init 'value' to empty string.
                this.grid[r][c].char = word[i];
                // Merge other props
            }
            this.grid[r][c] = { char: word[i], wordIndex: this.placedWords.length, isStart: i === 0, value: '' };
        }
        this.placedWords.push({
            ...wordObj,
            row,
            col,
            direction,
            number: this.placedWords.length + 1
        });
    },

findSpotForWord(wordObj) {
        const word = wordObj.word.toUpperCase();

        // Try to intersect with existing words
        // This is a simplified placement algorithm
        // We iterate through placed words, find common letters, and try to place perpendicular

        for (const placed of this.placedWords) {
            const placedWord = placed.word.toUpperCase();

            for (let i = 0; i < word.length; i++) {
                for (let j = 0; j < placedWord.length; j++) {
                    if (word[i] === placedWord[j]) {
                        // Potential intersection
                        const intersectRow = placed.direction === 'across' ? placed.row : placed.row + j;
                        const intersectCol = placed.direction === 'across' ? placed.col + j : placed.col;

                        if (placed.direction === 'across') {
                            // Try placing vertical
                            const startRow = intersectRow - i;
                            const startCol = intersectCol;
                            if (this.canPlace(word, startRow, startCol, 'down')) {
                                this.placeWord(wordObj, startRow, startCol, 'down');
                                return;
                            }
                        } else {
                            // Try placing across
                            const startRow = intersectRow;
                            const startCol = intersectCol - i;
                            if (this.canPlace(word, startRow, startCol, 'across')) {
                                this.placeWord(wordObj, startRow, startCol, 'across');
                                return;
                            }
                        }
                    }
                }
            }
        }
    },

canPlace(word, row, col, direction) {
        if (row < 0 || col < 0) return false;
        if (direction === 'across') {
            if (col + word.length > this.gridSize) return false;
        } else {
            if (row + word.length > this.gridSize) return false;
        }

        for (let i = 0; i < word.length; i++) {
            const r = direction === 'across' ? row : row + i;
            const c = direction === 'across' ? col + i : col;

            const cell = this.grid[r][c];
            if (cell && cell.char !== word[i]) return false; // Conflict

            // Check neighbors to ensure we don't accidentally create adjacent words
            // This part is tricky in a simple implementation, skipping for brevity but ideally needed
            // A simple check: if cell is empty, neighbors perpendicular to direction must be empty
            if (!cell) {
                if (direction === 'across') {
                    if (r > 0 && this.grid[r - 1][c]) return false;
                    if (r < this.gridSize - 1 && this.grid[r + 1][c]) return false;
                } else {
                    if (c > 0 && this.grid[r][c - 1]) return false;
                    if (c < this.gridSize - 1 && this.grid[r][c + 1]) return false;
                }
            }

            // Also check ends
            if (i === 0) {
                if (direction === 'across' && c > 0 && this.grid[r][c - 1]) return false;
                if (direction === 'down' && r > 0 && this.grid[r - 1][c]) return false;
            }
            if (i === word.length - 1) {
                if (direction === 'across' && c < this.gridSize - 1 && this.grid[r][c + 1]) return false;
                if (direction === 'down' && r < this.gridSize - 1 && this.grid[r + 1][c]) return false;
            }
        }
        return true;
    },

getCell(r, c) {
        return this.container.querySelector(`input[data-row="${r}"][data-col="${c}"]`);
    },

getCellWrapper(r, c) {
        return this.container.querySelector(`.cw-grid-cell[data-row="${r}"][data-col="${c}"]`);
    },

getActiveWord() {
        return this.placedWords.find(word => word.number === this.activeWordNumber) || null;
    },

getWordCells(wordObj) {
        const cells = [];
        const word = wordObj.word.toUpperCase();
        for (let i = 0; i < word.length; i++) {
            cells.push({
                row: wordObj.direction === 'across' ? wordObj.row : wordObj.row + i,
                col: wordObj.direction === 'across' ? wordObj.col + i : wordObj.col
            });
        }
        return cells;
    },

getWordsAtCell(r, c) {
        return this.placedWords.filter(word => (
            this.getWordCells(word).some(cell => cell.row === r && cell.col === c)
        ));
    },

findCompletedWordNumbers() {
        return (this.placedWords || [])
            .filter(word => this.isWordCorrect(word))
            .map(word => word.number);
    },

isWordCorrect(wordObj) {
        return this.getWordCells(wordObj).every(({ row, col }) => {
            const cell = this.grid[row]?.[col];
            return Boolean(cell?.value) && cell.value.toUpperCase() === cell.char;
        });
    },

getSolvedCount() {
        return this.solvedWordNumbers.size;
    },

syncSolvedState() {
        this.container.querySelectorAll('.cw-cell').forEach(input => {
            const row = Number(input.dataset.row);
            const col = Number(input.dataset.col);
            const belongsToSolvedWord = this.getWordsAtCell(row, col)
                .some(word => this.solvedWordNumbers.has(word.number));
            input.classList.toggle('solved', belongsToSolvedWord);
            input.readOnly = belongsToSolvedWord;
        });
        this.container.querySelectorAll('.cw-clue-item').forEach(item => {
            item.classList.toggle('solved', this.solvedWordNumbers.has(Number(item.dataset.wordNumber)));
        });
    },
};

