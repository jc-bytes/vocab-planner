import { createElement } from '../main.js';
import { readStudentActivityValue, removeStudentActivityValue, writeStudentActivityValue } from '../student/persistence/studentStorage.js';

const MAX_GUESSES = 6;

export class WordleActivity {
    constructor(container, words, onProgress, onSaveState, initialState) {
        this.container = container;
        this.words = words
            .map(w => ({ ...w, cleanWord: this.normalizeWord(w.word) }))
            .filter(w => w.cleanWord.length >= 3 && w.cleanWord.length <= 10);
        this.onProgress = onProgress;
        this.onSaveState = onSaveState;
        this.initialState = initialState;
        this.currentIndex = 0;
        this.currentGuess = '';
        this.guesses = [];
        this.completedWords = [];
        this.missedWords = [];
        this.message = 'Use the definition as your hint.';
        this.handleKeydown = this.handleKeydown.bind(this);
        window.addEventListener('keydown', this.handleKeydown);

        this.init();
    }

    init() {
        if (this.words.length === 0) {
            this.container.innerHTML = '<p style="text-align:center; padding:2rem;">Wordle needs vocabulary words with 3 to 10 letters.</p>';
            return;
        }

        if (!this.restoreState()) {
            this.words.sort(() => Math.random() - 0.5);
        }

        this.render();
        this.reportProgress();
    }

    normalizeWord(word) {
        return String(word || '').toUpperCase().replace(/[^A-Z]/g, '');
    }

    get currentWord() {
        return this.words[this.currentIndex] || null;
    }

    restoreState() {
        const state = this.initialState || this.getLocalState();
        if (!state) return false;

        try {
            this.currentIndex = Number.isInteger(state.currentIndex) ? state.currentIndex : 0;
            this.currentGuess = state.currentGuess || '';
            this.guesses = Array.isArray(state.guesses) ? state.guesses : [];
            this.completedWords = Array.isArray(state.completedWords) ? state.completedWords : [];
            this.missedWords = Array.isArray(state.missedWords) ? state.missedWords : [];
            this.message = state.message || this.message;

            if (Array.isArray(state.wordKeys)) {
                const wordsByKey = new Map(this.words.map(word => [word.word, word]));
                const restoredWords = state.wordKeys.map(key => wordsByKey.get(key)).filter(Boolean);
                if (restoredWords.length === state.wordKeys.length) {
                    this.words = restoredWords;
                }
            }

            if (this.currentIndex >= this.words.length) {
                this.currentIndex = this.words.length;
            }

            return true;
        } catch (error) {
            console.error('Failed to restore wordle state', error);
            return false;
        }
    }

    getLocalState() {
        const saved = readStudentActivityValue(`wordle_state_${this.words.length}`);
        return saved ? JSON.parse(saved) : null;
    }

    saveState() {
        const state = {
            currentIndex: this.currentIndex,
            currentGuess: this.currentGuess,
            guesses: this.guesses,
            completedWords: this.completedWords,
            missedWords: this.missedWords,
            message: this.message,
            wordKeys: this.words.map(w => w.word)
        };

        if (this.onSaveState) this.onSaveState(state);
        writeStudentActivityValue(`wordle_state_${this.words.length}`, JSON.stringify(state));
    }

    addLetter(letter) {
        const target = this.currentWord;
        if (!target || this.isRoundComplete() || this.currentGuess.length >= target.cleanWord.length) return;

        this.currentGuess += letter;
        this.message = 'Keep going.';
        this.saveState();
        this.render();
    }

    handleKeydown(event) {
        if (!this.currentWord || this.currentIndex >= this.words.length) return;

        if (this.isRoundComplete()) {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.nextWord();
            }
            return;
        }

        if (/^[a-zA-Z]$/.test(event.key)) {
            event.preventDefault();
            this.addLetter(event.key.toUpperCase());
        } else if (event.key === 'Backspace') {
            event.preventDefault();
            this.backspace();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            this.submitGuess();
        }
    }

    backspace() {
        if (this.isRoundComplete() || !this.currentGuess) return;

        this.currentGuess = this.currentGuess.slice(0, -1);
        this.saveState();
        this.render();
    }

    submitGuess() {
        const target = this.currentWord;
        if (!target) return;

        if (this.isRoundComplete()) {
            this.nextWord();
            return;
        }

        if (this.currentGuess.length !== target.cleanWord.length) {
            this.message = `Your guess needs ${target.cleanWord.length} letters.`;
            this.render();
            return;
        }

        this.guesses.push(this.currentGuess);

        if (this.currentGuess === target.cleanWord) {
            this.completedWords.push(target.cleanWord);
            this.message = `Correct: ${target.word}. ${this.getNextActionPrompt()}`;
            this.currentGuess = '';
            this.saveState();
            this.reportProgress();
            this.render();
            return;
        }

        if (this.guesses.length >= MAX_GUESSES) {
            this.missedWords.push(target.cleanWord);
            this.message = `The word was ${target.word}. ${this.getNextActionPrompt()}`;
        } else {
            this.message = `${MAX_GUESSES - this.guesses.length} guesses left.`;
        }

        this.currentGuess = '';
        this.saveState();
        this.reportProgress();
        this.render();
    }

    nextWord() {
        if (this.currentIndex < this.words.length) {
            this.currentIndex++;
        }
        this.currentGuess = '';
        this.guesses = [];
        this.message = 'Use the definition as your hint.';
        this.saveState();
        this.reportProgress();
        this.render();
    }

    restart() {
        removeStudentActivityValue(`wordle_state_${this.words.length}`);
        this.words.sort(() => Math.random() - 0.5);
        this.currentIndex = 0;
        this.currentGuess = '';
        this.guesses = [];
        this.completedWords = [];
        this.missedWords = [];
        this.message = 'Use the definition as your hint.';
        this.saveState();
        this.reportProgress(true);
        this.render();
    }

    getScore() {
        const score = Math.round((this.completedWords.length / this.words.length) * 100);
        return {
            score,
            details: `${this.completedWords.length}/${this.words.length} words solved`,
            evidence: {
                correctCount: this.completedWords.length,
                failedCount: this.missedWords.length,
                totalCount: this.words.length
            },
            isComplete: this.completedWords.length === this.words.length,
            isFinished: this.completedWords.length + this.missedWords.length >= this.words.length
        };
    }

    reportProgress(isReplay = false) {
        if (!this.onProgress) return;
        this.onProgress({ ...this.getScore(), isReplay });
    }

    getFeedback(guess) {
        const answer = this.currentWord.cleanWord;
        const feedback = new Array(guess.length).fill('absent');
        const remaining = {};

        for (let i = 0; i < answer.length; i++) {
            if (guess[i] === answer[i]) {
                feedback[i] = 'correct';
            } else {
                remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
            }
        }

        for (let i = 0; i < guess.length; i++) {
            if (feedback[i] === 'correct') continue;
            if (remaining[guess[i]] > 0) {
                feedback[i] = 'present';
                remaining[guess[i]]--;
            }
        }

        return feedback;
    }

    getKeyboardStatus(letter) {
        let status = '';
        this.guesses.forEach(guess => {
            const feedback = this.getFeedback(guess);
            guess.split('').forEach((char, index) => {
                if (char !== letter) return;
                const nextStatus = feedback[index];
                if (nextStatus === 'correct') status = 'correct';
                if (nextStatus === 'present' && status !== 'correct') status = 'present';
                if (nextStatus === 'absent' && !status) status = 'absent';
            });
        });
        return status;
    }

    isRoundComplete() {
        const target = this.currentWord;
        return Boolean(target && (
            this.guesses.includes(target.cleanWord) || this.guesses.length >= MAX_GUESSES
        ));
    }

    getNextActionPrompt() {
        return this.currentIndex === this.words.length - 1
            ? 'Press Enter to finish.'
            : 'Press Enter for the next word.';
    }

    getDisplayMessage() {
        const target = this.currentWord;
        if (target && this.currentGuess.length === target.cleanWord.length) {
            return 'Press Enter to check.';
        }
        return this.message;
    }

    render() {
        this.container.innerHTML = '';

        if (this.currentIndex >= this.words.length) {
            this.renderCompletion();
            return;
        }

        const target = this.currentWord;
        const wrapper = createElement('div', 'wordle-wrapper');

        const header = createElement('div', 'wordle-header');
        header.innerHTML = `
            <div>
                <h2>Vocabulary Wordle</h2>
                <p>${this.currentIndex + 1} of ${this.words.length}</p>
            </div>
            <button class="btn text-btn" id="wordle-restart">Play Again</button>
        `;
        wrapper.appendChild(header);

        const hint = createElement('div', 'wordle-hint');
        const hintLabel = document.createElement('strong');
        hintLabel.textContent = 'Definition:';
        hint.appendChild(hintLabel);
        hint.append(` ${target.definition || ''}`);
        wrapper.appendChild(hint);

        const board = createElement('div', 'wordle-board');
        board.style.setProperty('--wordle-length', target.cleanWord.length);
        for (let row = 0; row < MAX_GUESSES; row++) {
            const guess = this.guesses[row] || (row === this.guesses.length ? this.currentGuess : '');
            const feedback = this.guesses[row] ? this.getFeedback(guess) : [];

            for (let col = 0; col < target.cleanWord.length; col++) {
                const tile = createElement('div', `wordle-tile ${feedback[col] || ''}`);
                tile.textContent = guess[col] || '';
                board.appendChild(tile);
            }
        }
        wrapper.appendChild(board);

        const message = createElement('div', 'wordle-message', this.getDisplayMessage());
        wrapper.appendChild(message);

        if (this.isRoundComplete()) {
            const nextButton = createElement('button', 'btn primary-btn', this.currentIndex === this.words.length - 1 ? 'Finish' : 'Next Word');
            nextButton.addEventListener('click', () => this.nextWord());
            wrapper.appendChild(nextButton);
        } else {
            wrapper.appendChild(this.renderKeyboard());
        }

        this.container.appendChild(wrapper);
        this.container.querySelector('#wordle-restart')?.addEventListener('click', () => this.restart());
    }

    renderKeyboard() {
        const keyboard = createElement('div', 'wordle-keyboard');
        const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

        rows.forEach((row, rowIndex) => {
            const keyRow = createElement('div', 'wordle-key-row');
            if (rowIndex === 2) {
                const enter = createElement('button', 'wordle-key wide', 'Enter');
                enter.addEventListener('click', () => this.submitGuess());
                keyRow.appendChild(enter);
            }

            row.split('').forEach(letter => {
                const key = createElement('button', `wordle-key ${this.getKeyboardStatus(letter)}`, letter);
                key.addEventListener('click', () => this.addLetter(letter));
                keyRow.appendChild(key);
            });

            if (rowIndex === 2) {
                const back = createElement('button', 'wordle-key wide', '⌫');
                back.addEventListener('click', () => this.backspace());
                keyRow.appendChild(back);
            }

            keyboard.appendChild(keyRow);
        });

        return keyboard;
    }

    renderCompletion() {
        const wrapper = createElement('div', 'wordle-completion');
        wrapper.innerHTML = `
            <h2>Vocabulary Wordle Complete</h2>
            <p>You solved ${this.completedWords.length} of ${this.words.length} words.</p>
            <button class="btn primary-btn" id="wordle-replay">Play Again</button>
        `;
        this.container.appendChild(wrapper);
        this.container.querySelector('#wordle-replay')?.addEventListener('click', () => this.restart());
    }

    destroy() {
        window.removeEventListener('keydown', this.handleKeydown);
    }
}
