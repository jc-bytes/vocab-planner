import { createElement, $ } from '../main.js';
import { ActivityTimeoutController } from './activityTimeoutController.js';

const MASTERY_ACCURACY = 80;

export class SynonymAntonymActivity {
    constructor(container, words, onProgress, onSaveState = null, initialState = null) {
        this.container = container;
        this.words = words;
        this.onProgress = onProgress;
        this.onSaveState = onSaveState;
        this.initialState = initialState;
        this.currentIndex = 0;
        this.score = 0;
        this.answeredCount = 0;
        this.questions = this.generateQuestions();
        this.totalQuestions = this.questions.length;
        this.selectedAnswers = [];
        this.isFinished = false;
        this.timeouts = new ActivityTimeoutController();

        this.restoreState();
        this.saveState();
        this.render();
    }

    getStorageKey() {
        return `synonym_antonym_state_${this.words[0]?.word || 'empty'}_${this.words.length}`;
    }

    generateQuestions() {
        const questions = [];

        this.words.forEach(word => {
            if (word.synonyms?.length > 0) {
                const correct = this.getCorrectAnswer(word, 'synonyms');
                const distractors = this.getDistractors(word, 'synonyms');

                if (correct && distractors.length >= 3) {
                    questions.push({
                        type: 'Synonym',
                        word: word.word,
                        correctAnswer: correct,
                        options: this.shuffle([correct, ...distractors])
                    });
                }
            }

            if (word.antonyms?.length > 0) {
                const correct = this.getCorrectAnswer(word, 'antonyms');
                const distractors = this.getDistractors(word, 'antonyms');

                if (correct && distractors.length >= 3) {
                    questions.push({
                        type: 'Antonym',
                        word: word.word,
                        correctAnswer: correct,
                        options: this.shuffle([correct, ...distractors])
                    });
                }
            }
        });

        return this.shuffle(questions);
    }

    normalizeAnswer(value) {
        return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    getAnswerList(word, type) {
        const seen = new Set();
        return (word[type] || [])
            .map(answer => String(answer || '').trim())
            .filter(answer => {
                const normalized = this.normalizeAnswer(answer);
                if (!normalized || seen.has(normalized)) return false;
                seen.add(normalized);
                return true;
            });
    }

    getCorrectAnswer(word, type) {
        const answers = this.getAnswerList(word, type);
        return this.shuffle([...answers])[0] || null;
    }

    getDistractors(targetWord, type) {
        const distractors = [];
        const targetAnswers = new Set(this.getAnswerList(targetWord, type).map(answer => this.normalizeAnswer(answer)));
        const used = new Set(targetAnswers);
        const otherWords = this.shuffle(this.words.filter(w => w !== targetWord));

        for (const w of otherWords) {
            for (const answer of this.getAnswerList(w, type)) {
                const normalized = this.normalizeAnswer(answer);
                if (used.has(normalized)) continue;
                distractors.push(answer);
                used.add(normalized);
                break;
            }
            if (distractors.length === 3) break;
        }

        return distractors;
    }

    shuffle(array) {
        return array.sort(() => Math.random() - 0.5);
    }

    restoreState() {
        if (this.applySavedState(this.initialState)) return;

        const saved = localStorage.getItem(this.getStorageKey());
        if (!saved) return;

        try {
            this.applySavedState(JSON.parse(saved));
        } catch (error) {
            console.error('Error restoring synonym activity state:', error);
        }
    }

    applySavedState(state) {
        if (!state || state.mode !== 'synonym-antonym-v1' || state.wordsLength !== this.words.length) {
            return false;
        }
        if (!this.hasMatchingWordKeys(state.wordKeys)) return false;

        if (Array.isArray(state.questions) && state.questions.length === this.totalQuestions) {
            this.questions = state.questions;
        }

        this.currentIndex = Math.min(
            Math.max(0, Number(state.currentIndex) || 0),
            Math.max(0, this.totalQuestions - 1)
        );
        this.score = Math.max(0, Number(state.score) || 0);
        this.answeredCount = Math.max(0, Number(state.answeredCount) || 0);
        this.selectedAnswers = Array.isArray(state.selectedAnswers) ? state.selectedAnswers : [];
        this.isFinished = Boolean(state.isFinished);
        return true;
    }

    hasMatchingWordKeys(wordKeys) {
        if (!Array.isArray(wordKeys) || wordKeys.length === 0) return true;
        if (wordKeys.length !== this.words.length) return false;
        return wordKeys.every((wordKey, index) => wordKey === this.words[index]?.word);
    }

    saveState() {
        const state = {
            mode: 'synonym-antonym-v1',
            wordsLength: this.words.length,
            wordKeys: this.words.map(word => word.word),
            questions: this.questions,
            currentIndex: this.currentIndex,
            selectedAnswers: this.selectedAnswers,
            score: this.score,
            answeredCount: this.answeredCount,
            isFinished: this.isFinished,
            updatedAt: new Date().toISOString()
        };

        localStorage.setItem(this.getStorageKey(), JSON.stringify(state));
        if (typeof this.onSaveState === 'function') {
            this.onSaveState(state);
        }
    }

    getScore() {
        if (this.totalQuestions === 0) return { score: 0, details: 'No questions available' };

        const accuracy = this.answeredCount === 0 ? 0 : Math.round((this.score / this.answeredCount) * 100);
        const answeredAll = this.answeredCount === this.totalQuestions;
        return {
            score: accuracy,
            details: `Answered: ${this.answeredCount}/${this.totalQuestions}. Correct: ${this.score}/${this.answeredCount || 0} (${accuracy}% accuracy)`,
            accuracy,
            evidence: {
                answeredCount: this.answeredCount,
                correctCount: this.score,
                totalCount: this.totalQuestions,
                accuracy
            },
            isComplete: answeredAll && accuracy >= MASTERY_ACCURACY
        };
    }

    render() {
        this.container.innerHTML = '';

        if (this.questions.length === 0) {
            this.container.innerHTML = '<p style="text-align:center; padding:2rem;">Not enough data for this activity. Need more words with synonyms/antonyms.</p>';
            return;
        }

        if (this.isFinished) {
            this.renderSummary();
            return;
        }

        const question = this.questions[this.currentIndex];

        const quizContainer = createElement('div', 'quiz-container');
        quizContainer.style.maxWidth = '600px';
        quizContainer.style.margin = '0 auto';
        quizContainer.style.textAlign = 'center';

        // Progress
        const progress = createElement('div', 'quiz-progress');
        progress.textContent = `Question ${this.currentIndex + 1} of ${this.totalQuestions}`;
        progress.style.marginBottom = '1rem';
        progress.style.color = 'var(--text-muted)';
        quizContainer.appendChild(progress);

        // Question Card
        const card = createElement('div', 'card');
        card.style.padding = '2rem';
        card.style.marginBottom = '2rem';

        const typeLabel = createElement('span', 'pos-tag');
        typeLabel.textContent = question.type;
        typeLabel.style.background = question.type === 'Synonym' ? 'var(--primary-color)' : 'var(--accent-color)';
        typeLabel.style.color = 'white';
        typeLabel.style.marginBottom = '1rem';
        card.appendChild(typeLabel);

        const questionText = createElement('h2');
        questionText.textContent = `What is a ${question.type.toLowerCase()} for "${question.word}"?`;
        questionText.style.marginTop = '1rem';
        questionText.style.marginBottom = '1.5rem';
        card.appendChild(questionText);

        // Options
        const optionsGrid = createElement('div', 'options-grid');
        optionsGrid.style.display = 'grid';
        optionsGrid.style.gap = '1rem';

        question.options.forEach(option => {
            const btn = createElement('button', 'btn secondary-btn option-btn');
            btn.textContent = option;
            btn.style.whiteSpace = 'normal';
            btn.style.height = 'auto';
            btn.style.padding = '1rem';
            btn.style.textAlign = 'left';

            btn.addEventListener('click', () => this.handleAnswer(btn, option, question.correctAnswer));
            optionsGrid.appendChild(btn);
        });

        card.appendChild(optionsGrid);
        quizContainer.appendChild(card);
        this.container.appendChild(quizContainer);
    }

    handleAnswer(btn, selected, correct) {
        const buttons = this.container.querySelectorAll('.option-btn');
        buttons.forEach(b => b.disabled = true);

        const currentQuestionIndex = this.currentIndex;
        const isCorrect = selected === correct;

        if (isCorrect) {
            btn.classList.add('correct');
            btn.style.backgroundColor = '#10b981';
            btn.style.color = 'white';
            this.score++;
        } else {
            btn.classList.add('wrong');
            btn.style.backgroundColor = '#ef4444';
            btn.style.color = 'white';

            buttons.forEach(b => {
                if (b.textContent === correct) {
                    b.style.backgroundColor = '#10b981';
                    b.style.color = 'white';
                }
            });
        }

        this.answeredCount++;
        this.selectedAnswers[currentQuestionIndex] = {
            selected,
            correct,
            isCorrect
        };

        if (this.onProgress) {
            this.onProgress(this.getScore());
        }

        if (this.currentIndex < this.totalQuestions - 1) {
            this.currentIndex++;
        } else {
            this.isFinished = true;
        }
        this.saveState();

        this.timeouts.schedule(() => {
            this.render();
        }, 1500);
    }

    renderSummary() {
        const summary = createElement('div', 'quiz-summary');
        summary.style.textAlign = 'center';

        const result = this.getScore();

        summary.innerHTML = `
            <h2 class="activity-result-heading">
                ${result.isComplete ? '<i data-lucide="badge-check" aria-hidden="true"></i>' : ''}
                <span>${result.isComplete ? 'Challenge Mastered!' : 'Keep Practicing'}</span>
            </h2>
            <div style="font-size: 4rem; font-weight: bold; color: var(--primary); margin: 2rem 0;">
                ${result.score}%
            </div>
            <p style="font-size: 1.5rem; margin-bottom: 2rem;">${result.details}</p>
            <p>${result.isComplete ? 'You reached the mastery goal.' : `Reach ${MASTERY_ACCURACY}% accuracy to complete this activity.`}</p>
            <button id="restart-quiz" class="btn primary-btn">
                <i data-lucide="rotate-ccw" aria-hidden="true"></i>
                <span>${result.isComplete ? 'Play Again' : 'Try Again'}</span>
            </button>
        `;

        this.container.appendChild(summary);
        window.lucide?.createIcons({ root: summary });

        $('#restart-quiz').addEventListener('click', () => this.restart());
    }
    
    restart() {
        // Reset game state
        this.currentIndex = 0;
        this.score = 0;
        this.answeredCount = 0;
        this.selectedAnswers = [];
        this.isFinished = false;
        
        // Regenerate questions with new shuffle
        this.questions = this.generateQuestions();
        this.totalQuestions = this.questions.length;
        this.saveState();
        
        // Notify progress system of new session
        if (this.onProgress) {
            this.onProgress({ score: 0, details: `Answered: 0/${this.totalQuestions}. Correct: 0/0 (0% accuracy)`, accuracy: 0, isComplete: false, isReplay: true });
        }
        
        this.render();
    }

    destroy() {
        this.timeouts.clear();
        this.onProgress = null;
        this.onSaveState = null;
    }
}
