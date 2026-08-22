import { createElement } from '../../main.js';

export const wordSearchViewMethods = {
render() {
        this.detachPointerListeners();
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
        window.lucide?.createIcons({ root: this.container });

        // Restore highlights for found words after rendering
        this.restoreHighlights();
    },

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
            window.lucide?.createIcons({ root: newWordList });
        }
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
                    <span>All Words Found!</span>
                </h2>
                <p>You found all ${this.words.length} words!</p>
                <button id="new-wordsearch" class="btn primary-btn" style="margin-top: 1rem;">New Puzzle</button>
                <button id="close-wordsearch" class="btn secondary-btn" style="margin-top: 0.5rem; margin-left: 0.5rem;">Close</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        window.lucide?.createIcons({ root: overlay });

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

