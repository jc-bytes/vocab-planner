import { createElement } from '../main.js';

export class FlashcardsActivity {
    constructor(container, words, onProgress, onSaveState, initialState) {
        this.container = container;
        this.words = words;
        this.onProgress = onProgress;
        this.onSaveState = onSaveState;
        this.initialState = initialState;

        this.currentIndex = 0;
        this.isFlipped = false;
        this.viewedCards = new Set();
        this.studyDurationMs = 10000;
        this.studyStartedAt = null;
        this.studyTimeoutId = null;
        this.studyIntervalId = null;

        this.container.classList.add('flashcards-activity-container');
        this.container.closest('#activity-view')?.classList.add('flashcards-active');
        this.init();
    }

    init() {
        this.restoreState();
        this.render();
        this.reportProgress();
    }

    getStorageKey() {
        return `flashcards_state_${this.words[0]?.word || 'empty'}_${this.words.length}`;
    }

    getLegacyStorageKey() {
        return `flashcards_state_${this.words.length}`;
    }

    restoreState() {
        const state = this.initialState || this.loadLocalState();
        if (!state) return false;

        this.currentIndex = this.clampIndex(state.currentIndex || 0);
        this.viewedCards = new Set(this.sanitizeViewedCards(state.viewedCards));
        return true;
    }

    loadLocalState() {
        const keys = [this.getStorageKey(), this.getLegacyStorageKey()];

        for (const key of keys) {
            const saved = localStorage.getItem(key);
            if (!saved) continue;

            try {
                return JSON.parse(saved);
            } catch (error) {
                console.error('Failed to restore flashcards state', error);
            }
        }

        return null;
    }

    clampIndex(index) {
        if (this.words.length === 0) return 0;
        return Math.min(Math.max(Number(index) || 0, 0), this.words.length - 1);
    }

    sanitizeViewedCards(viewedCards) {
        if (!Array.isArray(viewedCards)) return [];

        const validCards = new Set(this.words.map((_, index) => index));
        const seen = new Set();

        return viewedCards
            .map(index => parseInt(index, 10))
            .filter(index => {
                if (!validCards.has(index) || seen.has(index)) return false;
                seen.add(index);
                return true;
            });
    }

    saveState() {
        const state = {
            currentIndex: this.currentIndex,
            viewedCards: Array.from(this.viewedCards),
            score: this.getScore().score
        };

        if (this.onSaveState) {
            this.onSaveState(state);
        }

        localStorage.setItem(this.getStorageKey(), JSON.stringify(state));
    }

    reportProgress() {
        if (this.onProgress) {
            this.onProgress(this.getScore());
        }
    }

    getScore() {
        const viewedCount = this.viewedCards.size;
        const total = this.words.length;
        const percentage = total === 0 ? 0 : Math.round((viewedCount / total) * 100);

        return {
            score: percentage,
            details: `Studied: ${viewedCount}/${total} cards`,
            isComplete: total > 0 && percentage === 100
        };
    }

    isCurrentCardStudied() {
        return this.viewedCards.has(this.currentIndex);
    }

    getRemainingStudyMs() {
        if (!this.studyStartedAt || this.isCurrentCardStudied()) return 0;
        return Math.max(0, this.studyDurationMs - (Date.now() - this.studyStartedAt));
    }

    render() {
        this.clearStudyTimer();
        this.container.innerHTML = '';

        if (this.words.length === 0) {
            const emptyState = createElement('div', 'matching-empty-state');
            emptyState.innerHTML = '<h2>Flashcards</h2><p>No flashcards are available for this unit.</p>';
            this.container.appendChild(emptyState);
            return;
        }

        const wrapper = createElement('div', 'flashcard-wrapper');
        const cardScene = createElement('div', 'card-scene');
        const card = createElement('button', 'flashcard');
        card.type = 'button';
        card.setAttribute('aria-label', 'Flip flashcard');
        if (this.isFlipped) card.classList.add('is-flipped');

        const word = this.words[this.currentIndex];
        card.appendChild(this.createFrontFace(word));
        card.appendChild(this.createBackFace(word));
        cardScene.appendChild(card);

        const studyStatus = this.createStudyStatus();
        const controls = this.createControls();
        const panel = createElement('div', 'flashcard-panel');
        panel.appendChild(studyStatus);
        panel.appendChild(controls);

        const stage = createElement('div', 'flashcard-stage');
        stage.appendChild(cardScene);
        stage.appendChild(panel);
        wrapper.appendChild(stage);
        this.container.appendChild(wrapper);

        card.addEventListener('click', () => this.handleCardFlip(card));
        controls.querySelector('#prev-card')?.addEventListener('click', event => this.goToPrevious(event));
        controls.querySelector('#next-card')?.addEventListener('click', event => this.goToNext(event));

        this.updateStudyStatus();
        this.updateControls();
    }

    createFrontFace(word) {
        const front = createElement('div', 'card-face card-front');
        const content = createElement('div', 'card-content');
        const heading = document.createElement('h2');
        const hint = createElement('p', 'hint');

        heading.textContent = word.word || '';
        hint.textContent = 'Tap to reveal the definition';

        content.appendChild(heading);
        content.appendChild(hint);
        front.appendChild(content);

        return front;
    }

    createBackFace(word) {
        const back = createElement('div', 'card-face card-back');
        const content = createElement('div', 'card-content');
        const partOfSpeech = createElement('span', 'pos-tag');
        const definition = createElement('p', 'definition');
        const example = createElement('p', 'example');

        partOfSpeech.textContent = word.part_of_speech || '';
        definition.textContent = word.definition || '';
        example.textContent = word.example ? `"${word.example}"` : '';

        if (word.part_of_speech) content.appendChild(partOfSpeech);
        content.appendChild(definition);
        if (word.example) content.appendChild(example);
        back.appendChild(content);

        return back;
    }

    createStudyStatus() {
        const status = createElement('div', 'flashcard-study-status');
        status.setAttribute('aria-live', 'polite');
        status.innerHTML = `
            <span id="flashcard-study-text"></span>
            <div class="flashcard-study-meter" aria-hidden="true">
                <div id="flashcard-study-fill" class="flashcard-study-fill"></div>
            </div>
        `;
        return status;
    }

    createControls() {
        const controls = createElement('div', 'controls flashcard-controls');
        controls.innerHTML = `
            <button id="prev-card" class="btn secondary-btn" type="button">Previous</button>
            <span class="progress">${this.currentIndex + 1} / ${this.words.length}</span>
            <button id="next-card" class="btn primary-btn" type="button">Next</button>
        `;
        return controls;
    }

    handleCardFlip(card) {
        card.classList.toggle('is-flipped');
        this.isFlipped = !this.isFlipped;

        if (this.isFlipped && !this.isCurrentCardStudied()) {
            this.startStudyTimer();
        } else {
            this.clearStudyTimer();
        }

        this.updateStudyStatus();
        this.updateControls();
        this.saveState();
    }

    startStudyTimer() {
        this.clearStudyTimer();
        this.studyStartedAt = Date.now();

        this.studyIntervalId = setInterval(() => {
            this.updateStudyStatus();
            this.updateControls();
        }, 250);

        this.studyTimeoutId = setTimeout(() => this.completeCurrentCardStudy(), this.studyDurationMs);
    }

    completeCurrentCardStudy() {
        if (!this.isFlipped || this.isCurrentCardStudied()) return;

        this.viewedCards.add(this.currentIndex);
        this.clearStudyTimer();
        this.updateStudyStatus();
        this.updateControls();
        this.reportProgress();
        this.saveState();
    }

    clearStudyTimer() {
        if (this.studyTimeoutId) {
            clearTimeout(this.studyTimeoutId);
            this.studyTimeoutId = null;
        }

        if (this.studyIntervalId) {
            clearInterval(this.studyIntervalId);
            this.studyIntervalId = null;
        }

        this.studyStartedAt = null;
    }

    updateStudyStatus() {
        const text = this.container.querySelector('#flashcard-study-text');
        const fill = this.container.querySelector('#flashcard-study-fill');
        if (!text || !fill) return;

        if (this.isCurrentCardStudied()) {
            text.textContent = 'Card counted';
            fill.style.width = '100%';
            return;
        }

        if (!this.isFlipped) {
            text.textContent = 'Reveal the definition to start the 10 second study timer';
            fill.style.width = '0%';
            return;
        }

        const remainingMs = this.getRemainingStudyMs();
        const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
        const elapsedPercent = Math.min(100, Math.round(((this.studyDurationMs - remainingMs) / this.studyDurationMs) * 100));

        text.textContent = `Keep studying: ${remainingSeconds}s`;
        fill.style.width = `${elapsedPercent}%`;
    }

    updateControls() {
        const previousButton = this.container.querySelector('#prev-card');
        const nextButton = this.container.querySelector('#next-card');
        if (!previousButton || !nextButton) return;

        previousButton.disabled = this.currentIndex === 0;

        const isLastCard = this.currentIndex === this.words.length - 1;
        const isStudied = this.isCurrentCardStudied();
        nextButton.disabled = isLastCard || !isStudied;

        if (isLastCard) {
            nextButton.textContent = 'Last Card';
        } else if (isStudied) {
            nextButton.textContent = 'Next';
        } else if (this.isFlipped) {
            nextButton.textContent = `Next in ${Math.max(1, Math.ceil(this.getRemainingStudyMs() / 1000))}s`;
        } else {
            nextButton.textContent = 'Next';
        }
    }

    goToPrevious(event) {
        event.stopPropagation();
        if (this.currentIndex === 0) return;

        this.clearStudyTimer();
        this.currentIndex--;
        this.isFlipped = false;
        this.render();
        this.saveState();
    }

    goToNext(event) {
        event.stopPropagation();
        if (this.currentIndex >= this.words.length - 1 || !this.isCurrentCardStudied()) return;

        this.clearStudyTimer();
        this.currentIndex++;
        this.isFlipped = false;
        this.render();
        this.saveState();
    }
}
