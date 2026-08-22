export const wordSearchPointerMethods = {
handlePointerDown(e, row, col) {
        if (e.button !== undefined && e.button !== 0) return;
        this.activePointerId = e.pointerId;
        this.handleMouseDown(e, row, col);
    },

handlePointerEnter(e, row, col) {
        if (!this.isSelecting || e.pointerId !== this.activePointerId) return;
        this.handleMouseEnter(row, col);
    },

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
    },

handlePointerEnd(e) {
        if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
        this.activePointerId = null;
        this.handleMouseUp();
    },

handleMouseDown(e, row, col) {
        e.preventDefault();
        this.isSelecting = true;
        this.selectedCells = [{ row, col }];
        this.updateCellSelection();
    },

handleMouseEnter(row, col) {
        if (!this.isSelecting) return;

        const nextSelection = this.getStraightSelection(this.selectedCells[0], row, col);
        if (nextSelection) {
            this.selectedCells = nextSelection;
            this.updateCellSelection();
        }
    },

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
    },

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
    },

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
    },

detachPointerListeners() {
        document.removeEventListener('pointerup', this.handleDocumentPointerEnd);
        document.removeEventListener('pointercancel', this.handleDocumentPointerEnd);
    }
};

