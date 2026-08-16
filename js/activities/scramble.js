import { createElement } from '../main.js';
import { ActivityTimeoutController } from './activityTimeoutController.js';

const MAX_HINTS = 3;

export class ScrambleActivity {
    constructor(container, words, onProgress, onSaveState, initialState) {
        this.container = container;
        this.words = [...words];
        this.originalWords = [...words];
        this.onProgress = onProgress;
        this.onSaveState = onSaveState;
        this.initialState = initialState;

        this.currentIndex = 0;
        this.completedCount = 0;
        this.correctCount = 0;
        this.answerAttempts = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.currentWord = null;
        this.targetAnswer = '';
        this.shuffledLetters = [];
        this.userAnswer = [];
        this.attempts = 0;
        this.hintsUsed = 0;
        this.feedback = '';
        this.feedbackState = 'muted';
        this.missedWords = [];
        this.isFinished = false;
        this.timeouts = new ActivityTimeoutController();

        this.init();
    }

    init() {
        if (!this.restoreState()) {
            this.shuffleWords();
            this.startRound();
        } else {
            this.render();
        }
        this.saveState();
    }

    getStorageKey() {
        const firstWord = this.words[0]?.word || 'empty';
        return `scramble_state_${firstWord}_${this.words.length}`;
    }

    shuffleWords() {
        this.words = [...this.words].sort(() => Math.random() - 0.5);
    }

    restoreState() {
        if (this.applySavedState(this.initialState)) return true;

        const saved = localStorage.getItem(this.getStorageKey()) || localStorage.getItem(`scramble_state_${this.words.length}`);
        if (!saved) return false;

        try {
            return this.applySavedState(JSON.parse(saved));
        } catch (error) {
            console.error('Failed to restore scramble state', error);
            return false;
        }
    }

    applySavedState(state) {
        if (!state) return false;

        if (state.mode === 'scramble-v2') {
            if (state.wordsLength !== this.words.length) return false;
            if (Array.isArray(state.wordKeys) && !this.hasSameWordSet(state.wordKeys)) {
                return false;
            }

            if (Array.isArray(state.shuffledWords) && state.shuffledWords.length === this.words.length) {
                this.words = state.shuffledWords;
            }

            this.currentIndex = Math.min(Math.max(0, Number(state.currentIndex) || 0), this.words.length);
            this.completedCount = Math.max(0, Number(state.completedCount) || 0);
            this.correctCount = Math.max(0, Number(state.correctCount) || 0);
            this.answerAttempts = Math.max(
                this.completedCount,
                Number(state.answerAttempts) || this.completedCount
            );
            this.streak = Math.max(0, Number(state.streak) || 0);
            this.bestStreak = Math.max(0, Number(state.bestStreak) || 0);
            this.currentWord = state.currentWord || null;
            this.targetAnswer = state.targetAnswer || this.normalizeAnswer(this.currentWord?.word || '');
            this.shuffledLetters = Array.isArray(state.shuffledLetters) ? state.shuffledLetters : [];
            this.userAnswer = Array.isArray(state.userAnswer) ? state.userAnswer : [];
            this.attempts = Math.max(0, Number(state.attempts) || 0);
            this.hintsUsed = Math.min(MAX_HINTS, Math.max(0, Number(state.hintsUsed) || 0));
            this.feedback = state.feedback || '';
            this.feedbackState = state.feedbackState || 'muted';
            this.missedWords = Array.isArray(state.missedWords) ? state.missedWords : [];
            this.isFinished = Boolean(state.isFinished);
            if (!this.currentWord && !this.isFinished) this.startRound();
            return true;
        }

        if (state.currentWord) {
            this.currentIndex = Math.min(Math.max(0, Number(state.currentIndex) || 0), this.words.length);
            this.completedCount = this.currentIndex;
            this.answerAttempts = this.completedCount;
            this.currentWord = state.currentWord;
            this.targetAnswer = this.normalizeAnswer(this.currentWord.word);
            this.shuffledLetters = Array.isArray(state.shuffledLetters) ? state.shuffledLetters : [];
            this.userAnswer = Array.isArray(state.userAnswer) ? state.userAnswer : [];
            return true;
        }

        return false;
    }

    saveState() {
        const state = {
            mode: 'scramble-v2',
            wordsLength: this.words.length,
            wordKeys: this.words.map(word => word.word),
            shuffledWords: this.words,
            currentIndex: this.currentIndex,
            completedCount: this.completedCount,
            correctCount: this.correctCount,
            answerAttempts: this.answerAttempts,
            streak: this.streak,
            bestStreak: this.bestStreak,
            currentWord: this.currentWord,
            targetAnswer: this.targetAnswer,
            shuffledLetters: this.shuffledLetters,
            userAnswer: this.userAnswer,
            attempts: this.attempts,
            hintsUsed: this.hintsUsed,
            feedback: this.feedback,
            feedbackState: this.feedbackState,
            missedWords: this.missedWords,
            isFinished: this.isFinished,
            updatedAt: new Date().toISOString()
        };

        localStorage.setItem(this.getStorageKey(), JSON.stringify(state));
        if (this.onSaveState) this.onSaveState(state);
    }

    hasSameWordSet(wordKeys) {
        const currentWords = this.words.map(word => word.word).sort();
        const savedWords = [...wordKeys].sort();
        return currentWords.length === savedWords.length &&
            currentWords.every((word, index) => word === savedWords[index]);
    }

    startRound() {
        if (this.currentIndex >= this.words.length) {
            this.finish();
            return;
        }

        this.currentWord = this.words[this.currentIndex];
        this.targetAnswer = this.normalizeAnswer(this.currentWord.word);
        this.userAnswer = [];
        this.attempts = 0;
        this.hintsUsed = 0;
        this.feedback = '';
        this.feedbackState = 'muted';
        this.shuffledLetters = this.createScrambledLetters(this.targetAnswer);
        this.render();
        this.saveState();
    }

    normalizeAnswer(value) {
        return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    createScrambledLetters(answer) {
        const letters = answer.split('');
        let shuffled = [...letters];

        for (let attempt = 0; attempt < 30; attempt++) {
            shuffled = this.shuffleArray([...letters]);
            const samePositionCount = shuffled.filter((letter, index) => letter === letters[index]).length;
            const isDifferent = shuffled.join('') !== answer;
            const hasGoodMix = letters.length < 4 || samePositionCount <= Math.ceil(letters.length * 0.55);
            if (isDifferent && hasGoodMix) break;
        }

        return shuffled.map((char, index) => ({
            char,
            id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`
        }));
    }

    shuffleArray(items) {
        for (let index = items.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
        }
        return items;
    }

    getScore() {
        const progress = this.words.length ? Math.round((this.correctCount / this.words.length) * 100) : 0;
        const accuracy = this.answerAttempts ? Math.round((this.correctCount / this.answerAttempts) * 100) : 0;
        return {
            score: progress,
            details: `${this.completedCount}/${this.words.length} words. Accuracy: ${accuracy}%. Best streak: ${this.bestStreak}`,
            accuracy,
            evidence: {
                attemptedCount: this.answerAttempts,
                correctCount: this.correctCount,
                totalCount: this.words.length,
                skippedCount: this.missedWords.length,
                accuracy
            },
            isComplete: this.correctCount === this.words.length,
            isFinished: this.completedCount >= this.words.length
        };
    }

    handlePoolClick(letterObj) {
        this.userAnswer.push(letterObj);
        this.shuffledLetters = this.shuffledLetters.filter(letter => letter.id !== letterObj.id);
        this.feedback = '';
        this.render();
        this.saveState();
        this.checkAnswer();
    }

    handleAnswerClick(letterObj) {
        this.shuffledLetters.push(letterObj);
        this.userAnswer = this.userAnswer.filter(letter => letter.id !== letterObj.id);
        this.feedback = '';
        this.render();
        this.saveState();
    }

    clearAnswer() {
        this.shuffledLetters = [...this.shuffledLetters, ...this.userAnswer];
        this.userAnswer = [];
        this.feedback = '';
        this.feedbackState = 'muted';
        this.render();
        this.saveState();
    }

    useHint() {
        if (this.hintsUsed >= MAX_HINTS) return;
        this.hintsUsed++;
        this.feedback = this.getHintText(this.hintsUsed);
        this.feedbackState = 'hint';
        this.render();
        this.saveState();
    }

    getHintText(level) {
        if (level === 1) return `Definition: ${this.currentWord.definition || 'No definition available.'}`;
        if (level === 2) return `Starts with "${this.targetAnswer[0]?.toUpperCase() || ''}".`;
        return `Pattern: ${this.getWordPattern()}`;
    }

    getWordPattern() {
        return this.targetAnswer
            .split('')
            .map((char, index, letters) => {
                if (index === 0 || index === letters.length - 1) return char.toUpperCase();
                return '_';
            })
            .join(' ');
    }

    checkAnswer() {
        const currentString = this.userAnswer.map(letter => letter.char).join('');
        if (currentString.length !== this.targetAnswer.length) return;

        if (currentString === this.targetAnswer) {
            this.solveCurrent();
            return;
        }

        this.attempts++;
        this.answerAttempts++;
        const distance = this.getEditDistance(currentString, this.targetAnswer);
        this.feedback = distance <= 2 ? 'Almost. Check one or two letters.' : 'Not quite. Tap letters to move them back and try again.';
        this.feedbackState = 'error';
        this.render();
        this.saveState();
    }

    solveCurrent() {
        const perfectSolve = this.attempts === 0 && this.hintsUsed === 0;
        this.answerAttempts++;
        this.completedCount++;
        this.correctCount++;
        this.streak++;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        this.feedback = perfectSolve ? 'Perfect solve! Streak bonus.' : 'Correct!';
        this.feedbackState = 'success';
        this.checkProgress();
        this.render();

        this.timeouts.schedule(() => {
            this.currentIndex++;
            this.startRound();
        }, 650);
    }

    skipWord() {
        this.recordMissedWord('Skipped');
        this.answerAttempts++;
        this.completedCount++;
        this.streak = 0;
        this.currentIndex++;
        this.checkProgress();
        this.startRound();
    }

    recordMissedWord(reason) {
        if (!this.currentWord) return;
        this.missedWords.push({
            word: this.currentWord.word,
            definition: this.currentWord.definition,
            answer: this.targetAnswer,
            reason
        });
    }

    getEditDistance(a, b) {
        const rows = Array.from({ length: a.length + 1 }, () => []);
        for (let i = 0; i <= a.length; i++) rows[i][0] = i;
        for (let j = 0; j <= b.length; j++) rows[0][j] = j;

        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                rows[i][j] = a[i - 1] === b[j - 1]
                    ? rows[i - 1][j - 1]
                    : Math.min(rows[i - 1][j - 1], rows[i][j - 1], rows[i - 1][j]) + 1;
            }
        }

        return rows[a.length][b.length];
    }

    checkProgress() {
        if (this.onProgress) this.onProgress(this.getScore());
    }

    finish() {
        this.isFinished = true;
        this.currentWord = null;
        this.saveState();
        this.checkProgress();
        this.renderSummary();
    }

    restart(words = null) {
        localStorage.removeItem(this.getStorageKey());
        this.words = words ? [...words] : [...this.originalWords];
        this.currentIndex = 0;
        this.completedCount = 0;
        this.correctCount = 0;
        this.answerAttempts = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.currentWord = null;
        this.targetAnswer = '';
        this.shuffledLetters = [];
        this.userAnswer = [];
        this.attempts = 0;
        this.hintsUsed = 0;
        this.feedback = '';
        this.feedbackState = 'muted';
        this.missedWords = [];
        this.isFinished = false;
        this.shuffleWords();
        if (this.onProgress) {
            this.onProgress({ score: 0, details: '0 words unscrambled', isComplete: false, isReplay: true });
        }
        this.startRound();
    }

    retryMissed() {
        const missed = this.missedWords.map(item => ({
            word: item.word,
            definition: item.definition
        }));
        this.restart(missed.length ? missed : this.words);
    }

    render() {
        if (this.isFinished) {
            this.renderSummary();
            return;
        }

        this.container.innerHTML = '';

        const wrapper = createElement('div', 'scramble-wrapper');

        const header = createElement('div', 'scramble-header');
        header.innerHTML = `
            <div>
                <div class="scramble-kicker">Word ${this.currentIndex + 1} of ${this.words.length}</div>
                <h2>Unscramble the word</h2>
            </div>
            <div class="scramble-stats">
                <span>Streak ${this.streak}</span>
                <span>Best ${this.bestStreak}</span>
            </div>
        `;
        wrapper.appendChild(header);

        const progress = createElement('div', 'scramble-progress');
        const progressFill = createElement('div', 'scramble-progress-fill');
        progressFill.style.width = `${this.words.length ? (this.completedCount / this.words.length) * 100 : 0}%`;
        progress.appendChild(progressFill);
        wrapper.appendChild(progress);

        const clue = createElement('div', 'scramble-clue');
        clue.innerHTML = this.renderHintHtml();
        wrapper.appendChild(clue);

        const answerArea = createElement('div', `scramble-answer-area ${this.feedbackState === 'error' ? 'is-shaking' : ''}`);
        for (let i = 0; i < this.targetAnswer.length; i++) {
            const slot = createElement('div', 'scramble-slot');
            if (this.userAnswer[i]) {
                const tile = createElement('button', 'scramble-tile in-answer', this.userAnswer[i].char.toUpperCase());
                tile.type = 'button';
                tile.setAttribute('aria-label', `Remove ${this.userAnswer[i].char}`);
                tile.addEventListener('click', () => this.handleAnswerClick(this.userAnswer[i]));
                slot.appendChild(tile);
            }
            answerArea.appendChild(slot);
        }
        wrapper.appendChild(answerArea);

        const poolArea = createElement('div', 'scramble-pool-area');
        this.shuffledLetters.forEach(letter => {
            const tile = createElement('button', 'scramble-tile', letter.char.toUpperCase());
            tile.type = 'button';
            tile.setAttribute('aria-label', `Use ${letter.char}`);
            tile.addEventListener('click', () => this.handlePoolClick(letter));
            poolArea.appendChild(tile);
        });
        wrapper.appendChild(poolArea);

        const feedback = createElement('div', `scramble-feedback ${this.feedbackState}`, this.feedback);
        wrapper.appendChild(feedback);

        const actions = createElement('div', 'scramble-actions');
        const hintBtn = createElement('button', 'btn secondary-btn', this.hintsUsed >= MAX_HINTS ? 'No More Hints' : `Hint ${this.hintsUsed + 1}`);
        hintBtn.type = 'button';
        hintBtn.disabled = this.hintsUsed >= MAX_HINTS;
        hintBtn.addEventListener('click', () => this.useHint());
        actions.appendChild(hintBtn);

        const clearBtn = createElement('button', 'btn secondary-btn', 'Clear');
        clearBtn.type = 'button';
        clearBtn.disabled = this.userAnswer.length === 0;
        clearBtn.addEventListener('click', () => this.clearAnswer());
        actions.appendChild(clearBtn);

        const skipBtn = createElement('button', 'btn text-btn', 'Skip');
        skipBtn.type = 'button';
        skipBtn.addEventListener('click', () => this.skipWord());
        actions.appendChild(skipBtn);

        wrapper.appendChild(actions);
        this.container.appendChild(wrapper);
    }

    renderHintHtml() {
        const hints = [];
        if (this.hintsUsed >= 1) hints.push(`<li>${this.escapeHtml(this.currentWord.definition || 'No definition available.')}</li>`);
        if (this.hintsUsed >= 2) hints.push(`<li>First letter: <strong>${this.escapeHtml(this.targetAnswer[0]?.toUpperCase() || '')}</strong></li>`);
        if (this.hintsUsed >= 3) hints.push(`<li>${this.escapeHtml(this.getWordPattern())}</li>`);

        if (!hints.length) {
            return `<div class="scramble-clue-empty">Use the letters below. Hints reveal the definition, first letter, and pattern.</div>`;
        }

        return `<ul>${hints.join('')}</ul>`;
    }

    renderSummary() {
        const accuracy = this.answerAttempts ? Math.round((this.correctCount / this.answerAttempts) * 100) : 0;
        this.container.innerHTML = `
            <div class="completion-screen scramble-summary">
                <h2>All Words Unscrambled!</h2>
                <div class="scramble-summary-grid">
                    <div><strong>${this.correctCount}</strong><span>Correct</span></div>
                    <div><strong>${accuracy}%</strong><span>Accuracy</span></div>
                    <div><strong>${this.bestStreak}</strong><span>Best Streak</span></div>
                </div>
                ${this.renderMissedReview()}
                <div class="scramble-actions">
                    <button id="replay-scramble" class="btn primary-btn" type="button">Play Again</button>
                    <button id="retry-missed-scramble" class="btn secondary-btn" type="button" ${this.missedWords.length ? '' : 'disabled'}>Retry Missed</button>
                </div>
            </div>
        `;

        this.container.querySelector('#replay-scramble')?.addEventListener('click', () => this.restart());
        this.container.querySelector('#retry-missed-scramble')?.addEventListener('click', () => this.retryMissed());
    }

    renderMissedReview() {
        if (!this.missedWords.length) {
            return '<p class="scramble-review-empty">Perfect run. Nice work.</p>';
        }

        return `
            <div class="scramble-review">
                <h3>Review</h3>
                ${this.missedWords.map(item => `
                    <div class="scramble-review-item">
                        <strong>${this.escapeHtml(item.word)}</strong>
                        <span>${this.escapeHtml(item.definition || 'No definition available.')}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    destroy() {
        this.timeouts.clear();
        this.onProgress = null;
        this.onSaveState = null;
    }
}
