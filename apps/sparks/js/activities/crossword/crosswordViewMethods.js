import { createElement } from '../../main.js';

export const crosswordViewMethods = {
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
        window.lucide?.createIcons({ root: this.container });
        this.syncSolvedState();
        this.updateHighlights();
        this.updateProgressUI();
    },

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
    },

renderCluesPanel() {
        const cluesPanel = createElement('div', 'cw-clues');
        const activePanel = createElement('div', 'cw-active-clue');
        activePanel.id = 'cw-active-clue';
        cluesPanel.appendChild(activePanel);

        const controls = createElement('div', 'cw-controls');
        const checkButton = createElement('button', 'btn primary-btn');
        checkButton.type = 'button';
        checkButton.id = 'cw-check-word';
        checkButton.textContent = 'Check Word';
        checkButton.addEventListener('click', () => this.checkAnswers());
        controls.appendChild(checkButton);

        const revealButton = createElement('button', 'btn secondary-btn');
        revealButton.type = 'button';
        revealButton.id = 'cw-reveal-letter';
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
            const number = document.createElement('strong');
            number.textContent = `${w.number}.`;
            const solvedIcon = document.createElement('span');
            solvedIcon.className = 'cw-clue-solved-icon';
            solvedIcon.setAttribute('aria-hidden', 'true');
            solvedIcon.innerHTML = '<i data-lucide="check"></i>';
            const length = document.createElement('span');
            length.className = 'cw-clue-length';
            length.textContent = `(${w.word.length})`;
            item.append(number, solvedIcon, ` ${w.definition || ''} `, length);
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
    },

updateRevealButton() {
        const button = this.container.querySelector('#cw-reveal-letter');
        const activeWord = this.getActiveWord();
        if (!button) return;

        const hintUsed = activeWord && this.revealedWordNumbers.has(activeWord.number);
        button.disabled = !activeWord || hintUsed;
        button.textContent = hintUsed ? 'Hint Used' : 'Reveal Letter';
    },

updateCheckButton() {
        const button = this.container.querySelector('#cw-check-word');
        const activeWord = this.getActiveWord();
        if (!button) return;

        const solved = activeWord && this.solvedWordNumbers.has(activeWord.number);
        button.disabled = !activeWord || solved;
        button.textContent = solved ? 'Solved' : 'Check Word';
    },

updateProgressUI() {
        const solved = this.getSolvedCount();
        const left = Math.max(0, this.placedWords.length - solved);
        const percentage = this.placedWords.length ? Math.round((solved / this.placedWords.length) * 100) : 0;
        const text = this.container.querySelector('#cw-progress-text');
        const fill = this.container.querySelector('#cw-progress-fill');
        if (text) text.textContent = `${solved} solved · ${left} left`;
        if (fill) fill.style.width = `${percentage}%`;
    },

showCompletionOverlay() {
        const overlay = document.createElement('div');
        this.completionOverlay = overlay;
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
                <h2 class="activity-result-heading">
                    <i data-lucide="badge-check" aria-hidden="true"></i>
                    <span>Crossword Complete!</span>
                </h2>
                <p>You solved all ${this.placedWords.length} words!</p>
                <button id="replay-crossword" class="btn primary-btn" style="margin-top: 1rem;">
                    <i data-lucide="rotate-ccw" aria-hidden="true"></i>
                    <span>Play Again</span>
                </button>
                <button id="close-crossword" class="btn secondary-btn" style="margin-top: 0.5rem; margin-left: 0.5rem;">Close</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        window.lucide?.createIcons({ root: overlay });
        
        overlay.querySelector('#replay-crossword').addEventListener('click', () => {
            document.body.removeChild(overlay);
            this.restart();
        });
        
        overlay.querySelector('#close-crossword').addEventListener('click', () => {
            document.body.removeChild(overlay);
            this.completionOverlay = null;
        });
    },
};

