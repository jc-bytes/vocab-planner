import { createElement, $, notifications } from '../main.js';
import { ActivityTimeoutController } from './activityTimeoutController.js';

export class HangmanActivity {
    constructor(container, words, onProgress, onSaveState, initialState) {
        this.container = container;
        this.words = words;
        this.onProgress = onProgress;
        this.onSaveState = onSaveState;
        this.initialState = initialState;

        this.currentWordIndex = 0;
        this.score = 0;
        this.maxMistakes = 6;

        this.mistakes = 0;
        this.guessedLetters = new Set();
        this.wordStatus = []; // null or letter
        this.timeouts = new ActivityTimeoutController();

        this.init();
    }

    init() {
        if (!this.restoreState()) {
            // Shuffle words if new game
            this.words.sort(() => Math.random() - 0.5);
            this.startRound();
        } else if (this.currentWordIndex >= this.words.length) {
            this.startRound();
        } else {
            this.render();
        }
    }

    applyRestoredState(state) {
        if (!state || typeof state !== 'object') return false;

        const restoredWords = Array.isArray(state.shuffledWords) && state.shuffledWords.length > 0
            ? state.shuffledWords
            : this.words;
        const restoredIndex = Number(state.currentWordIndex);
        if (
            !Number.isInteger(restoredIndex)
            || restoredIndex < 0
            || restoredIndex > restoredWords.length
        ) {
            return false;
        }

        this.words = restoredWords;
        this.currentWordIndex = restoredIndex;
        this.score = Math.max(0, Number(state.score) || 0);
        this.mistakes = Math.max(0, Math.min(this.maxMistakes, Number(state.mistakes) || 0));
        this.guessedLetters = new Set(Array.isArray(state.guessedLetters) ? state.guessedLetters : []);

        if (this.currentWordIndex === this.words.length) {
            this.currentWord = null;
            this.wordStatus = [];
            return true;
        }

        this.currentWord = this.words[this.currentWordIndex];
        if (!this.currentWord || typeof this.currentWord.word !== 'string' || !this.currentWord.word) {
            return false;
        }

        this.wordStatus = Array.isArray(state.wordStatus)
            && state.wordStatus.length === this.currentWord.word.length
            ? state.wordStatus
            : new Array(this.currentWord.word.length).fill(null);
        return true;
    }

    restoreState() {
        // Try initial state passed from StudentManager
        if (this.initialState) {
            return this.applyRestoredState(this.initialState);
        }

        const key = `hangman_state_${this.words.length}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                return this.applyRestoredState(state);
            } catch (e) {
                console.error('Failed to restore hangman state', e);
            }
        }
        return false;
    }

    saveState() {
        const state = {
            currentWordIndex: this.currentWordIndex,
            score: this.score,
            mistakes: this.mistakes,
            guessedLetters: Array.from(this.guessedLetters),
            wordStatus: this.wordStatus,
            shuffledWords: this.words
        };

        if (this.onSaveState) {
            this.onSaveState(state);
        }

        const key = `hangman_state_${this.words.length}`;
        localStorage.setItem(key, JSON.stringify(state));
    }

    startRound() {
        if (this.currentWordIndex >= this.words.length) {
            this.container.innerHTML = `
                <div class="completion-screen">
                    <h2 class="activity-result-heading">
                        <i data-lucide="badge-check" aria-hidden="true"></i>
                        <span>All Words Completed!</span>
                    </h2>
                    <p>You completed ${this.words.length} words!</p>
                    <button id="replay-hangman" class="btn primary-btn" style="margin-top: 1rem;">
                        <i data-lucide="rotate-ccw" aria-hidden="true"></i>
                        <span>Play Again</span>
                    </button>
                </div>
            `;
            window.lucide?.createIcons({ root: this.container });
            
            // Add replay button listener
            const replayBtn = this.container.querySelector('#replay-hangman');
            if (replayBtn) {
                replayBtn.addEventListener('click', () => this.restart());
            }
            return;
        }

        this.currentWord = this.words[this.currentWordIndex];
        this.mistakes = 0;
        this.guessedLetters.clear();
        this.wordStatus = new Array(this.currentWord.word.length).fill(null);

        // Pre-fill non-alpha characters (spaces, hyphens)
        for (let i = 0; i < this.currentWord.word.length; i++) {
            if (!/[a-zA-Z]/.test(this.currentWord.word[i])) {
                this.wordStatus[i] = this.currentWord.word[i];
            }
        }

        this.render();
    }

    getScore() {
        // Score based on words completed without failing
        // Or simple progress: words completed / total words
        const progress = Math.round((this.currentWordIndex / this.words.length) * 100);
        return {
            score: progress,
            details: `${this.currentWordIndex}/${this.words.length} words completed`,
            evidence: { correctCount: this.currentWordIndex, totalCount: this.words.length },
            isComplete: this.currentWordIndex === this.words.length
        };
    }

    handleGuess(letter) {
        if (this.guessedLetters.has(letter)) return;

        this.guessedLetters.add(letter);
        const upperWord = this.currentWord.word.toUpperCase();

        if (upperWord.includes(letter)) {
            // Correct guess
            for (let i = 0; i < upperWord.length; i++) {
                if (upperWord[i] === letter) {
                    this.wordStatus[i] = this.currentWord.word[i]; // Reveal original case
                }
            }

            if (!this.wordStatus.includes(null)) {
                this.timeouts.schedule(() => {
                    notifications.success(`Correct! The word was: ${this.currentWord.word}`);
                    this.currentWordIndex++;
                    this.checkProgress();
                    this.startRound();
                    this.saveState();
                }, 500);
            } else {
                this.saveState(); // Save progress within word
            }
        } else {
            // Wrong guess
            this.mistakes++;
            if (this.mistakes >= this.maxMistakes) {
                this.timeouts.schedule(() => {
                    notifications.info(`The word was: ${this.currentWord.word}. Try it again to continue.`);
                    this.startRound();
                    this.saveState();
                }, 500);
            } else {
                this.saveState(); // Save mistake
            }
        }

        this.render();
    }

    checkProgress() {
        if (this.onProgress) {
            this.onProgress(this.getScore());
        }
    }

    render() {
        this.container.innerHTML = '';

        const wrapper = createElement('div', 'hangman-wrapper');

        // Drawing Area
        const drawing = createElement('div', 'hangman-drawing');
        drawing.innerHTML = this.getHangmanSVG(this.mistakes);
        wrapper.appendChild(drawing);

        // Word Display
        const wordDisplay = createElement('div', 'hangman-word');
        this.wordStatus.forEach(char => {
            const span = createElement('span', 'letter-slot');
            span.textContent = char === null ? '_' : char;
            wordDisplay.appendChild(span);
        });
        wrapper.appendChild(wordDisplay);

        // Hint
        const hint = createElement('div', 'hangman-hint');
        const hintLabel = document.createElement('strong');
        hintLabel.textContent = 'Hint:';
        hint.appendChild(hintLabel);
        hint.append(` ${this.currentWord.definition || ''}`);
        wrapper.appendChild(hint);

        // Keyboard
        const keyboard = createElement('div', 'hangman-keyboard');
        const rows = [
            'QWERTYUIOP',
            'ASDFGHJKL',
            'ZXCVBNM'
        ];

        rows.forEach(row => {
            const rowEl = createElement('div', 'keyboard-row');
            row.split('').forEach(char => {
                const btn = createElement('button', 'key-btn', char);
                if (this.guessedLetters.has(char)) {
                    btn.disabled = true;
                    if (this.currentWord.word.toUpperCase().includes(char)) {
                        btn.classList.add('correct');
                    } else {
                        btn.classList.add('wrong');
                    }
                }
                btn.addEventListener('click', () => this.handleGuess(char));
                rowEl.appendChild(btn);
            });
            keyboard.appendChild(rowEl);
        });
        wrapper.appendChild(keyboard);

        this.container.appendChild(wrapper);
    }

    restart() {
        // Clear saved state
        const key = `hangman_state_${this.words.length}`;
        localStorage.removeItem(key);
        
        // Reset game state
        this.currentWordIndex = 0;
        this.score = 0;
        this.mistakes = 0;
        this.guessedLetters = new Set();
        this.wordStatus = [];
        
        // Reshuffle words for variety
        this.words.sort(() => Math.random() - 0.5);
        
        // Notify progress system of new session
        if (this.onProgress) {
            this.onProgress({ score: 0, details: '0/0 words completed', isComplete: false, isReplay: true });
        }
        
        this.startRound();
        this.saveState();
    }

    getHangmanSVG(mistakes) {
        // Simple SVG hangman
        const parts = [
            '<line x1="10" y1="250" x2="150" y2="250" />', // Base
            '<line x1="80" y1="250" x2="80" y2="20" />',   // Pole
            '<line x1="80" y1="20" x2="200" y2="20" />',   // Top
            '<line x1="200" y1="20" x2="200" y2="50" />',  // Rope
            '<circle cx="200" cy="80" r="30" />',          // Head
            '<line x1="200" y1="110" x2="200" y2="170" />',// Body
            '<line x1="200" y1="130" x2="170" y2="160" />',// Left Arm
            '<line x1="200" y1="130" x2="230" y2="160" />',// Right Arm
            '<line x1="200" y1="170" x2="170" y2="220" />',// Left Leg
            '<line x1="200" y1="170" x2="230" y2="220" />' // Right Leg
        ];

        // Always show base structure (first 4)
        // Then show mistakes
        let svgContent = parts.slice(0, 4).join('');
        if (mistakes > 0) svgContent += parts[4]; // Head
        if (mistakes > 1) svgContent += parts[5]; // Body
        if (mistakes > 2) svgContent += parts[6]; // L Arm
        if (mistakes > 3) svgContent += parts[7]; // R Arm
        if (mistakes > 4) svgContent += parts[8]; // L Leg
        if (mistakes > 5) svgContent += parts[9]; // R Leg

        return `<svg width="300" height="260" viewBox="0 0 300 260" stroke="white" stroke-width="4" fill="none">${svgContent}</svg>`;
    }

    destroy() {
        this.timeouts.clear();
        this.onProgress = null;
        this.onSaveState = null;
    }
}
