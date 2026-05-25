import { createElement, $ } from '../main.js';

export class WordSearchActivity {
    constructor(container, words, onProgress, vocabID, onSaveState = null, initialState = null, options = {}) {
        this.container = container;
        this.gridSize = 15;
        // Words are pre-filtered by student.js based on settings. Keep only terms that can
        // become playable word-search entries in this grid.
        this.words = this.prepareWords(words);
        this.onProgress = onProgress;
        this.onSaveState = onSaveState;
        this.initialState = initialState;
        this.options = options;
        this.vocabID = vocabID || 'default'; // Use ID for stable persistence
        this.grid = [];
        this.wordPositions = [];
        this.foundWords = new Set();
        this.isSelecting = false;
        this.selectedCells = [];
        this.activePointerId = null;
        this.handleDocumentPointerEnd = (event) => this.handlePointerEnd(event);

        // Try to restore state first
        this.restoreState();

        // If no state was restored, generate new grid
        if (this.grid.length === 0) {
            this.generateGrid();
        } else {
            this.saveState();
        }

        this.render();
    }

    prepareWords(words) {
        return words
            .map(wordObj => ({
                ...wordObj,
                puzzleWord: this.normalizeWord(wordObj.word)
            }))
            .filter(wordObj => wordObj.puzzleWord.length >= 2 && wordObj.puzzleWord.length <= this.gridSize);
    }

    normalizeWord(word) {
        return String(word || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    getOriginalLabel(wordObj) {
        return String(wordObj.word || '')
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/\b[A-Za-z]/g, char => char.toUpperCase());
    }

    restoreState() {
        if (this.applySavedState(this.initialState)) return;

        // Use vocabID in key for stability
        const key = `word_search_state_${this.vocabID}`;
        const saved = localStorage.getItem(key);

        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.applySavedState(state);
            } catch (e) {
                console.error('Error restoring word search state:', e);
            }
        }
    }

    applySavedState(state) {
        if (!state || typeof state !== 'object') return false;
        if (state.wordsLength !== this.words.length) return false;
        if (!this.hasMatchingWordKeys(state.wordKeys)) return false;
        if (!Array.isArray(state.grid) || !Array.isArray(state.wordPositions)) return false;

        this.grid = state.grid;
        this.wordPositions = state.wordPositions;
        this.foundWords = new Set(Array.isArray(state.foundWords) ? state.foundWords : []);
        return true;
    }

    hasMatchingWordKeys(wordKeys) {
        if (!Array.isArray(wordKeys) || wordKeys.length === 0) return true;
        if (wordKeys.length !== this.words.length) return false;
        return wordKeys.every((wordKey, index) => wordKey === this.words[index]?.word);
    }

    saveState() {
        const key = `word_search_state_${this.vocabID}`;
        const state = {
            grid: this.grid,
            wordPositions: this.wordPositions,
            foundWords: Array.from(this.foundWords),
            wordKeys: this.words.map(word => word.word),
            wordsLength: this.words.length
        };
        localStorage.setItem(key, JSON.stringify(state));
        if (typeof this.onSaveState === 'function') {
            this.onSaveState(state);
        }
    }

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
    }

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
    }

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

    render() {
        this.destroy();
        this.container.innerHTML = '';

        const header = this.renderHeader();
        this.container.appendChild(header);

        const wrapper = createElement('div', 'word-search-wrapper');
        wrapper.style.maxWidth = '1040px';
        wrapper.style.margin = '0 auto';
        wrapper.style.display = 'flex';
        wrapper.style.gap = '1.5rem';

        // Left side: Word list
        const wordList = this.renderWordList();
        wrapper.appendChild(wordList);

        // Right side: Grid
        const gridContainer = this.renderGrid();
        wrapper.appendChild(gridContainer);

        this.container.appendChild(wrapper);

        // Restore highlights for found words after rendering
        this.restoreHighlights();
    }

    renderHeader() {
        const header = createElement('div', 'word-search-header');
        header.style.maxWidth = '1040px';
        header.style.margin = '0 auto 1rem';
        header.style.display = 'flex';
        header.style.alignItems = 'flex-end';
        header.style.justifyContent = 'space-between';
        header.style.gap = '1rem';
        header.style.flexWrap = 'wrap';

        const copy = createElement('div');
        const title = createElement('h2');
        title.textContent = 'Word Search';
        title.style.margin = '0 0 0.35rem';
        title.style.color = '#f8fafc';
        title.style.fontSize = '1.75rem';
        title.style.lineHeight = '1.1';
        copy.appendChild(title);

        const subtitle = createElement('p');
        subtitle.textContent = `Find ${this.words.length} hidden words. Words can go across, down, diagonal, or backward.`;
        subtitle.style.margin = '0';
        subtitle.style.color = '#cbd5e1';
        subtitle.style.fontSize = '0.95rem';
        copy.appendChild(subtitle);
        header.appendChild(copy);

        const actions = createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '0.5rem';
        actions.style.flexWrap = 'wrap';

        const newPuzzleButton = createElement('button', 'btn primary-btn');
        newPuzzleButton.type = 'button';
        newPuzzleButton.textContent = 'New Puzzle';
        newPuzzleButton.addEventListener('click', () => this.startNewPuzzle());
        actions.appendChild(newPuzzleButton);

        const shuffleButton = createElement('button', 'btn secondary-btn');
        shuffleButton.type = 'button';
        shuffleButton.textContent = 'Shuffle Same Words';
        shuffleButton.addEventListener('click', () => this.restart());
        actions.appendChild(shuffleButton);

        header.appendChild(actions);
        return header;
    }

    restoreHighlights() {
        // Re-apply visual highlighting to found words
        for (const wordPos of this.wordPositions) {
            if (this.foundWords.has(wordPos.word)) {
                this.markWordAsFound(wordPos);
            }
        }
    }

    renderWordList() {
        const listContainer = createElement('div', 'word-list-container');
        listContainer.style.flex = '0 0 260px';
        listContainer.style.padding = '1rem';
        listContainer.style.background = 'rgba(15, 23, 42, 0.88)';
        listContainer.style.border = '1px solid rgba(148, 163, 184, 0.22)';
        listContainer.style.borderRadius = '0.75rem';
        listContainer.style.height = 'fit-content';
        listContainer.style.boxShadow = '0 18px 45px rgba(0, 0, 0, 0.24)';

        const heading = createElement('h3');
        heading.textContent = 'This Round';
        heading.style.margin = '0 0 0.75rem';
        heading.style.fontSize = '1.125rem';
        heading.style.fontWeight = '600';
        heading.style.color = '#f8fafc';
        listContainer.appendChild(heading);

        const roundMeta = createElement('p');
        roundMeta.textContent = `Round: ${this.words.length} words`;
        roundMeta.style.marginBottom = '0.4rem';
        roundMeta.style.color = '#cbd5e1';
        roundMeta.style.fontSize = '0.875rem';
        listContainer.appendChild(roundMeta);

        const progress = createElement('p');
        progress.id = 'word-search-progress';
        const leftCount = Math.max(0, this.words.length - this.foundWords.size);
        progress.textContent = `${this.foundWords.size} found · ${leftCount} left`;
        progress.style.marginBottom = '0.5rem';
        progress.style.color = '#cbd5e1';
        progress.style.fontSize = '0.875rem';
        listContainer.appendChild(progress);

        const progressTrack = createElement('div');
        progressTrack.style.width = '100%';
        progressTrack.style.height = '0.45rem';
        progressTrack.style.background = 'rgba(148, 163, 184, 0.22)';
        progressTrack.style.borderRadius = '999px';
        progressTrack.style.overflow = 'hidden';
        progressTrack.style.marginBottom = '1rem';

        const progressFill = createElement('div');
        const percentage = this.words.length ? Math.round((this.foundWords.size / this.words.length) * 100) : 0;
        progressFill.style.width = `${percentage}%`;
        progressFill.style.height = '100%';
        progressFill.style.background = 'linear-gradient(90deg, #22c55e, #14b8a6)';
        progressFill.style.transition = 'width 0.25s ease';
        progressTrack.appendChild(progressFill);
        listContainer.appendChild(progressTrack);

        const remainingWords = this.words.filter(wordObj => !this.foundWords.has(wordObj.puzzleWord));
        const foundWords = this.words.filter(wordObj => this.foundWords.has(wordObj.puzzleWord));

        const buildList = (title, items, isFound = false) => {
            if (items.length === 0) return null;
            const section = createElement('div');
            section.style.marginTop = '0.75rem';

            const sectionTitle = createElement('div');
            sectionTitle.textContent = title;
            sectionTitle.style.fontSize = '0.75rem';
            sectionTitle.style.fontWeight = '700';
            sectionTitle.style.color = '#94a3b8';
            sectionTitle.style.marginBottom = '0.35rem';
            section.appendChild(sectionTitle);

            const list = createElement('ul');
            list.style.listStyle = 'none';
            list.style.padding = '0';
            list.style.margin = '0';

            items.forEach(wordObj => {
                list.appendChild(this.renderWordListItem(wordObj, isFound));
            });

            section.appendChild(list);
            return section;
        };

        const remainingSection = buildList('Still Looking', remainingWords);
        const foundSection = buildList('Found', foundWords, true);
        if (remainingSection) listContainer.appendChild(remainingSection);
        if (foundSection) listContainer.appendChild(foundSection);

        if (this.words.length === 0) {
            const empty = createElement('p');
            empty.textContent = 'No playable words in this round.';
            empty.style.color = '#cbd5e1';
            empty.style.fontSize = '0.875rem';
            listContainer.appendChild(empty);
        }

        return listContainer;
    }

    renderWordListItem(wordObj, isFound = false) {
        const word = wordObj.puzzleWord;
        const item = createElement('li');
        item.style.padding = '0.55rem 0.65rem';
        item.style.marginBottom = '0.35rem';
        item.style.borderRadius = '0.5rem';
        item.style.fontSize = '0.875rem';
        item.style.fontWeight = '500';
        item.style.background = isFound ? 'rgba(34, 197, 94, 0.12)' : 'rgba(30, 41, 59, 0.82)';
        item.style.border = isFound ? '1px solid rgba(34, 197, 94, 0.28)' : '1px solid rgba(148, 163, 184, 0.14)';
        item.dataset.word = word;

        const originalLabel = this.getOriginalLabel(wordObj);
        const showOriginal = originalLabel && this.normalizeWord(originalLabel) !== word;
        if (originalLabel) {
            item.title = `Vocabulary word: ${originalLabel}`;
        }

        const puzzleLabel = createElement('div');
        puzzleLabel.textContent = isFound ? `✓ ${word}` : word;
        puzzleLabel.style.color = isFound ? '#86efac' : '#f8fafc';
        puzzleLabel.style.fontWeight = '700';
        if (isFound) {
            puzzleLabel.style.textDecoration = 'line-through';
        }
        item.appendChild(puzzleLabel);

        if (showOriginal) {
            const original = createElement('div');
            original.textContent = originalLabel;
            original.style.fontSize = '0.74rem';
            original.style.fontWeight = '500';
            original.style.color = isFound ? '#bbf7d0' : '#94a3b8';
            original.style.marginTop = '0.15rem';
            original.style.textDecoration = 'none';
            item.appendChild(original);
        }

        return item;
    }

    renderGrid() {
        const gridContainer = createElement('div', 'word-search-grid-container');
        gridContainer.style.flex = '1';

        const grid = createElement('div', 'word-search-grid');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = `repeat(${this.gridSize}, 1fr)`;
        grid.style.gap = '2px';
        grid.style.background = '#e5e7eb';
        grid.style.padding = '2px';
        grid.style.borderRadius = '0.5rem';
        grid.style.userSelect = 'none';
        grid.style.touchAction = 'none';
        grid.addEventListener('pointermove', (e) => this.handlePointerMove(e));

        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const cell = createElement('div', 'word-search-cell');
                // Safeguard: ensure cell always has content
                const cellContent = this.grid[r][c] || 'X';
                cell.textContent = cellContent;
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.style.background = '#0f172a';
                cell.style.color = '#f8fafc';
                cell.style.display = 'flex';
                cell.style.alignItems = 'center';
                cell.style.justifyContent = 'center';
                cell.style.aspectRatio = '1';
                cell.style.fontWeight = '600';
                cell.style.fontSize = '0.875rem';
                cell.style.cursor = 'pointer';
                cell.style.transition = 'background 0.15s, color 0.15s, transform 0.15s';

                cell.addEventListener('pointerdown', (e) => this.handlePointerDown(e, r, c));
                cell.addEventListener('pointerenter', (e) => this.handlePointerEnter(e, r, c));

                grid.appendChild(cell);
            }
        }

        // Global pointer end in case the pointer leaves the grid.
        document.addEventListener('pointerup', this.handleDocumentPointerEnd);
        document.addEventListener('pointercancel', this.handleDocumentPointerEnd);

        gridContainer.appendChild(grid);
        return gridContainer;
    }

    handlePointerDown(e, row, col) {
        if (e.button !== undefined && e.button !== 0) return;
        this.activePointerId = e.pointerId;
        this.handleMouseDown(e, row, col);
    }

    handlePointerEnter(e, row, col) {
        if (!this.isSelecting || e.pointerId !== this.activePointerId) return;
        this.handleMouseEnter(row, col);
    }

    handlePointerMove(e) {
        if (!this.isSelecting || e.pointerId !== this.activePointerId) return;

        const target = document.elementFromPoint(e.clientX, e.clientY);
        const cell = target && target.closest ? target.closest('.word-search-cell') : null;
        if (!cell || !this.container.contains(cell)) return;

        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        if (Number.isInteger(row) && Number.isInteger(col)) {
            e.preventDefault();
            this.handleMouseEnter(row, col);
        }
    }

    handlePointerEnd(e) {
        if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
        this.activePointerId = null;
        this.handleMouseUp();
    }

    handleMouseDown(e, row, col) {
        e.preventDefault();
        this.isSelecting = true;
        this.selectedCells = [{ row, col }];
        this.updateCellSelection();
    }

    handleMouseEnter(row, col) {
        if (!this.isSelecting) return;

        const nextSelection = this.getStraightSelection(this.selectedCells[0], row, col);
        if (nextSelection) {
            this.selectedCells = nextSelection;
            this.updateCellSelection();
        }
    }

    getStraightSelection(start, endRow, endCol) {
        const rowDiff = endRow - start.row;
        const colDiff = endCol - start.col;
        const rowStep = Math.sign(rowDiff);
        const colStep = Math.sign(colDiff);
        const rowDistance = Math.abs(rowDiff);
        const colDistance = Math.abs(colDiff);

        const isStraight =
            rowDiff === 0 ||
            colDiff === 0 ||
            rowDistance === colDistance;

        if (!isStraight) return null;

        const length = Math.max(rowDistance, colDistance) + 1;
        const cells = [];
        for (let i = 0; i < length; i++) {
            cells.push({
                row: start.row + rowStep * i,
                col: start.col + colStep * i
            });
        }
        return cells;
    }

    updateCellSelection() {
        // Clear previous selection highlighting
        const allCells = this.container.querySelectorAll('.word-search-cell');
        allCells.forEach(cell => {
            if (!cell.classList.contains('found')) {
                cell.style.background = '#0f172a';
                cell.style.color = '#f8fafc';
                cell.style.transform = 'scale(1)';
            }
        });

        // Highlight currently selected cells
        this.selectedCells.forEach(({ row, col }) => {
            const cell = this.container.querySelector(`.word-search-cell[data-row="${row}"][data-col="${col}"]`);
            if (cell && !cell.classList.contains('found')) {
                cell.style.background = '#facc15';
                cell.style.color = '#0f172a';
                cell.style.transform = 'scale(1.04)';
            }
        });
    }

    handleMouseUp() {
        if (!this.isSelecting) return;

        this.isSelecting = false;

        // Get selected word
        const selectedWord = this.selectedCells
            .map(({ row, col }) => this.grid[row][col])
            .join('');

        // Check if it matches any word (forward or backward)
        const reverseWord = selectedWord.split('').reverse().join('');

        let matchedWord = null;
        for (const wordPos of this.wordPositions) {
            if (wordPos.word === selectedWord || wordPos.word === reverseWord) {
                matchedWord = wordPos;
                break;
            }
        }

        if (matchedWord && !this.foundWords.has(matchedWord.word)) {
            this.foundWords.add(matchedWord.word);
            this.markWordAsFound(matchedWord);
            this.updateWordList();

            // Save state after finding word
            this.saveState();

            if (this.onProgress) {
                this.onProgress(this.getScore());
            }
        } else {
            // Clear selection if not a valid word
            this.updateCellSelection();
        }

        this.selectedCells = [];
    }

    markWordAsFound(wordPos) {
        wordPos.positions.forEach(({ row, col }) => {
            const cell = this.container.querySelector(`.word-search-cell[data-row="${row}"][data-col="${col}"]`);
            if (cell) {
                cell.classList.add('found');
                cell.style.background = '#99f6e4';
                cell.style.color = '#0f172a';
                cell.style.transform = 'scale(1)';
            }
        });
    }

    updateWordList() {
        const wordListContainer = this.container.querySelector('.word-list-container');
        if (wordListContainer) {
            const newWordList = this.renderWordList();
            wordListContainer.parentNode.replaceChild(newWordList, wordListContainer);
        }
    }

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
        
        // Show replay button when complete
        if (isComplete && !this.container.querySelector('#replay-wordsearch')) {
            setTimeout(() => this.showCompletionOverlay(), 500);
        }
        
        return {
            score: percentage,
            details: `Found ${this.foundWords.size} of ${this.words.length} words`,
            isComplete
        };
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
                <h2>🎉 All Words Found!</h2>
                <p>You found all ${this.words.length} words!</p>
                <button id="new-wordsearch" class="btn primary-btn" style="margin-top: 1rem;">New Puzzle</button>
                <button id="replay-wordsearch" class="btn secondary-btn" style="margin-top: 1rem; margin-left: 0.5rem;">Shuffle Same Words</button>
                <button id="close-wordsearch" class="btn secondary-btn" style="margin-top: 0.5rem; margin-left: 0.5rem;">Close</button>
            </div>
        `;
        
        document.body.appendChild(overlay);

        overlay.querySelector('#new-wordsearch').addEventListener('click', () => {
            document.body.removeChild(overlay);
            this.startNewPuzzle();
        });
        
        overlay.querySelector('#replay-wordsearch').addEventListener('click', () => {
            document.body.removeChild(overlay);
            this.restart();
        });
        
        overlay.querySelector('#close-wordsearch').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
    }

    startNewPuzzle() {
        if (typeof this.options.onNewPuzzle === 'function') {
            this.options.onNewPuzzle();
        } else {
            this.restart();
        }
    }
    
    restart() {
        // Clear saved state
        const key = `word_search_state_${this.vocabID}`;
        localStorage.removeItem(key);
        
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
    }

    destroy() {
        document.removeEventListener('pointerup', this.handleDocumentPointerEnd);
        document.removeEventListener('pointercancel', this.handleDocumentPointerEnd);
    }
}
