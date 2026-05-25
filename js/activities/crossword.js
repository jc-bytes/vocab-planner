import { createElement, $ } from '../main.js';

export class CrosswordActivity {
    constructor(container, words, onProgress, onSaveState, initialState) {
        this.container = container;
        this.words = words.filter(w => w.word.length > 1 && /^[a-zA-Z]+$/.test(w.word)); // Only alpha words
        this.onProgress = onProgress;
        this.onSaveState = onSaveState;
        this.initialState = initialState;
        this.gridSize = 15;
        this.grid = [];
        this.placedWords = [];
        this.score = 0;
        this.activeWordNumber = null;

        this.init();
    }

    init() {
        if (!this.restoreState()) {
            this.generateGrid();
        }
        this.render();
    }

    restoreState() {
        // Try initial state passed from StudentManager (Cloud/Local consolidated)
        if (this.initialState) {
            this.grid = this.initialState.grid;
            this.placedWords = this.initialState.placedWords;
            return true;
        }

        // Fallback to local storage if not found in manager (legacy or direct usage)
        const key = `crossword_state_${this.words.length}`; // Simple key
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.grid = state.grid;
                this.placedWords = state.placedWords;
                return true;
            } catch (e) {
                console.error('Failed to restore crossword state', e);
            }
        }
        return false;
    }

    saveState() {
        const state = {
            grid: this.grid,
            placedWords: this.placedWords
        };

        // Save via callback (to StudentManager -> backend)
        if (this.onSaveState) {
            this.onSaveState(state);
        }

        // Also save locally as backup/legacy
        const key = `crossword_state_${this.words.length}`;
        localStorage.setItem(key, JSON.stringify(state));
    }

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
    }

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
    }

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
    }

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
    }

    getScore() {
        // Calculate percentage of correct letters filled
        const inputs = this.container.querySelectorAll('input.cw-cell');
        let correct = 0;
        let total = 0;
        inputs.forEach(input => {
            total++;
            if (input.value.toUpperCase() === input.dataset.answer) {
                correct++;
            }
        });

        const score = total === 0 ? 0 : Math.round((correct / total) * 100);
        return {
            score,
            details: `${correct}/${total} letters correct`,
            isComplete: score === 100
        };
    }

    render() {
        this.container.innerHTML = '';
        this.activeWordNumber = this.activeWordNumber || this.placedWords[0]?.number || null;

        const wrapper = createElement('div', 'crossword-wrapper');
        wrapper.appendChild(this.renderHeader());

        const gameArea = createElement('div', 'crossword-game-area');
        const boardPanel = createElement('div', 'cw-board-panel');
        const cluesPanel = this.renderCluesPanel();

        // Grid
        const gridEl = createElement('div', 'cw-grid');
        gridEl.style.gridTemplateColumns = `repeat(${this.gridSize}, 1fr)`;

        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const cellData = this.grid[r][c];
                const cell = createElement('div', 'cw-grid-cell');
                cell.dataset.row = r;
                cell.dataset.col = c;

                if (cellData) {
                    const input = createElement('input', 'cw-cell');
                    input.maxLength = 1;
                    input.dataset.row = r;
                    input.dataset.col = c;
                    input.dataset.answer = cellData.char;
                    input.value = cellData.value || ''; // Restore value

                    input.addEventListener('input', (e) => this.handleInput(e, r, c));
                    input.addEventListener('keydown', (e) => this.handleKey(e, r, c));
                    input.addEventListener('focus', () => this.handleFocus(r, c));
                    input.addEventListener('click', () => this.handleFocus(r, c));

                    cell.appendChild(input);

                    // Check if any word starts here to add number
                    const startWord = this.placedWords.find(w => w.row === r && w.col === c);
                    if (startWord) {
                        const num = createElement('span', 'cw-number', startWord.number);
                        cell.appendChild(num);
                    }
                } else {
                    cell.classList.add('empty');
                }
                gridEl.appendChild(cell);
            }
        }

        boardPanel.appendChild(gridEl);
        gameArea.appendChild(boardPanel);
        gameArea.appendChild(cluesPanel);
        wrapper.appendChild(gameArea);
        this.container.appendChild(wrapper);
        this.updateHighlights();
        this.updateProgressUI();
    }

    renderHeader() {
        const header = createElement('div', 'crossword-header');
        const copy = createElement('div');

        const title = createElement('h2');
        title.textContent = 'Crossword';
        copy.appendChild(title);

        const subtitle = createElement('p');
        subtitle.textContent = `Use the clues to fill in ${this.placedWords.length} vocabulary words.`;
        copy.appendChild(subtitle);

        const progressWrap = createElement('div', 'cw-progress-wrap');
        const progressText = createElement('div', 'cw-progress-text');
        progressText.id = 'cw-progress-text';
        progressWrap.appendChild(progressText);

        const progressTrack = createElement('div', 'cw-progress-track');
        const progressFill = createElement('div', 'cw-progress-fill');
        progressFill.id = 'cw-progress-fill';
        progressTrack.appendChild(progressFill);
        progressWrap.appendChild(progressTrack);

        header.appendChild(copy);
        header.appendChild(progressWrap);
        return header;
    }

    renderCluesPanel() {
        const cluesPanel = createElement('div', 'cw-clues');
        const activePanel = createElement('div', 'cw-active-clue');
        activePanel.id = 'cw-active-clue';
        cluesPanel.appendChild(activePanel);

        const controls = createElement('div', 'cw-controls');
        const checkButton = createElement('button', 'btn primary-btn');
        checkButton.type = 'button';
        checkButton.textContent = 'Check';
        checkButton.addEventListener('click', () => this.checkAnswers());
        controls.appendChild(checkButton);

        const revealButton = createElement('button', 'btn secondary-btn');
        revealButton.type = 'button';
        revealButton.textContent = 'Reveal Letter';
        revealButton.addEventListener('click', () => this.revealLetter());
        controls.appendChild(revealButton);

        const clearButton = createElement('button', 'btn secondary-btn');
        clearButton.type = 'button';
        clearButton.textContent = 'Clear';
        clearButton.addEventListener('click', () => this.clearPuzzle());
        controls.appendChild(clearButton);

        cluesPanel.appendChild(controls);

        const acrossList = createElement('div', 'cw-clues-list');
        acrossList.innerHTML = '<h4>Across</h4>';
        const downList = createElement('div', 'cw-clues-list');
        downList.innerHTML = '<h4>Down</h4>';

        this.placedWords.forEach(w => {
            const item = createElement('div', 'cw-clue-item');
            item.dataset.wordNumber = w.number;
            item.innerHTML = `<strong>${w.number}.</strong> ${w.definition} <span class="cw-clue-length">(${w.word.length})</span>`;
            item.addEventListener('click', () => this.setActiveWord(w, true));

            if (w.direction === 'across') {
                acrossList.appendChild(item);
            } else {
                downList.appendChild(item);
            }
        });

        cluesPanel.appendChild(acrossList);
        cluesPanel.appendChild(downList);
        return cluesPanel;
    }

    handleInput(e, r, c) {
        const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
        e.target.value = val;
        if (this.grid[r][c]) {
            this.grid[r][c].value = val;
        }
        if (val) {
            // Auto-advance
            // We need to know current direction context. 
            // For simplicity, let's try to move to next cell in 'across' if possible, else 'down'
            // Or better, track last focused direction.
            // Let's just try across first.
            this.focusNext(r, c);
            this.saveState(); // Save on input
            this.checkProgress();
        }
        this.clearCheckMarks();
        this.updateProgressUI();
    }

    handleKey(e, r, c) {
        if (e.key === 'Backspace' && !e.target.value) {
            this.focusPrev(r, c);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            this.focusRelative(r, c, 0, 1);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this.focusRelative(r, c, 0, -1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.focusRelative(r, c, 1, 0);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.focusRelative(r, c, -1, 0);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.toggleActiveWordAtCell(r, c);
        }
    }

    handleFocus(r, c) {
        const words = this.getWordsAtCell(r, c);
        if (words.length === 0) return;

        const current = this.getActiveWord();
        const nextWord = current && words.some(w => w.number === current.number)
            ? current
            : words[0];
        this.setActiveWord(nextWord, false);
    }

    focusNext(r, c) {
        const word = this.getActiveWord();
        if (word) {
            const cells = this.getWordCells(word);
            const index = cells.findIndex(cell => cell.row === r && cell.col === c);
            const nextCell = cells[index + 1];
            if (nextCell) {
                this.getCell(nextCell.row, nextCell.col)?.focus();
                return;
            }
        }
        this.focusRelative(r, c, 0, 1) || this.focusRelative(r, c, 1, 0);
    }

    focusPrev(r, c) {
        const word = this.getActiveWord();
        if (word) {
            const cells = this.getWordCells(word);
            const index = cells.findIndex(cell => cell.row === r && cell.col === c);
            const prevCell = cells[index - 1];
            if (prevCell) {
                this.getCell(prevCell.row, prevCell.col)?.focus();
                return;
            }
        }
        this.focusRelative(r, c, 0, -1) || this.focusRelative(r, c, -1, 0);
    }

    focusRelative(r, c, dr, dc) {
        const next = this.getCell(r + dr, c + dc);
        if (next) {
            next.focus();
            return true;
        }
        return false;
    }

    getCell(r, c) {
        return this.container.querySelector(`input[data-row="${r}"][data-col="${c}"]`);
    }

    getCellWrapper(r, c) {
        return this.container.querySelector(`.cw-grid-cell[data-row="${r}"][data-col="${c}"]`);
    }

    getActiveWord() {
        return this.placedWords.find(word => word.number === this.activeWordNumber) || null;
    }

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
    }

    getWordsAtCell(r, c) {
        return this.placedWords.filter(word => (
            this.getWordCells(word).some(cell => cell.row === r && cell.col === c)
        ));
    }

    setActiveWord(wordObj, focusStart = false) {
        if (!wordObj) return;
        this.activeWordNumber = wordObj.number;
        this.updateHighlights();
        if (focusStart) {
            this.getCell(wordObj.row, wordObj.col)?.focus();
        }
    }

    toggleActiveWordAtCell(r, c) {
        const words = this.getWordsAtCell(r, c);
        if (words.length < 2) return;
        const currentIndex = words.findIndex(word => word.number === this.activeWordNumber);
        const nextWord = words[(currentIndex + 1) % words.length];
        this.setActiveWord(nextWord, false);
    }

    updateHighlights() {
        const activeWord = this.getActiveWord();
        this.container.querySelectorAll('.cw-grid-cell').forEach(cell => {
            cell.classList.remove('active', 'start');
        });
        this.container.querySelectorAll('.cw-clue-item').forEach(item => {
            item.classList.toggle('active', Number(item.dataset.wordNumber) === this.activeWordNumber);
        });

        if (!activeWord) return;
        this.getWordCells(activeWord).forEach(({ row, col }) => {
            this.getCellWrapper(row, col)?.classList.add('active');
        });
        this.getCellWrapper(activeWord.row, activeWord.col)?.classList.add('start');
        this.updateActiveClue();
    }

    updateActiveClue() {
        const panel = this.container.querySelector('#cw-active-clue');
        const activeWord = this.getActiveWord();
        if (!panel || !activeWord) return;

        panel.innerHTML = `
            <div class="cw-active-label">${activeWord.number} ${activeWord.direction}</div>
            <div class="cw-active-text">${activeWord.definition}</div>
            <div class="cw-active-meta">${activeWord.word.length} letters</div>
        `;
    }

    getSolvedCount() {
        return this.placedWords.filter(word => (
            this.getWordCells(word).every(({ row, col }) => {
                const value = this.grid[row][col]?.value || '';
                return value.toUpperCase() === this.grid[row][col]?.char;
            })
        )).length;
    }

    updateProgressUI() {
        const solved = this.getSolvedCount();
        const left = Math.max(0, this.placedWords.length - solved);
        const percentage = this.placedWords.length ? Math.round((solved / this.placedWords.length) * 100) : 0;
        const text = this.container.querySelector('#cw-progress-text');
        const fill = this.container.querySelector('#cw-progress-fill');
        if (text) text.textContent = `${solved} solved · ${left} left`;
        if (fill) fill.style.width = `${percentage}%`;
    }

    clearCheckMarks() {
        this.container.querySelectorAll('.cw-cell').forEach(input => {
            input.classList.remove('correct', 'incorrect');
        });
    }

    checkAnswers() {
        this.container.querySelectorAll('.cw-cell').forEach(input => {
            input.classList.remove('correct', 'incorrect');
            if (!input.value) return;
            input.classList.add(input.value.toUpperCase() === input.dataset.answer ? 'correct' : 'incorrect');
        });
        this.checkProgress();
        this.updateProgressUI();
    }

    revealLetter() {
        const focused = document.activeElement?.classList?.contains('cw-cell') ? document.activeElement : null;
        const activeWord = this.getActiveWord();
        const cells = activeWord ? this.getWordCells(activeWord) : [];
        let target = focused;

        if (!target && cells.length > 0) {
            const emptyCell = cells.find(({ row, col }) => !this.grid[row][col]?.value);
            target = emptyCell ? this.getCell(emptyCell.row, emptyCell.col) : this.getCell(cells[0].row, cells[0].col);
        }

        if (!target) return;

        const row = Number(target.dataset.row);
        const col = Number(target.dataset.col);
        target.value = target.dataset.answer;
        if (this.grid[row][col]) this.grid[row][col].value = target.dataset.answer;
        target.classList.add('correct');
        this.saveState();
        this.checkProgress();
        this.updateProgressUI();
        this.focusNext(row, col);
    }

    clearPuzzle() {
        this.container.querySelectorAll('.cw-cell').forEach(input => {
            const row = Number(input.dataset.row);
            const col = Number(input.dataset.col);
            input.value = '';
            input.classList.remove('correct', 'incorrect');
            if (this.grid[row][col]) this.grid[row][col].value = '';
        });
        this.saveState();
        this.checkProgress();
        this.updateProgressUI();
    }

    checkProgress() {
        const score = this.getScore();
        if (this.onProgress) {
            this.onProgress(score);
        }
        
        // Show completion overlay when done
        if (score.isComplete && !this.container.querySelector('#replay-crossword')) {
            setTimeout(() => this.showCompletionOverlay(), 500);
        }
    }
    
    showCompletionOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'completion-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;
        overlay.innerHTML = `
            <div class="completion-screen" style="background: var(--card-bg, #1e293b); padding: 2rem; border-radius: 1rem; text-align: center;">
                <h2>🎉 Crossword Complete!</h2>
                <p>You solved all ${this.placedWords.length} words!</p>
                <button id="replay-crossword" class="btn primary-btn" style="margin-top: 1rem;">🔄 Play Again</button>
                <button id="close-crossword" class="btn secondary-btn" style="margin-top: 0.5rem; margin-left: 0.5rem;">Close</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        overlay.querySelector('#replay-crossword').addEventListener('click', () => {
            document.body.removeChild(overlay);
            this.restart();
        });
        
        overlay.querySelector('#close-crossword').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
    }
    
    restart() {
        // Clear saved state
        const key = `crossword_state_${this.words.length}`;
        localStorage.removeItem(key);
        
        // Reset game state
        this.grid = [];
        this.placedWords = [];
        this.score = 0;
        
        // Generate new grid
        this.generateGrid();
        
        // Notify progress system of new session
        if (this.onProgress) {
            this.onProgress({ score: 0, details: '0/0 letters correct', isComplete: false, isReplay: true });
        }
        
        this.render();
    }

    highlightWord(wordObj) {
        this.setActiveWord(wordObj, true);
    }
}
