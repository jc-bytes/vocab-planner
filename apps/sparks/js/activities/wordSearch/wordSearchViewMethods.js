import { createElement, refreshIcons } from '../../main.js';

export const wordSearchViewMethods = {
render() {
        this.detachPointerListeners();
        this.container.innerHTML = '';

        const wrapper = createElement('div', 'word-search-wrapper');

        // Left side: Word list
        const wordList = this.renderWordList();
        wordList.prepend(this.renderHeader());
        wrapper.appendChild(wordList);

        // Right side: Grid
        const gridContainer = this.renderGrid();
        wrapper.appendChild(gridContainer);

        this.container.appendChild(wrapper);
        refreshIcons(this.container);

        // Restore highlights for found words after rendering
        this.restoreHighlights();
    },

    renderHeader() {
        const header = createElement('div', 'word-search-header');

        const subtitle = createElement('p', 'word-search-instructions');
        subtitle.textContent = `Find ${this.words.length} hidden words. Words can go across, down, diagonal, or backward.`;
        header.appendChild(subtitle);

        const actions = createElement('div', 'word-search-actions');

        const newPuzzleButton = createElement('button', 'btn primary-btn');
        newPuzzleButton.type = 'button';
        newPuzzleButton.textContent = 'New Puzzle';
        newPuzzleButton.addEventListener('click', () => this.startNewPuzzle());
        actions.appendChild(newPuzzleButton);

        header.appendChild(actions);
        return header;
    },

restoreHighlights() {
        // Re-apply visual highlighting to found words
        for (const wordPos of this.wordPositions) {
            if (this.foundWords.has(wordPos.word)) {
                this.markWordAsFound(wordPos);
            }
        }
    },

renderWordList() {
        const listContainer = createElement('div', 'word-list-container');
        listContainer.style.background = 'rgba(15, 23, 42, 0.88)';
        listContainer.style.border = '1px solid rgba(148, 163, 184, 0.22)';
        listContainer.style.borderRadius = '0.75rem';
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

        const progressTrack = createElement('div', 'word-search-progress-track');
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
    },

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
        puzzleLabel.innerHTML = isFound
            ? `<i data-lucide="check" aria-hidden="true"></i><span>${word}</span>`
            : `<span>${word}</span>`;
        puzzleLabel.style.display = 'flex';
        puzzleLabel.style.alignItems = 'center';
        puzzleLabel.style.gap = '0.35rem';
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
    },

    renderGrid() {
        const gridContainer = createElement('div', 'word-search-grid-container');

        const grid = createElement('div', 'word-search-grid');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = `repeat(${this.gridSize}, 1fr)`;
        grid.style.gap = '1px';
        grid.style.background = '#e5e7eb';
        grid.style.padding = '1px';
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
    },

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
    },

updateWordList() {
        const wordListContainer = this.container.querySelector('.word-list-container');
        if (wordListContainer) {
            const newWordList = this.renderWordList();
            wordListContainer.parentNode.replaceChild(newWordList, wordListContainer);
            refreshIcons(newWordList);
        }
    },

showCompletionOverlay() {
        const overlay = document.createElement('div');
        this.completionOverlay = overlay;
        overlay.className = 'completion-overlay';
        overlay.innerHTML = `
            <div class="completion-screen">
                <h2 class="activity-result-heading">
                    <i data-lucide="badge-check" aria-hidden="true"></i>
                    <span>All Words Found!</span>
                </h2>
                <p>You found all ${this.words.length} words!</p>
                <div class="completion-actions">
                    <button id="new-wordsearch" class="btn primary-btn">New Puzzle</button>
                    <button id="close-wordsearch" class="btn secondary-btn">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        refreshIcons(overlay);

        overlay.querySelector('#new-wordsearch').addEventListener('click', () => {
            document.body.removeChild(overlay);
            this.startNewPuzzle();
        });

        overlay.querySelector('#close-wordsearch').addEventListener('click', () => {
            document.body.removeChild(overlay);
            this.completionOverlay = null;
        });
    }
};
