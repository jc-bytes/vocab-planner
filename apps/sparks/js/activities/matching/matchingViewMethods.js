import { createElement } from '../../main.js';

export const matchingViewMethods = {
render() {
        this.clearTimer();
        this.container.innerHTML = '';

        if (this.words.length === 0) {
            const emptyState = createElement('div', 'matching-empty-state');
            emptyState.innerHTML = '<h2>Matching</h2><p>No matching words are available for this unit.</p>';
            this.container.appendChild(emptyState);
            return;
        }

        const shell = createElement('div', 'matching-shell');
        shell.appendChild(this.renderHud());
        shell.appendChild(this.renderBoard());
        this.container.appendChild(shell);
        this.startTimer();
    },

renderHud() {
        const hud = createElement('div', 'matching-hud');
        const copy = createElement('div', 'matching-hud-copy');
        copy.innerHTML = `
            <div class="matching-hud-heading">
                <h2>Matching Sprint</h2>
                <p>Match 5 random pairs. The next set starts automatically.</p>
            </div>
        `;

        const restartButton = createElement('button', 'btn secondary-btn matching-restart-button', 'New game');
        restartButton.type = 'button';
        restartButton.title = 'Restart this matching game from set 1';
        restartButton.addEventListener('click', () => this.requestRestart());
        copy.appendChild(restartButton);

        const stats = createElement('div', 'matching-stats');
        stats.innerHTML = `
            <div class="matching-stat">
                <span>Set</span>
                <strong id="matching-set-count">${this.getCurrentRoundNumber()}/${this.targetRounds}</strong>
            </div>
            <div class="matching-stat">
                <span>Matched</span>
                <strong id="matching-matched-count">${this.getCompletedPairCount()}/${this.getTargetPairCount()}</strong>
            </div>
            <div class="matching-stat">
                <span>Attempts</span>
                <strong id="matching-attempts-count">${this.attempts}</strong>
            </div>
            <div class="matching-stat">
                <span>Accuracy</span>
                <strong id="matching-accuracy">${this.getAccuracyPercent()}%</strong>
            </div>
            <div class="matching-stat">
                <span>This Set</span>
                <strong id="matching-round-time">${this.formatDuration(this.getCurrentRoundElapsedMs())}</strong>
            </div>
            <div class="matching-stat">
                <span>Best Set</span>
                <strong id="matching-best-round">${this.getBestRoundLabel()}</strong>
            </div>
        `;

        const progress = createElement('div', 'matching-progress');
        progress.innerHTML = `
            <div class="matching-progress-row">
                <span>Progress</span>
                <strong id="matching-progress-text">${this.getProgressPercent()}%</strong>
            </div>
            <div class="matching-progress-track" aria-label="Matching progress">
                <div id="matching-progress-fill" class="matching-progress-fill" style="width: ${this.getProgressPercent()}%;"></div>
            </div>
        `;

        hud.appendChild(copy);
        hud.appendChild(stats);
        hud.appendChild(progress);

        return hud;
    },

renderBoard() {
        const board = createElement('div', 'matching-board');
        board.appendChild(this.renderColumn('Terms', 'term', this.termOrder));
        board.appendChild(this.renderColumn('Definitions', 'definition', this.definitionOrder));
        return board;
    },

renderColumn(title, type, order) {
        const column = createElement('section', `matching-column ${type}-column`);
        const heading = createElement('div', 'matching-column-heading');
        heading.innerHTML = `
            <h3>${title}</h3>
            <span>${this.getCurrentRoundMatchedCount()} of ${this.currentRoundIds.length} in this set</span>
        `;
        column.appendChild(heading);

        order.forEach(id => {
            const word = this.words[id];
            if (!word) return;
            column.appendChild(this.createCard(type, id, word));
        });

        return column;
    },

createCard(type, id, word) {
        const card = document.createElement('button');
        const isMatched = this.matchedRoundIds.has(id);
        card.type = 'button';
        card.className = `matching-card ${type}-card`;
        card.dataset.type = type;
        card.dataset.id = id;
        card.setAttribute('aria-pressed', 'false');

        if (isMatched) {
            card.classList.add('correct');
            card.disabled = true;
            card.setAttribute('aria-pressed', 'true');
        }

        if (type === 'term') {
            const label = createElement('span', 'matching-card-label');
            label.textContent = word.word || '';
            card.appendChild(label);
        } else if (word.definition && word.definition.startsWith('images/')) {
            const img = document.createElement('img');
            img.src = word.definition;
            img.alt = `Definition image for ${word.word}`;
            card.appendChild(img);
        } else {
            const label = createElement('span', 'matching-card-label');
            label.textContent = word.definition || '';
            card.appendChild(label);
        }

        card.addEventListener('click', () => this.handleCardClick(card));
        return card;
    },

updateHud() {
        const setCount = this.container.querySelector('#matching-set-count');
        const matchedCount = this.container.querySelector('#matching-matched-count');
        const attemptsCount = this.container.querySelector('#matching-attempts-count');
        const accuracy = this.container.querySelector('#matching-accuracy');
        const roundTime = this.container.querySelector('#matching-round-time');
        const bestRound = this.container.querySelector('#matching-best-round');
        const progressText = this.container.querySelector('#matching-progress-text');
        const progressFill = this.container.querySelector('#matching-progress-fill');

        if (setCount) setCount.textContent = `${this.getCurrentRoundNumber()}/${this.targetRounds}`;
        if (matchedCount) matchedCount.textContent = `${this.getCompletedPairCount()}/${this.getTargetPairCount()}`;
        if (attemptsCount) attemptsCount.textContent = this.attempts;
        if (accuracy) accuracy.textContent = `${this.getAccuracyPercent()}%`;
        if (roundTime) roundTime.textContent = this.formatDuration(this.getCurrentRoundElapsedMs());
        if (bestRound) bestRound.textContent = this.getBestRoundLabel();
        if (progressText) progressText.textContent = `${this.getProgressPercent()}%`;
        if (progressFill) progressFill.style.width = `${this.getProgressPercent()}%`;
    },

showCompletionScreen() {
        this.clearTimer();

        const accuracy = this.getAccuracyPercent();
        const nextTargetRounds = this.getNextTargetRounds();
        const leveledUp = nextTargetRounds > this.targetRounds;
        const fastest = this.getFastestRound();
        const fastestLabel = fastest ? `Set ${fastest.roundNumber} (${this.formatDuration(fastest.elapsedMs)})` : '--';
        const totalTimeLabel = this.roundStats.length > 0 ? this.formatDuration(this.getTotalTimedMs()) : '--';

        if (!this.difficultyAdjusted) {
            this.saveTargetRounds(nextTargetRounds);
            this.difficultyAdjusted = true;
            this.saveState();
        }

        const completion = createElement('div', 'completion-screen matching-completion');
        completion.innerHTML = `
            <h2>All Sets Complete</h2>
            <p>${leveledUp ? `Nice run. Next time: ${nextTargetRounds} sets.` : `Next time stays at ${this.targetRounds} sets.`}</p>
            <div class="matching-completion-grid">
                <div>
                    <span>Sets</span>
                    <strong>${this.roundsCompleted}/${this.targetRounds}</strong>
                </div>
                <div>
                    <span>Matched</span>
                    <strong>${this.correctPairs}/${this.getTargetPairCount()}</strong>
                </div>
                <div>
                    <span>Attempts</span>
                    <strong>${this.attempts}</strong>
                </div>
                <div>
                    <span>Accuracy</span>
                    <strong>${accuracy}%</strong>
                </div>
                <div>
                    <span>Total Time</span>
                    <strong>${totalTimeLabel}</strong>
                </div>
                <div>
                    <span>Fastest Set</span>
                    <strong>${fastestLabel}</strong>
                </div>
            </div>
            <p class="matching-completion-meta">${this.getScore().details}</p>
            <div class="matching-completion-actions">
                <button id="replay-matching" class="btn primary-btn" type="button">Play Again</button>
                <button id="back-from-matching" class="btn secondary-btn" type="button">Back to Activities</button>
            </div>
        `;

        this.container.innerHTML = '';
        this.container.appendChild(completion);

        this.container.querySelector('#replay-matching')?.addEventListener('click', () => this.restart());
        this.container.querySelector('#back-from-matching')?.addEventListener('click', () => {
            document.querySelector('#back-to-menu-btn')?.click();
        });
    },
};

