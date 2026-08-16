import { createElement } from '../main.js';

const FLASHCARD_MASTERY_VERSION = 3;

export class FlashcardsActivity {
    constructor(container, words, onProgress, onSaveState, initialState) {
        this.container = container;
        this.words = words;
        this.onProgress = onProgress;
        this.onSaveState = onSaveState;
        this.initialState = initialState;

        this.currentIndex = 0;
        this.isFlipped = true;
        this.answeredCards = new Set();
        this.questionReadyCards = new Set();
        this.firstAttemptCorrectCards = new Set();
        this.attemptsByCard = {};
        this.feedback = '';
        this.feedbackTone = '';

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
        if (Number(state.masteryVersion) >= 2) {
            this.answeredCards = new Set(this.sanitizeCardIndexes(state.answeredCards));
            this.firstAttemptCorrectCards = new Set(this.sanitizeCardIndexes(state.firstAttemptCorrectCards));
            this.attemptsByCard = this.sanitizeAttempts(state.attemptsByCard);
            if (Number(state.masteryVersion) >= FLASHCARD_MASTERY_VERSION) {
                this.questionReadyCards = new Set(this.sanitizeCardIndexes(state.questionReadyCards));
            }
            this.syncCardViewMode();
        }
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

    sanitizeCardIndexes(indexes) {
        if (!Array.isArray(indexes)) return [];
        const seen = new Set();
        return indexes
            .map(index => Number.parseInt(index, 10))
            .filter(index => {
                const valid = index >= 0 && index < this.words.length && !seen.has(index);
                if (valid) seen.add(index);
                return valid;
            });
    }

    sanitizeAttempts(attempts) {
        if (!attempts || typeof attempts !== 'object' || Array.isArray(attempts)) return {};
        return Object.fromEntries(
            Object.entries(attempts)
                .map(([index, count]) => [Number.parseInt(index, 10), Math.max(0, Number.parseInt(count, 10) || 0)])
                .filter(([index]) => index >= 0 && index < this.words.length)
        );
    }

    saveState() {
        const state = {
            masteryVersion: FLASHCARD_MASTERY_VERSION,
            currentIndex: this.currentIndex,
            answeredCards: Array.from(this.answeredCards),
            questionReadyCards: Array.from(this.questionReadyCards),
            firstAttemptCorrectCards: Array.from(this.firstAttemptCorrectCards),
            attemptsByCard: { ...this.attemptsByCard },
            score: this.getScore().score
        };

        this.onSaveState?.(state);
        localStorage.setItem(this.getStorageKey(), JSON.stringify(state));
    }

    reportProgress() {
        this.onProgress?.(this.getScore());
    }

    getScore() {
        const answeredCount = this.answeredCards.size;
        const total = this.words.length;
        const percentage = total === 0 ? 0 : Math.round((answeredCount / total) * 100);
        const attemptedCards = Object.values(this.attemptsByCard).filter(count => count > 0).length;
        const firstAttemptAccuracy = attemptedCards === 0
            ? 0
            : Math.round((this.firstAttemptCorrectCards.size / attemptedCards) * 100);

        return {
            score: percentage,
            details: `Mastered: ${answeredCount}/${total} cards. First-attempt accuracy: ${firstAttemptAccuracy}%`,
            evidence: {
                masteredCount: answeredCount,
                correctCount: answeredCount,
                totalCount: total,
                firstAttemptCorrectCount: this.firstAttemptCorrectCards.size,
                attemptedCount: attemptedCards
            },
            isComplete: total > 0 && answeredCount === total,
            accuracy: firstAttemptAccuracy
        };
    }

    isCurrentCardAnswered() {
        return this.answeredCards.has(this.currentIndex);
    }

    isCurrentQuestionReady() {
        return this.questionReadyCards.has(this.currentIndex);
    }

    syncCardViewMode() {
        this.isFlipped = this.isCurrentCardAnswered() || !this.isCurrentQuestionReady();
    }

    startCurrentQuestion() {
        if (this.isCurrentCardAnswered()) return false;
        this.questionReadyCards.add(this.currentIndex);
        this.isFlipped = false;
        this.feedback = '';
        this.feedbackTone = '';
        return true;
    }

    handleStartQuestion() {
        if (!this.startCurrentQuestion()) return;
        this.saveState();
        this.render();
    }

    normalizeDefinition(value) {
        return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }

    getDefinition(word = this.words[this.currentIndex]) {
        return String(word?.definition || word?.matchText || word?.example || `The meaning of ${word?.word || 'this word'}`).trim();
    }

    getStableOptionRank(option) {
        const seed = `${this.words[this.currentIndex]?.word || ''}:${this.currentIndex}:${option}`;
        let hash = 0;
        for (let index = 0; index < seed.length; index += 1) {
            hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
        }
        return hash;
    }

    getDefinitionOptions() {
        const correct = this.getDefinition();
        const correctKey = this.normalizeDefinition(correct);
        const seen = new Set([correctKey]);
        const distractors = [];

        this.words.forEach(word => {
            const definition = this.getDefinition(word);
            const key = this.normalizeDefinition(definition);
            if (!key || seen.has(key)) return;
            seen.add(key);
            distractors.push(definition);
        });

        const fallbackOptions = [
            'A different meaning that is not used in this unit',
            'None of the vocabulary definitions shown here',
            'An unrelated action or object'
        ];
        fallbackOptions.forEach(option => {
            if (distractors.length >= 3) return;
            const key = this.normalizeDefinition(option);
            if (!seen.has(key)) {
                seen.add(key);
                distractors.push(option);
            }
        });

        return [correct, ...distractors.slice(0, 3)]
            .sort((a, b) => this.getStableOptionRank(a) - this.getStableOptionRank(b));
    }

    render() {
        this.container.innerHTML = '';

        if (this.words.length === 0) {
            const emptyState = createElement('div', 'matching-empty-state');
            emptyState.innerHTML = '<h2>Flashcards</h2><p>No flashcards are available for this unit.</p>';
            this.container.appendChild(emptyState);
            return;
        }

        const wrapper = createElement('div', 'flashcard-wrapper flashcard-mastery-wrapper');
        const cardScene = createElement('div', 'card-scene');
        const card = createElement('button', 'flashcard');
        card.type = 'button';
        card.setAttribute('aria-label', this.isCurrentCardAnswered()
            ? 'Flip flashcard'
            : this.isCurrentQuestionReady()
                ? 'Vocabulary term shown while answering the definition question'
                : 'Study the vocabulary definition and example');
        card.setAttribute('aria-disabled', this.isCurrentCardAnswered() ? 'false' : 'true');
        if (this.isFlipped) card.classList.add('is-flipped');

        const word = this.words[this.currentIndex];
        card.appendChild(this.createFrontFace(word));
        card.appendChild(this.createBackFace(word));
        cardScene.appendChild(card);

        const panel = createElement('div', 'flashcard-panel flashcard-mastery-panel');
        panel.appendChild(this.createMasteryCheck(word));
        const controls = this.createControls();

        const stage = createElement('div', 'flashcard-stage');
        stage.appendChild(cardScene);
        stage.appendChild(panel);
        stage.appendChild(controls);
        wrapper.appendChild(stage);
        this.container.appendChild(wrapper);

        card.addEventListener('click', () => this.handleCardFlip(card));
        controls.querySelector('#prev-card')?.addEventListener('click', event => this.goToPrevious(event));
        controls.querySelector('#next-card')?.addEventListener('click', event => this.goToNext(event));
    }

    createFrontFace(word) {
        const front = createElement('div', 'card-face card-front');
        const content = createElement('div', 'card-content');
        const heading = document.createElement('h2');
        const hint = createElement('p', 'hint');

        heading.textContent = word.word || '';
        hint.textContent = this.isCurrentCardAnswered()
            ? 'Tap to review the definition'
            : this.isCurrentQuestionReady()
                ? 'Choose the matching definition'
                : 'Study the definition and example';
        content.append(heading, hint);
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
        definition.textContent = this.getDefinition(word);
        example.textContent = word.example ? `“${word.example}”` : '';

        if (word.part_of_speech) content.appendChild(partOfSpeech);
        content.appendChild(definition);
        if (word.example) content.appendChild(example);
        back.appendChild(content);
        return back;
    }

    createMasteryCheck(word) {
        const check = createElement('section', 'flashcard-mastery-check');
        check.setAttribute('aria-label', `Definition check for ${word.word || 'vocabulary word'}`);

        const heading = createElement('h3', null, this.isCurrentCardAnswered()
            ? 'Definition mastered'
            : this.isCurrentQuestionReady()
                ? `Which definition matches “${word.word || ''}”?`
                : `Study “${word.word || ''}”`);
        check.appendChild(heading);

        if (this.isCurrentCardAnswered()) {
            check.appendChild(createElement('p', 'flashcard-feedback is-correct', 'Correct. Review the card, then continue.'));
            return check;
        }

        if (!this.isCurrentQuestionReady()) {
            check.appendChild(createElement(
                'p',
                'flashcard-study-instruction',
                'Read the definition and example on the card. When you are ready, answer a question without looking at them.'
            ));
            const startButton = createElement('button', 'btn primary-btn flashcard-start-question', 'Answer question');
            startButton.type = 'button';
            startButton.addEventListener('click', () => this.handleStartQuestion());
            check.appendChild(startButton);
            return check;
        }

        const optionList = createElement('div', 'flashcard-answer-options');
        this.getDefinitionOptions().forEach(option => {
            const button = createElement('button', 'btn secondary-btn flashcard-answer-option', option);
            button.type = 'button';
            button.addEventListener('click', () => this.handleAnswer(option));
            optionList.appendChild(button);
        });
        check.appendChild(optionList);

        const feedback = createElement('p', `flashcard-feedback${this.feedbackTone ? ` ${this.feedbackTone}` : ''}`, this.feedback);
        feedback.setAttribute('aria-live', 'polite');
        check.appendChild(feedback);

        if ((this.attemptsByCard[this.currentIndex] || 0) >= 2) {
            const hintText = word.example
                ? `Hint: think about this example — “${word.example}”`
                : word.part_of_speech
                    ? `Hint: this word is a ${word.part_of_speech}.`
                    : 'Hint: compare the meaning of each option carefully.';
            check.appendChild(createElement('p', 'flashcard-question-hint', hintText));
        }

        return check;
    }

    createControls() {
        const controls = createElement('div', 'controls flashcard-controls');
        controls.innerHTML = `
            <button id="prev-card" class="btn secondary-btn" type="button">Previous</button>
            <span class="progress">${this.currentIndex + 1} / ${this.words.length}</span>
            <button id="next-card" class="btn primary-btn" type="button">Next</button>
        `;

        const previousButton = controls.querySelector('#prev-card');
        const nextButton = controls.querySelector('#next-card');
        previousButton.disabled = this.currentIndex === 0;

        const isLastCard = this.currentIndex === this.words.length - 1;
        nextButton.disabled = isLastCard || !this.isCurrentCardAnswered();
        nextButton.textContent = isLastCard
            ? (this.isCurrentCardAnswered() ? 'Completed' : 'Answer to finish')
            : 'Next';
        return controls;
    }

    recordAnswer(selectedDefinition) {
        if (this.isCurrentCardAnswered()) return { correct: true, alreadyAnswered: true };
        if (!this.isCurrentQuestionReady()) {
            return { correct: false, alreadyAnswered: false, questionNotReady: true, attempts: 0 };
        }

        const priorAttempts = this.attemptsByCard[this.currentIndex] || 0;
        const correct = this.normalizeDefinition(selectedDefinition) === this.normalizeDefinition(this.getDefinition());
        this.attemptsByCard[this.currentIndex] = priorAttempts + 1;

        if (correct) {
            this.answeredCards.add(this.currentIndex);
            if (priorAttempts === 0) this.firstAttemptCorrectCards.add(this.currentIndex);
            this.feedback = 'Correct! The next card is now unlocked.';
            this.feedbackTone = 'is-correct';
            this.isFlipped = true;
        } else {
            this.feedback = priorAttempts >= 1
                ? 'Not yet. Use the hint and try again.'
                : 'Not quite. Compare the definitions and try again.';
            this.feedbackTone = 'is-incorrect';
            this.isFlipped = false;
        }

        return { correct, alreadyAnswered: false, attempts: priorAttempts + 1 };
    }

    handleAnswer(selectedDefinition) {
        const result = this.recordAnswer(selectedDefinition);
        this.saveState();
        if (result.correct) this.reportProgress();
        this.render();
    }

    handleCardFlip(card) {
        if (!this.isCurrentCardAnswered()) return;
        card.classList.toggle('is-flipped');
        this.isFlipped = !this.isFlipped;
        this.saveState();
    }

    goToPrevious(event) {
        event.stopPropagation();
        if (this.currentIndex === 0) return;
        this.currentIndex -= 1;
        this.syncCardViewMode();
        this.feedback = '';
        this.feedbackTone = '';
        this.render();
        this.saveState();
    }

    goToNext(event) {
        event.stopPropagation();
        if (this.currentIndex >= this.words.length - 1 || !this.isCurrentCardAnswered()) return;
        this.currentIndex += 1;
        this.syncCardViewMode();
        this.feedback = '';
        this.feedbackTone = '';
        this.render();
        this.saveState();
    }
}
