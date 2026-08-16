
import { createElement, $, notifications, openModal, closeModal } from '../main.js';
import { ActivityTimeoutController } from './activityTimeoutController.js';

export class FillInBlankActivity {
    constructor(container, words, onProgress, onSaveState, initialState) {
        this.container = container;
        this.words = words;
        this.onProgress = onProgress;
        this.onSaveState = onSaveState;
        this.initialState = initialState;

        this.currentIndex = 0;
        this.score = 0;
        this.currentWord = null;
        this.attempts = 0;
        this.timeouts = new ActivityTimeoutController();

        this.init();
    }

    init() {
        if (!this.restoreState()) {
            this.words.sort(() => Math.random() - 0.5);
            this.startRound();
        } else {
            this.render();
        }
    }

    restoreState() {
        if (this.initialState) {
            const state = this.initialState;
            this.currentIndex = state.currentIndex;
            this.score = state.score;
            this.attempts = state.attempts;

            if (state.shuffledWords) {
                this.words = state.shuffledWords;
            }

            this.currentWord = this.words[this.currentIndex];
            return true;
        }

        const key = `fib_state_${this.words.length} `;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.currentIndex = state.currentIndex;
                this.score = state.score;
                this.attempts = state.attempts;

                if (state.shuffledWords) {
                    this.words = state.shuffledWords;
                }

                this.currentWord = this.words[this.currentIndex];
                return true;
            } catch (e) {
                console.error('Failed to restore fib state', e);
            }
        }
        return false;
    }

    saveState() {
        const state = {
            currentIndex: this.currentIndex,
            score: this.score,
            attempts: this.attempts,
            shuffledWords: this.words
        };

        if (this.onSaveState) {
            this.onSaveState(state);
        }

        const key = `fib_state_${this.words.length} `;
        localStorage.setItem(key, JSON.stringify(state));
    }

    startRound() {
        if (this.currentIndex >= this.words.length) {
            this.container.innerHTML = `
                <div class="completion-screen">
                    <h2 class="activity-result-heading">
                        <i data-lucide="badge-check" aria-hidden="true"></i>
                        <span>All Words Completed!</span>
                    </h2>
                    <p>You completed ${this.words.length} words!</p>
                    <button id="replay-fib" class="btn primary-btn" style="margin-top: 1rem;">
                        <i data-lucide="rotate-ccw" aria-hidden="true"></i>
                        <span>Play Again</span>
                    </button>
                </div>
            `;
            window.lucide?.createIcons({ root: this.container });
            
            // Add replay button listener
            const replayBtn = this.container.querySelector('#replay-fib');
            if (replayBtn) {
                replayBtn.addEventListener('click', () => this.restart());
            }
            return;
        }

        this.currentWord = this.words[this.currentIndex];
        this.attempts = 0;
        this.render();
    }

    getScore() {
        const progress = Math.round((this.currentIndex / this.words.length) * 100);
        return {
            score: progress,
            details: `${this.currentIndex}/${this.words.length} words completed`,
            evidence: { correctCount: this.currentIndex, totalCount: this.words.length },
            isComplete: this.currentIndex === this.words.length
        };
    }

    checkAnswer() {
        const input = this.container.querySelector('.fib-input');
        const val = input.value.trim().toLowerCase();
        const correct = this.currentWord.word.toLowerCase();

        if (val === correct) {
            // Correct
            input.classList.add('correct');
            this.timeouts.schedule(() => {
                notifications.success('Correct!');
                this.currentIndex++;
                this.checkProgress();
                this.startRound();
                this.saveState();
            }, 500);
        } else {
            // Wrong
            input.classList.add('wrong');
            this.attempts++;
            this.saveState();
            this.timeouts.schedule(() => {
                input.classList.remove('wrong');
                input.value = '';
                input.focus();
            }, 1000);

            if (this.attempts >= 3) {
                notifications.info(`The correct word was: ${this.currentWord.word}`);
                this.attempts = 0;
                this.saveState();
            }
        }
    }

    checkProgress() {
        if (this.onProgress) {
            this.onProgress(this.getScore());
        }
    }

    getHints(word = this.currentWord) {
        if (!word) return [];

        const hints = [];
        const addHint = (label, value) => {
            const text = String(value || '').trim();
            if (text) hints.push({ label, text });
        };
        const cleanList = (values) => Array.from(new Set(
            (Array.isArray(values) ? values : [])
                .map(value => String(value || '').trim())
                .filter(Boolean)
        ));

        addHint('Definition', word.definition);

        const synonyms = cleanList(word.synonyms);
        if (synonyms.length > 0) {
            addHint(synonyms.length === 1 ? 'Synonym' : 'Synonyms', synonyms.join(', '));
        }

        const antonyms = cleanList(word.antonyms);
        if (antonyms.length > 0) {
            addHint(antonyms.length === 1 ? 'Antonym' : 'Antonyms', antonyms.join(', '));
        }

        addHint('Part of speech', word.part_of_speech || word.partOfSpeech);

        const answer = String(word.word || '').trim();
        if (answer) {
            const letters = Array.from(answer).filter(character => /[\p{L}\p{N}]/u.test(character)).length;
            const firstCharacter = Array.from(answer)[0];
            addHint(
                'Word clue',
                `Starts with “${firstCharacter.toUpperCase()}” and has ${letters} ${letters === 1 ? 'letter' : 'letters'}.`
            );
        }

        return hints;
    }

    restart() {
        // Clear saved state
        const key = `fib_state_${this.words.length}`;
        localStorage.removeItem(key);
        localStorage.removeItem(key.trim());
        
        // Reset game state
        this.currentIndex = 0;
        this.score = 0;
        this.currentWord = null;
        this.attempts = 0;
        
        // Reshuffle words for variety
        this.words.sort(() => Math.random() - 0.5);
        
        // Notify progress system of new session
        if (this.onProgress) {
            this.onProgress({ score: 0, details: '0/0 words completed', isComplete: false, isReplay: true });
        }
        
        this.startRound();
        this.saveState();
    }

    render() {
        this.container.innerHTML = '';

        const wrapper = createElement('div', 'fib-wrapper');

        // Construct sentence
        let sentence = '';
        if (this.currentWord.example) {
            // Replace word in example (case insensitive)
            const regex = new RegExp(this.currentWord.word, 'gi');
            sentence = this.currentWord.example.replace(regex, '_____');
        } else {
            // Fallback to definition
            sentence = `A(n) _____ is ${this.currentWord.definition}`;
        }

        const sentenceEl = createElement('div', 'fib-sentence');

        // Split by placeholder to inject input
        const parts = sentence.split('_____');
        if (parts.length > 1) {
            sentenceEl.appendChild(document.createTextNode(parts[0]));

            const input = createElement('input', 'fib-input');
            input.type = 'text';
            input.placeholder = '?';
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.checkAnswer();
            });
            sentenceEl.appendChild(input);

            sentenceEl.appendChild(document.createTextNode(parts[1]));
        } else {
            sentenceEl.textContent = sentence; // Fallback if replace failed
        }

        wrapper.appendChild(sentenceEl);

        const btn = createElement('button', 'btn primary-btn', 'Check Answer');
        btn.addEventListener('click', () => this.checkAnswer());
        wrapper.appendChild(btn);

        // Hint button and app-styled modal
        const hintBtn = createElement('button', 'btn text-btn', 'Show Hint');
        hintBtn.type = 'button';
        wrapper.appendChild(hintBtn);

        const hints = this.getHints();
        let activeHintIndex = 0;

        const hintModal = createElement('div', 'modal hidden fib-hint-modal');
        hintModal.setAttribute('aria-describedby', 'fib-hint-text');

        const hintContent = createElement('div', 'modal-content fib-hint-modal-content');
        const hintHeader = createElement('div', 'modal-header fib-hint-header');
        const hintHeadingGroup = createElement('div', 'fib-hint-heading-group');
        const hintIcon = createElement('span', 'fib-hint-icon');
        hintIcon.innerHTML = '<i data-lucide="lightbulb" aria-hidden="true"></i>';
        const hintTitle = createElement('h2', '', 'Here’s a hint');
        hintHeadingGroup.append(hintIcon, hintTitle);

        const closeButton = createElement('button', 'close-modal fib-hint-close');
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', 'Close hint');
        closeButton.innerHTML = '<i data-lucide="circle-x" aria-hidden="true"></i>';
        hintHeader.append(hintHeadingGroup, closeButton);

        const hintBody = createElement('div', 'modal-body fib-hint-body');
        hintBody.setAttribute('aria-live', 'polite');
        const hintLabel = createElement('p', 'fib-hint-label');
        const hintText = createElement('p', 'fib-hint-definition');
        hintText.id = 'fib-hint-text';
        hintBody.append(hintLabel, hintText);

        const hintFooter = createElement('div', 'modal-footer fib-hint-footer');
        const hintNavigation = createElement('div', 'fib-hint-navigation');
        const hintCounter = createElement('span', 'fib-hint-counter');
        const nextHintButton = createElement('button', 'btn text-btn fib-next-hint-btn', 'Next hint');
        nextHintButton.type = 'button';
        hintNavigation.append(hintCounter, nextHintButton);
        const gotItButton = createElement('button', 'btn primary-btn', 'Got it');
        gotItButton.type = 'button';
        hintFooter.append(hintNavigation, gotItButton);

        const showHintAtIndex = (index) => {
            activeHintIndex = index;
            const hint = hints[activeHintIndex] || { label: 'Hint', text: 'Think about the sentence and the vocabulary you studied.' };
            hintLabel.textContent = hint.label;
            hintText.textContent = hint.text;
            hintCounter.textContent = `Hint ${activeHintIndex + 1} of ${Math.max(1, hints.length)}`;
            nextHintButton.textContent = activeHintIndex === hints.length - 1 ? 'Start over' : 'Next hint';
            nextHintButton.hidden = hints.length <= 1;
        };
        showHintAtIndex(0);

        hintContent.append(hintHeader, hintBody, hintFooter);
        hintModal.appendChild(hintContent);
        wrapper.appendChild(hintModal);

        hintBtn.addEventListener('click', () => {
            openModal(hintModal, { initialFocus: gotItButton });
        });
        nextHintButton.addEventListener('click', () => {
            showHintAtIndex((activeHintIndex + 1) % hints.length);
        });
        closeButton.addEventListener('click', () => closeModal(hintModal));
        gotItButton.addEventListener('click', () => closeModal(hintModal));

        this.container.appendChild(wrapper);
        window.lucide?.createIcons({ root: wrapper });

        // Focus input
        this.timeouts.schedule(() => {
            const inp = this.container.querySelector('.fib-input');
            if (inp) inp.focus();
        }, 100);
    }

    destroy() {
        this.timeouts.clear();
        this.onProgress = null;
        this.onSaveState = null;
    }
}
