import { readStudentActivityValue, writeStudentActivityValue } from '../../student/persistence/studentStorage.js';

export const wordSearchPuzzleStateMethods = {
prepareWords(words) {
        return words
            .map(wordObj => ({
                ...wordObj,
                puzzleWord: this.normalizeWord(wordObj.word)
            }))
            .filter(wordObj => wordObj.puzzleWord.length >= 2 && wordObj.puzzleWord.length <= this.gridSize);
    },

normalizeWord(word) {
        return String(word || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    },

getOriginalLabel(wordObj) {
        return String(wordObj.word || '')
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/\b[A-Za-z]/g, char => char.toUpperCase());
    },

restoreState() {
        if (this.applySavedState(this.initialState)) return;

        // Use vocabID in key for stability
        const key = `word_search_state_${this.vocabID}`;
        const saved = readStudentActivityValue(key);

        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.applySavedState(state);
            } catch (e) {
                console.error('Error restoring word search state:', e);
            }
        }
    },

applySavedState(state) {
        if (!state || typeof state !== 'object') return false;
        if (state.wordsLength !== this.words.length) return false;
        if (!this.hasMatchingWordKeys(state.wordKeys)) return false;
        if (!Array.isArray(state.grid) || !Array.isArray(state.wordPositions)) return false;

        this.grid = state.grid;
        this.wordPositions = state.wordPositions;
        this.foundWords = new Set(Array.isArray(state.foundWords) ? state.foundWords : []);
        return true;
    },

hasMatchingWordKeys(wordKeys) {
        if (!Array.isArray(wordKeys) || wordKeys.length === 0) return true;
        if (wordKeys.length !== this.words.length) return false;
        return wordKeys.every((wordKey, index) => wordKey === this.words[index]?.word);
    },

saveState() {
        const key = `word_search_state_${this.vocabID}`;
        const state = {
            grid: this.grid,
            wordPositions: this.wordPositions,
            foundWords: Array.from(this.foundWords),
            wordKeys: this.words.map(word => word.word),
            wordsLength: this.words.length
        };
        writeStudentActivityValue(key, JSON.stringify(state));
        if (typeof this.onSaveState === 'function') {
            this.onSaveState(state);
        }
    },

generateGrid() {
        // Initialize empty grid - use explicit loops to avoid fill() issues
        this.grid = [];
        for (let i = 0; i < this.gridSize; i++) {
            this.grid[i] = [];
            for (let j = 0; j < this.gridSize; j++) {
                this.grid[i][j] = '';
            }
        }

        // Directions: [rowDelta, colDelta]
        const directions = [
            [0, 1],   // Right
            [1, 0],   // Down
            [1, 1],   // Diagonal down-right
            [1, -1],  // Diagonal down-left
            [0, -1],  // Left
            [-1, 0],  // Up
            [-1, -1], // Diagonal up-left
            [-1, 1]   // Diagonal up-right
        ];

        const placedWords = [];

        // Try to place each word, longest first so large words get the easiest space.
        const wordsToPlace = [...this.words].sort((a, b) => b.puzzleWord.length - a.puzzleWord.length);
        for (const wordObj of wordsToPlace) {
            const word = wordObj.puzzleWord;
            let placed = false;
            let attempts = 0;
            const maxAttempts = 300;

            while (!placed && attempts < maxAttempts) {
                attempts++;
                const dir = directions[Math.floor(Math.random() * directions.length)];
                const row = Math.floor(Math.random() * this.gridSize);
                const col = Math.floor(Math.random() * this.gridSize);

                if (this.canPlaceWord(word, row, col, dir)) {
                    this.placeWord(word, row, col, dir);
                    placed = true;
                    placedWords.push(wordObj);
                }
            }
        }

        this.words = placedWords;

        // Fill ALL empty cells with random letters
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                if (!this.grid[r][c] || this.grid[r][c] === '' || this.grid[r][c] === null || this.grid[r][c] === undefined) {
                    this.grid[r][c] = letters[Math.floor(Math.random() * letters.length)];
                }
            }
        }

        // Save initial state
        this.saveState();
    },

canPlaceWord(word, row, col, dir) {
        const [dr, dc] = dir;

        // Check if word fits in grid
        const endRow = row + dr * (word.length - 1);
        const endCol = col + dc * (word.length - 1);

        if (endRow < 0 || endRow >= this.gridSize ||
            endCol < 0 || endCol >= this.gridSize) {
            return false;
        }

        // Check if cells are empty or match the letter
        for (let i = 0; i < word.length; i++) {
            const r = row + dr * i;
            const c = col + dc * i;
            if (this.grid[r][c] !== '' && this.grid[r][c] !== word[i]) {
                return false;
            }
        }

        return true;
    },

placeWord(word, row, col, dir) {
        const [dr, dc] = dir;
        const positions = [];

        for (let i = 0; i < word.length; i++) {
            const r = row + dr * i;
            const c = col + dc * i;
            this.grid[r][c] = word[i];
            positions.push({ row: r, col: c });
        }

        this.wordPositions.push({
            word: word,
            positions: positions
        });
    }
};

