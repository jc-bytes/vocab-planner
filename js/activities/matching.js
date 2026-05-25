import { createElement } from '../main.js';

export class MatchingActivity {
    constructor(container, words, onProgress, onSaveState = null, initialState = null) {
        this.container = container;
        this.words = words;
        this.onProgress = onProgress;
        this.onSaveState = onSaveState;
        this.initialState = initialState;
        this.roundSize = 5;
        this.baseRoundCount = 5;
        this.targetRounds = this.loadTargetRounds();
        this.roundsCompleted = 0;
        this.correctPairs = 0;
        this.attempts = 0;
        this.roundAttempts = 0;
        this.roundStartedAt = Date.now();
        this.roundStats = [];
        this.currentRoundIds = [];
        this.termOrder = [];
        this.definitionOrder = [];
        this.matchedRoundIds = new Set();
        this.selectedTerm = null;
        this.selectedDefinition = null;
        this.lockBoard = false;
        this.timerInterval = null;
        this.difficultyAdjusted = false;

        this.restoreState();
        this.ensureActiveRound();
        this.saveState();

        if (this.isSessionComplete()) {
            this.showCompletionScreen();
        } else {
            this.render();
        }
    }

    getStorageKey() {
        return `matching_state_${this.words[0]?.word || 'empty'}_${this.words.length}`;
    }

    getDifficultyKey() {
        return `matching_difficulty_${this.words[0]?.word || 'empty'}_${this.words.length}`;
    }

    getAllIds() {
        return this.words.map((_, index) => index);
    }

    getRoundSize() {
        return Math.min(this.roundSize, this.words.length);
    }

    loadTargetRounds() {
        const saved = localStorage.getItem(this.getDifficultyKey());
        if (!saved) return this.baseRoundCount;

        try {
            const parsed = JSON.parse(saved);
            const value = typeof parsed === 'number' ? parsed : parsed.targetRounds;
            return Math.max(this.baseRoundCount, Number(value) || this.baseRoundCount);
        } catch {
            return Math.max(this.baseRoundCount, Number(saved) || this.baseRoundCount);
        }
    }

    saveTargetRounds(targetRounds) {
        localStorage.setItem(this.getDifficultyKey(), JSON.stringify({
            targetRounds,
            updatedAt: new Date().toISOString()
        }));
    }

    shuffleIds(ids) {
        return [...ids].sort(() => Math.random() - 0.5);
    }

    sampleRoundIds() {
        return this.shuffleIds(this.getAllIds()).slice(0, this.getRoundSize());
    }

    sanitizeIds(ids) {
        if (!Array.isArray(ids)) return [];

        const validIds = new Set(this.getAllIds());
        const seen = new Set();

        return ids
            .map(id => parseInt(id, 10))
            .filter(id => {
                if (!validIds.has(id) || seen.has(id)) return false;
                seen.add(id);
                return true;
            });
    }

    sanitizeRoundStats(stats) {
        if (!Array.isArray(stats)) return [];

        return stats
            .map(stat => ({
                roundNumber: Number(stat.roundNumber),
                size: Number(stat.size),
                elapsedMs: Number(stat.elapsedMs),
                attempts: Number(stat.attempts),
                accuracy: Number(stat.accuracy)
            }))
            .filter(stat => (
                Number.isFinite(stat.roundNumber) &&
                Number.isFinite(stat.size) &&
                Number.isFinite(stat.elapsedMs) &&
                Number.isFinite(stat.attempts) &&
                Number.isFinite(stat.accuracy) &&
                stat.roundNumber > 0 &&
                stat.size > 0 &&
                stat.elapsedMs >= 0 &&
                stat.attempts >= 0
            ));
    }

    hasMatchingWordKeys(wordKeys) {
        if (!Array.isArray(wordKeys) || wordKeys.length === 0) return true;
        if (wordKeys.length !== this.words.length) return false;
        return wordKeys.every((wordKey, index) => wordKey === this.words[index]?.word);
    }

    ensureActiveRound() {
        if (this.words.length === 0 || this.isSessionComplete()) return;

        this.currentRoundIds = this.sanitizeIds(this.currentRoundIds);
        this.matchedRoundIds = new Set(
            this.sanitizeIds(Array.from(this.matchedRoundIds))
                .filter(id => this.currentRoundIds.includes(id))
        );

        if (this.currentRoundIds.length !== this.getRoundSize()) {
            this.startNewRound();
            return;
        }

        this.termOrder = this.ensureOrderForRound(this.termOrder);
        this.definitionOrder = this.ensureOrderForRound(this.definitionOrder);
        this.rotateMatchingDefinitionOrder();
    }

    ensureOrderForRound(order) {
        const roundIds = new Set(this.currentRoundIds);
        const cleanOrder = this.sanitizeIds(order).filter(id => roundIds.has(id));
        const included = new Set(cleanOrder);
        return [
            ...cleanOrder,
            ...this.currentRoundIds.filter(id => !included.has(id))
        ];
    }

    rotateMatchingDefinitionOrder() {
        if (
            this.definitionOrder.length > 1 &&
            this.definitionOrder.every((id, index) => id === this.termOrder[index])
        ) {
            this.definitionOrder.push(this.definitionOrder.shift());
        }
    }

    startNewRound() {
        this.currentRoundIds = this.sampleRoundIds();
        this.termOrder = this.shuffleIds(this.currentRoundIds);
        this.definitionOrder = this.shuffleIds(this.currentRoundIds);
        this.rotateMatchingDefinitionOrder();
        this.matchedRoundIds = new Set();
        this.roundAttempts = 0;
        this.roundStartedAt = Date.now();
        this.resetSelection();
    }

    restoreState() {
        const state = this.initialState && typeof this.initialState === 'object'
            ? this.initialState
            : null;

        if (state && this.applySavedState(state)) {
            return;
        }

        const saved = localStorage.getItem(this.getStorageKey());
        if (!saved) return;

        try {
            this.applySavedState(JSON.parse(saved));
        } catch (error) {
            console.error('Error restoring matching state:', error);
        }
    }

    applySavedState(state) {
        if (!state || state.mode !== 'adaptive-matching-sprint-v1') return false;
        if (!this.hasMatchingWordKeys(state.wordKeys)) return false;

        this.targetRounds = Math.max(this.baseRoundCount, Number(state.targetRounds) || this.targetRounds);
        this.roundsCompleted = Math.max(0, Number(state.roundsCompleted) || 0);
        this.correctPairs = Math.max(0, Number(state.correctPairs) || 0);
        this.attempts = Math.max(0, Number(state.attempts) || 0);
        this.roundAttempts = Math.max(0, Number(state.roundAttempts) || 0);
        this.roundStats = this.sanitizeRoundStats(state.roundStats);
        this.currentRoundIds = this.sanitizeIds(state.currentRoundIds);
        this.termOrder = this.sanitizeIds(state.termOrder);
        this.definitionOrder = this.sanitizeIds(state.definitionOrder);
        this.matchedRoundIds = new Set(this.sanitizeIds(state.matchedRoundIds));
        this.difficultyAdjusted = Boolean(state.difficultyAdjusted);

        const savedRoundElapsed = Math.max(0, Number(state.roundElapsedMs) || 0);
        this.roundStartedAt = Date.now() - savedRoundElapsed;
        return true;
    }

    saveState() {
        const state = {
            mode: 'adaptive-matching-sprint-v1',
            wordKeys: this.words.map(word => word.word),
            targetRounds: this.targetRounds,
            roundsCompleted: this.roundsCompleted,
            correctPairs: this.correctPairs,
            attempts: this.attempts,
            roundAttempts: this.roundAttempts,
            roundStats: this.roundStats,
            currentRoundIds: this.currentRoundIds,
            termOrder: this.termOrder,
            definitionOrder: this.definitionOrder,
            matchedRoundIds: Array.from(this.matchedRoundIds),
            roundElapsedMs: this.getCurrentRoundElapsedMs(),
            difficultyAdjusted: this.difficultyAdjusted
        };

        localStorage.setItem(this.getStorageKey(), JSON.stringify(state));
        if (typeof this.onSaveState === 'function') {
            this.onSaveState(state);
        }
    }

    getCurrentRoundNumber() {
        return Math.min(this.targetRounds, this.roundsCompleted + 1);
    }

    getCurrentRoundMatchedCount() {
        return this.matchedRoundIds.size;
    }

    getCompletedPairCount() {
        return this.correctPairs + this.getCurrentRoundMatchedCount();
    }

    getTargetPairCount() {
        return this.targetRounds * this.getRoundSize();
    }

    getProgressPercent() {
        const targetPairs = this.getTargetPairCount();
        if (targetPairs === 0) return 0;
        return Math.min(100, Math.round((this.getCompletedPairCount() / targetPairs) * 100));
    }

    getAccuracyPercent() {
        if (this.attempts === 0) return 0;
        return Math.round((this.getCompletedPairCount() / this.attempts) * 100);
    }

    getCurrentRoundElapsedMs() {
        if (this.words.length === 0 || this.isSessionComplete()) return 0;
        return Math.max(0, Date.now() - this.roundStartedAt);
    }

    getTimedPairsCount() {
        return this.roundStats.reduce((total, stat) => total + stat.size, 0);
    }

    getTotalTimedMs() {
        return this.roundStats.reduce((total, stat) => total + stat.elapsedMs, 0);
    }

    getFastestRound() {
        if (this.roundStats.length === 0) return null;
        return this.roundStats.reduce((fastest, stat) => (
            stat.elapsedMs < fastest.elapsedMs ? stat : fastest
        ));
    }

    getAverageSecondsPerPair() {
        const timedPairs = this.getTimedPairsCount();
        if (timedPairs === 0) return null;
        return this.getTotalTimedMs() / timedPairs / 1000;
    }

    formatDuration(ms) {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }

    getBestRoundLabel() {
        const fastest = this.getFastestRound();
        return fastest ? this.formatDuration(fastest.elapsedMs) : '--';
    }

    getAverageSpeedLabel() {
        const averageSeconds = this.getAverageSecondsPerPair();
        return averageSeconds === null ? '--' : `${averageSeconds.toFixed(1)}s/pair`;
    }

    isCurrentRoundComplete() {
        return this.currentRoundIds.length > 0 && this.currentRoundIds.every(id => this.matchedRoundIds.has(id));
    }

    isSessionComplete() {
        return this.words.length > 0 && this.roundsCompleted >= this.targetRounds;
    }

    getScore() {
        const progress = this.getProgressPercent();
        const accuracy = this.getAccuracyPercent();
        const completedPairs = this.getCompletedPairCount();
        const targetPairs = this.getTargetPairCount();
        const isComplete = this.isSessionComplete();
        const speedDetails = this.roundStats.length > 0
            ? ` Fastest set: ${this.getBestRoundLabel()}. Average: ${this.getAverageSpeedLabel()}.`
            : '';

        return {
            score: progress,
            details: `Matched ${completedPairs}/${targetPairs} round pairs. Completed ${this.roundsCompleted}/${this.targetRounds} sets. Accuracy: ${accuracy}% (${this.attempts} attempts).${speedDetails}`,
            isComplete
        };
    }

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
    }

    renderHud() {
        const hud = createElement('div', 'matching-hud');
        const copy = createElement('div', 'matching-hud-copy');
        copy.innerHTML = `
            <h2>Matching Sprint</h2>
            <p>Match 5 random pairs. The next set starts automatically.</p>
        `;

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
    }

    renderBoard() {
        const board = createElement('div', 'matching-board');
        board.appendChild(this.renderColumn('Terms', 'term', this.termOrder));
        board.appendChild(this.renderColumn('Definitions', 'definition', this.definitionOrder));
        return board;
    }

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
    }

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
    }

    handleCardClick(card) {
        if (this.lockBoard || card.disabled) return;

        const id = parseInt(card.dataset.id, 10);
        const type = card.dataset.type;

        if (this.matchedRoundIds.has(id)) return;

        if (type === 'term') {
            this.selectTerm(card, id);
        } else {
            this.selectDefinition(card, id);
        }

        if (this.selectedTerm && this.selectedDefinition) {
            this.resolveSelection();
        }
    }

    selectTerm(card, id) {
        if (this.selectedTerm?.card === card) {
            this.clearSelectedCard(this.selectedTerm.card);
            this.selectedTerm = null;
            return;
        }

        if (this.selectedTerm) this.clearSelectedCard(this.selectedTerm.card);
        this.selectedTerm = { card, id };
        this.markSelectedCard(card);
    }

    selectDefinition(card, id) {
        if (this.selectedDefinition?.card === card) {
            this.clearSelectedCard(this.selectedDefinition.card);
            this.selectedDefinition = null;
            return;
        }

        if (this.selectedDefinition) this.clearSelectedCard(this.selectedDefinition.card);
        this.selectedDefinition = { card, id };
        this.markSelectedCard(card);
    }

    markSelectedCard(card) {
        card.classList.add('selected');
        card.setAttribute('aria-pressed', 'true');
    }

    clearSelectedCard(card) {
        card.classList.remove('selected');
        card.setAttribute('aria-pressed', 'false');
    }

    resolveSelection() {
        this.lockBoard = true;
        this.attempts++;
        this.roundAttempts++;

        const isMatch = this.selectedTerm.id === this.selectedDefinition.id;

        if (isMatch) {
            this.handleCorrectMatch(this.selectedTerm.id);
        } else {
            this.handleWrongMatch();
        }
    }

    handleCorrectMatch(id) {
        this.matchedRoundIds.add(id);
        this.selectedTerm.card.classList.add('correct');
        this.selectedDefinition.card.classList.add('correct');
        this.selectedTerm.card.disabled = true;
        this.selectedDefinition.card.disabled = true;

        this.saveState();
        this.updateHud();

        if (!this.isCurrentRoundComplete()) {
            this.notifyProgress();
        }

        setTimeout(() => {
            this.resetSelection();
            this.lockBoard = false;

            if (this.isCurrentRoundComplete()) {
                this.completeCurrentRound();
            } else {
                this.render();
            }
        }, 350);
    }

    handleWrongMatch() {
        this.selectedTerm.card.classList.add('wrong');
        this.selectedDefinition.card.classList.add('wrong');

        this.saveState();
        this.updateHud();
        this.notifyProgress();

        setTimeout(() => {
            this.selectedTerm?.card.classList.remove('selected', 'wrong');
            this.selectedDefinition?.card.classList.remove('selected', 'wrong');
            this.selectedTerm?.card?.setAttribute('aria-pressed', 'false');
            this.selectedDefinition?.card?.setAttribute('aria-pressed', 'false');
            this.resetSelection();
            this.lockBoard = false;
        }, 650);
    }

    completeCurrentRound() {
        const elapsedMs = this.getCurrentRoundElapsedMs();
        const roundSize = this.currentRoundIds.length;
        const roundAccuracy = this.roundAttempts === 0
            ? 100
            : Math.round((roundSize / this.roundAttempts) * 100);

        this.roundStats.push({
            roundNumber: this.roundsCompleted + 1,
            size: roundSize,
            elapsedMs,
            attempts: this.roundAttempts,
            accuracy: roundAccuracy
        });

        this.roundsCompleted++;
        this.correctPairs += roundSize;
        this.matchedRoundIds = new Set();
        this.saveState();
        this.notifyProgress();

        if (this.isSessionComplete()) {
            this.showCompletionScreen();
            return;
        }

        this.startNewRound();
        this.saveState();
        this.render();
    }

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
    }

    startTimer() {
        this.clearTimer();
        this.timerInterval = setInterval(() => this.updateHud(), 1000);
    }

    clearTimer() {
        if (!this.timerInterval) return;
        clearInterval(this.timerInterval);
        this.timerInterval = null;
    }

    notifyProgress() {
        if (this.onProgress) {
            this.onProgress(this.getScore());
        }
    }

    getNextTargetRounds() {
        return this.getAccuracyPercent() > 85 ? this.targetRounds + 1 : this.targetRounds;
    }

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
    }

    restart() {
        this.clearTimer();
        localStorage.removeItem(this.getStorageKey());

        this.targetRounds = this.loadTargetRounds();
        this.roundsCompleted = 0;
        this.correctPairs = 0;
        this.attempts = 0;
        this.roundAttempts = 0;
        this.roundStats = [];
        this.currentRoundIds = [];
        this.termOrder = [];
        this.definitionOrder = [];
        this.matchedRoundIds = new Set();
        this.selectedTerm = null;
        this.selectedDefinition = null;
        this.lockBoard = false;
        this.difficultyAdjusted = false;
        this.startNewRound();
        this.saveState();

        if (this.onProgress) {
            this.onProgress({ score: 0, details: `Matched 0/${this.getTargetPairCount()} round pairs. Completed 0/${this.targetRounds} sets. Accuracy: 0% (0 attempts).`, isComplete: false, isReplay: true });
        }

        this.render();
    }

    resetSelection() {
        this.selectedTerm = null;
        this.selectedDefinition = null;
    }
}
