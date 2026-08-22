export const crosswordInteractionMethods = {
handleInput(e, r, c) {
        const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
        e.target.value = val;
        if (this.grid[r][c]) {
            this.grid[r][c].value = val;
        }
        this.activeFeedback = null;
        this.clearTransientValidation();
        if (val) {
            // Auto-advance
            // We need to know current direction context. 
            // For simplicity, let's try to move to next cell in 'across' if possible, else 'down'
            // Or better, track last focused direction.
            // Let's just try across first.
            this.focusNext(r, c);
        }
        this.saveState();
        this.updateActiveClue();
        this.updateProgressUI();
    },

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
    },

handleFocus(r, c) {
        const words = this.getWordsAtCell(r, c);
        if (words.length === 0) return;

        const current = this.getActiveWord();
        const nextWord = current && words.some(w => w.number === current.number)
            ? current
            : words[0];
        this.setActiveWord(nextWord, false);
    },

focusNext(r, c) {
        const word = this.getActiveWord();
        if (word) {
            const cells = this.getWordCells(word);
            const index = cells.findIndex(cell => cell.row === r && cell.col === c);
            const nextCell = cells.slice(index + 1)
                .find(cell => !this.getCell(cell.row, cell.col)?.readOnly);
            if (nextCell) {
                this.getCell(nextCell.row, nextCell.col)?.focus();
                return;
            }
        }
        this.focusRelative(r, c, 0, 1) || this.focusRelative(r, c, 1, 0);
    },

focusPrev(r, c) {
        const word = this.getActiveWord();
        if (word) {
            const cells = this.getWordCells(word);
            const index = cells.findIndex(cell => cell.row === r && cell.col === c);
            const prevCell = cells.slice(0, index).reverse()
                .find(cell => !this.getCell(cell.row, cell.col)?.readOnly);
            if (prevCell) {
                this.getCell(prevCell.row, prevCell.col)?.focus();
                return;
            }
        }
        this.focusRelative(r, c, 0, -1) || this.focusRelative(r, c, -1, 0);
    },

focusRelative(r, c, dr, dc) {
        const next = this.getCell(r + dr, c + dc);
        if (next) {
            next.focus();
            return true;
        }
        return false;
    },

setActiveWord(wordObj, focusStart = false) {
        if (!wordObj) return;
        this.activeWordNumber = wordObj.number;
        this.activeFeedback = null;
        this.clearTransientValidation();
        this.updateHighlights();
        if (focusStart) {
            const target = this.getWordCells(wordObj)
                .map(({ row, col }) => this.getCell(row, col))
                .find(input => input && !input.readOnly);
            (target || this.getCell(wordObj.row, wordObj.col))?.focus();
        }
    },

toggleActiveWordAtCell(r, c) {
        const words = this.getWordsAtCell(r, c);
        if (words.length < 2) return;
        const currentIndex = words.findIndex(word => word.number === this.activeWordNumber);
        const nextWord = words[(currentIndex + 1) % words.length];
        this.setActiveWord(nextWord, false);
    },

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
        this.updateRevealButton();
        this.updateCheckButton();
    },

updateActiveClue() {
        const panel = this.container.querySelector('#cw-active-clue');
        const activeWord = this.getActiveWord();
        if (!panel || !activeWord) return;

        panel.innerHTML = `
            <div class="cw-active-label">${activeWord.number} ${activeWord.direction}</div>
            <div class="cw-active-text">${activeWord.definition}</div>
            <div class="cw-active-meta">${activeWord.word.length} letters</div>
            ${this.activeFeedback ? `<div class="cw-word-feedback ${this.activeFeedback.type}" role="status">${this.activeFeedback.message}</div>` : ''}
        `;
    },

clearTransientValidation() {
        this.container.querySelectorAll('.cw-cell').forEach(input => {
            input.classList.remove('word-incorrect');
        });
    },

checkAnswers() {
        const activeWord = this.getActiveWord();
        if (!activeWord || this.solvedWordNumbers.has(activeWord.number)) return;

        const cells = this.getWordCells(activeWord);
        const inputs = cells.map(({ row, col }) => this.getCell(row, col)).filter(Boolean);
        this.clearTransientValidation();

        const firstEmpty = inputs.find(input => !input.value);
        if (firstEmpty) {
            this.activeFeedback = { type: 'incomplete', message: 'Finish the whole word before checking.' };
            this.updateActiveClue();
            firstEmpty.focus();
            return;
        }

        if (!this.isWordCorrect(activeWord)) {
            inputs.forEach(input => {
                if (!input.classList.contains('solved')) input.classList.add('word-incorrect');
            });
            this.activeFeedback = { type: 'incorrect', message: 'Not quite. Review the clue and try the whole word again.' };
            this.updateActiveClue();
            return;
        }

        this.solvedWordNumbers.add(activeWord.number);
        this.activeFeedback = { type: 'correct', message: 'Word solved!' };
        this.syncSolvedState();
        this.saveState();
        this.checkProgress();
        this.updateProgressUI();
        this.updateActiveClue();
        this.updateCheckButton();
    },

revealLetter() {
        const activeWord = this.getActiveWord();
        if (!activeWord || this.revealedWordNumbers.has(activeWord.number)) return;

        const cells = this.getWordCells(activeWord);
        const focused = document.activeElement?.classList?.contains('cw-cell')
            && !document.activeElement.readOnly
            && cells.some(({ row, col }) => (
                Number(document.activeElement.dataset.row) === row
                && Number(document.activeElement.dataset.col) === col
            ))
            ? document.activeElement
            : null;
        let target = focused;

        if (!target && cells.length > 0) {
            const editableCells = cells.filter(({ row, col }) => !this.getCell(row, col)?.readOnly);
            const emptyCell = editableCells.find(({ row, col }) => !this.grid[row][col]?.value);
            const fallbackCell = editableCells[0];
            target = emptyCell
                ? this.getCell(emptyCell.row, emptyCell.col)
                : fallbackCell ? this.getCell(fallbackCell.row, fallbackCell.col) : null;
        }

        if (!target) return;

        const row = Number(target.dataset.row);
        const col = Number(target.dataset.col);
        target.value = target.dataset.answer;
        if (this.grid[row][col]) this.grid[row][col].value = target.dataset.answer;
        this.revealedWordNumbers.add(activeWord.number);
        target.classList.add('hinted');
        this.saveState();
        this.checkProgress();
        this.updateProgressUI();
        this.updateActiveClue();
        this.updateCheckButton();
        this.focusNext(row, col);
        this.updateRevealButton();
    },

highlightWord(wordObj) {
        this.setActiveWord(wordObj, true);
    },
};

