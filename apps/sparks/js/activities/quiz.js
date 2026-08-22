import { createElement, $ } from '../main.js';
import { ActivityTimeoutController } from './activityTimeoutController.js';
import { hasConsistentMultipleChoiceState } from './multipleChoiceState.js';
import { readStudentActivityValue, writeStudentActivityValue } from '../student/persistence/studentStorage.js';

const MASTERY_ACCURACY = 80;

export class QuizActivity {
    constructor(container, words, onProgress, onSaveState = null, initialState = null) {
        this.container = container;
        this.words = words;
        this.onProgress = onProgress;
        this.onSaveState = onSaveState;
        this.initialState = initialState;
        this.currentIndex = 0;
        this.score = 0;
        this.answeredCount = 0;
        this.totalQuestions = words.length;
        this.questions = this.generateQuestions();
        this.selectedAnswers = [];
        this.isFinished = false;
        this.timeouts = new ActivityTimeoutController();

        this.restoreState();
        this.saveState();
        this.render();
    }

    getStorageKey() {
        return `quiz_state_${this.words[0]?.word || 'empty'}_${this.words.length}`;
    }

    generateQuestions() {
        const questions = this.words.map(word => {
            const distractors = this.getDefinitionDistractors(word, 3);
            const options = this.shuffleOptions([word.definition, ...distractors]);

            return {
                word: word.word,
                correctAnswer: word.definition,
                options
            };
        });

        return this.shuffleItems(questions);
    }

    normalizeText(value) {
        return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    getMeaningfulWords(value) {
        const stopWords = new Set([
            'a', 'an', 'the', 'of', 'to', 'in', 'on', 'for', 'with', 'by', 'and', 'or',
            'is', 'are', 'was', 'were', 'be', 'can', 'that', 'used', 'use', 'from',
            'into', 'about', 'how', 'when', 'while', 'whether', 'what', 'why', 'it',
            'one', 'each', 'as'
        ]);

        return new Set(
            String(value || '')
                .toLowerCase()
                .match(/[a-z0-9]+/g)
                ?.filter(word => word.length > 2 && !stopWords.has(word)) || []
        );
    }

    getKeywordOverlap(first, second) {
        const firstWords = this.getMeaningfulWords(first);
        const secondWords = this.getMeaningfulWords(second);
        if (firstWords.size === 0 && secondWords.size === 0) return 0;

        let shared = 0;
        firstWords.forEach(word => {
            if (secondWords.has(word)) shared++;
        });

        return shared / (firstWords.size + secondWords.size - shared || 1);
    }

    getDefinitionDistractors(targetWord, count = 3) {
        const targetDefinition = this.normalizeText(targetWord.definition);
        const seenDefinitions = new Set([targetDefinition]);
        const candidates = [];

        this.words.forEach(word => {
            if (word === targetWord) return;

            const definition = this.normalizeText(word.definition);
            if (!definition || seenDefinitions.has(definition)) return;
            seenDefinitions.add(definition);

            const lengthDifference = Math.abs(String(targetWord.definition || '').length - String(word.definition || '').length);
            const difficultyDifference = Math.abs((Number(targetWord.difficulty) || 1) - (Number(word.difficulty) || 1));
            const targetIsMultiword = String(targetWord.word || '').trim().includes(' ');
            const candidateIsMultiword = String(word.word || '').trim().includes(' ');
            const keywordOverlap = this.getKeywordOverlap(targetWord.definition, word.definition);

            candidates.push({
                definition: word.definition,
                score:
                    keywordOverlap * 30 -
                    difficultyDifference * 8 -
                    lengthDifference * 0.12 +
                    (targetIsMultiword === candidateIsMultiword ? 3 : 0)
            });
        });

        return candidates
            .sort((first, second) => second.score - first.score || Math.random() - 0.5)
            .slice(0, count)
            .map(candidate => candidate.definition);
    }

    shuffleOptions(options) {
        return this.shuffleItems(options);
    }

    shuffleItems(items) {
        const shuffled = [...items];
        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
        }
        return shuffled;
    }

    prepareReplayQuestions(previousQuestions = []) {
        let questions = this.generateQuestions();
        const previousByWord = new Map(
            (Array.isArray(previousQuestions) ? previousQuestions : [])
                .map(question => [question?.word, question])
        );

        questions = questions.map(question => {
            const previous = previousByWord.get(question.word);
            const options = Array.isArray(question.options) ? question.options : [];
            const previousOptions = Array.isArray(previous?.options) ? previous.options : [];
            const hasSameOptionOrder = options.length > 1
                && options.length === previousOptions.length
                && options.every((option, index) => option === previousOptions[index]);

            return hasSameOptionOrder
                ? { ...question, options: [...options.slice(1), options[0]] }
                : question;
        });

        const previousOrder = (Array.isArray(previousQuestions) ? previousQuestions : [])
            .map(question => question?.word);
        const hasSameQuestionOrder = questions.length > 1
            && questions.length === previousOrder.length
            && questions.every((question, index) => question.word === previousOrder[index]);

        return hasSameQuestionOrder
            ? [...questions.slice(1), questions[0]]
            : questions;
    }

    restoreState() {
        if (this.applySavedState(this.initialState)) return;

        const saved = readStudentActivityValue(this.getStorageKey());
        if (!saved) return;

        try {
            this.applySavedState(JSON.parse(saved));
        } catch (error) {
            console.error('Error restoring quiz state:', error);
        }
    }

    applySavedState(state) {
        if (!state || state.mode !== 'quiz-v1' || state.wordsLength !== this.words.length) {
            return false;
        }
        if (!this.hasMatchingWordKeys(state.wordKeys)) return false;

        if (state.isFinished) {
            this.questions = this.prepareReplayQuestions(state.questions);
            this.totalQuestions = this.questions.length;
            return true;
        }
        if (!hasConsistentMultipleChoiceState(state, this.totalQuestions)) return false;

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
            mode: 'quiz-v1',
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

        writeStudentActivityValue(this.getStorageKey(), JSON.stringify(state));
        if (typeof this.onSaveState === 'function') {
            this.onSaveState(state);
        }
    }

    getScore() {
        if (this.totalQuestions === 0) return { score: 0, details: 'No questions' };

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
            isComplete: answeredAll && accuracy >= MASTERY_ACCURACY,
            isFinished: answeredAll
        };
    }

    render() {
        this.container.innerHTML = '';

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

        const questionText = createElement('h2');
        questionText.textContent = `What is the definition of "${question.word}"?`;
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
        if (this.selectedAnswers[this.currentIndex]) return;

        // Disable all buttons
        const buttons = this.container.querySelectorAll('.option-btn');
        buttons.forEach(b => b.disabled = true);

        const currentQuestionIndex = this.currentIndex;
        const isCorrect = selected === correct;

        if (isCorrect) {
            btn.classList.add('correct'); // You might need to add CSS for this
            btn.style.backgroundColor = '#10b981'; // Green
            btn.style.color = 'white';
            this.score++;
        } else {
            btn.classList.add('wrong');
            btn.style.backgroundColor = '#ef4444'; // Red
            btn.style.color = 'white';

            // Highlight correct answer
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

        if (this.currentIndex < this.totalQuestions - 1) {
            this.currentIndex++;
        } else {
            this.isFinished = true;
        }
        this.saveState();
        if (this.onProgress) {
            this.onProgress(this.getScore());
        }

        // Wait and move to next
        this.timeouts.schedule(() => {
            this.render();
        }, 1500);
    }

    renderSummary() {
        const summary = createElement('div', 'quiz-summary');
        summary.style.textAlign = 'center';

        const result = this.getScore();
        const accuracy = result.accuracy || 0;

        summary.innerHTML = `
            <h2 class="activity-result-heading">
                ${result.isComplete ? '<i data-lucide="badge-check" aria-hidden="true"></i>' : ''}
                <span>${result.isComplete ? 'Quiz Mastered!' : 'Round Finished'}</span>
            </h2>
            <div style="font-size: 4rem; font-weight: bold; color: var(--primary); margin: 2rem 0;">
                ${accuracy}%
            </div>
            <p style="font-size: 1.5rem; margin-bottom: 2rem;">${result.details}</p>
            <p>${result.isComplete
                ? 'You reached the mastery goal and completed this activity.'
                : `You answered every question, but this activity is not complete yet. Reach ${MASTERY_ACCURACY}% accuracy to master it and earn completion XP.`}</p>
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
