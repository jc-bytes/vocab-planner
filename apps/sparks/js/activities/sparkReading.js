import { closeModal, createElement, escapeHtml, openModal } from '../main.js';
import { sparksRepository } from '../services/sparksRepository.js';
import {
    evaluateSparkAnswers,
    getSparkQuestionsForGrade,
    normalizeSparkCheckMode,
    normalizeSparkQuestions,
    SPARK_CHECK_MODES,
    SPARK_QUESTION_TYPES,
    SPARK_RESPONSE_MIN_LENGTH
} from '../sparkCheckModel.js';

const SPARK_STATE_VERSION = 2;
const TYPE_LABELS = {
    cool_fact: 'Cool Fact',
    trivia: 'Trivia',
    good_news: 'Good News',
    reflection: 'Reflection',
    debate: 'Debate'
};

function normalizeGrade(value) {
    return String(value || '').match(/\d+/)?.[0] || '';
}

function normalizeGrades(value) {
    const source = Array.isArray(value) ? value : String(value || '').split(',');
    return [...new Set(source.map(normalizeGrade).filter(Boolean))];
}

function normalizeSpark(spark = {}) {
    return {
        id: String(spark.id || ''),
        sparkType: String(spark.sparkType || spark.spark_type || 'cool_fact'),
        title: String(spark.title || '').trim(),
        sparkText: String(spark.sparkText ?? spark.spark_text ?? '').trim(),
        whyItMatters: String(spark.whyItMatters ?? spark.why_it_matters ?? '').trim(),
        question: String(spark.question || '').trim(),
        gradeQuestions: spark.gradeQuestions && typeof spark.gradeQuestions === 'object'
            ? spark.gradeQuestions
            : (spark.grade_questions && typeof spark.grade_questions === 'object' ? spark.grade_questions : {}),
        checkMode: normalizeSparkCheckMode(spark.checkMode ?? spark.check_mode),
        questions: normalizeSparkQuestions(spark.questions),
        targetGrades: normalizeGrades(spark.targetGrades ?? spark.target_grades),
        sourceTitle: String(spark.sourceTitle ?? spark.source_title ?? '').trim(),
        sourceUrl: String(spark.sourceUrl ?? spark.source_url ?? '').trim(),
        scheduledDate: String(spark.scheduledDate ?? spark.scheduled_date ?? '').trim()
    };
}

export class SparkReadingActivity {
    constructor(container, context = {}, onProgress, onSaveState, initialState) {
        this.container = container;
        this.context = context;
        this.onProgress = onProgress;
        this.onSaveState = onSaveState;
        this.initialState = initialState;
        this.spark = null;
        this.sparks = [];
        this.activeSparkIndex = 0;
        this.sparkStates = new Map();
        this.answers = {};
        this.completedAt = '';
        this.feedback = '';
        this.renderLoading();
        this.init();
    }

    async init() {
        try {
            const sparks = await this.loadEligibleSparks();
            this.sparks = sparks.length > 0 ? sparks : [this.createFallbackSpark()];
        } catch (error) {
            console.error('Failed to load Spark reading', error);
            this.sparks = [this.createFallbackSpark()];
        }
        this.spark = this.sparks[0];
        if (this.initialState?.sparkId) this.sparkStates.set(this.initialState.sparkId, this.initialState);
        this.restoreState(this.initialState);
        this.render();
        this.reportProgress();
    }

    renderLoading() {
        this.container.innerHTML = '<div class="loading-spinner">Loading Spark...</div>';
    }

    async loadEligibleSparks() {
        const onOrBefore = this.context.scheduledDate || new Date().toISOString().slice(0, 10);
        const grade = normalizeGrade(this.context.grade);
        const rows = this.context.loadSparks
            ? await this.context.loadSparks({ onOrBefore })
            : await sparksRepository.listScheduledForStudent({
                subjectSlug: this.context.subjectSlug || 'technology',
                onOrAfter: this.context.onOrAfter || '',
                onOrBefore,
                targetGrade: grade,
                limit: 20
            });
        return (rows || [])
            .map(normalizeSpark)
            .filter(spark => !grade || spark.targetGrades.length === 0 || spark.targetGrades.includes(grade));
    }

    createFallbackSpark() {
        return normalizeSpark({
            id: 'technology-spark-fallback',
            sparkType: 'reflection',
            title: 'Technology Spark',
            sparkText: 'Technology becomes more useful when we pause to notice how it changes the way people solve problems.',
            whyItMatters: 'Careful observation helps us make thoughtful choices about the tools we use.',
            question: 'What is one technology tool you would like to understand better, and why?',
            targetGrades: [normalizeGrade(this.context.grade)].filter(Boolean),
            scheduledDate: this.context.scheduledDate || ''
        });
    }

    getQuestions(spark = this.spark) {
        return getSparkQuestionsForGrade(spark, normalizeGrade(this.context.grade));
    }

    restoreState(state = this.initialState) {
        if (!state || state.sparkId !== this.spark?.id) return;
        if (Number(state.version) === 1) {
            const firstQuestion = this.getQuestions()[0];
            this.answers = firstQuestion && state.response
                ? { [firstQuestion.id]: String(state.response).trim().slice(0, 240) }
                : {};
        } else if (Number(state.version) === SPARK_STATE_VERSION) {
            this.answers = state.answers && typeof state.answers === 'object' ? { ...state.answers } : {};
        }
        this.completedAt = String(state.completedAt || '');
    }

    showSparkAt(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.sparks.length || index === this.activeSparkIndex) return;
        this.activeSparkIndex = index;
        this.spark = this.sparks[index];
        this.answers = {};
        this.completedAt = '';
        this.feedback = '';
        const savedState = this.sparkStates.get(this.spark.id)
            || this.context.getSparkState?.(this.spark.id)
            || null;
        if (savedState) {
            this.sparkStates.set(this.spark.id, savedState);
            this.restoreState(savedState);
        }
        this.render();
    }

    persistCurrentState() {
        const state = this.getState();
        this.sparkStates.set(state.sparkId, state);
        this.onSaveState?.(state);
    }

    getState() {
        return {
            version: SPARK_STATE_VERSION,
            sparkId: this.spark?.id || '',
            answers: { ...this.answers },
            completedAt: this.completedAt
        };
    }

    getScore() {
        const mode = normalizeSparkCheckMode(this.spark?.checkMode);
        const questions = this.getQuestions();
        const result = evaluateSparkAnswers(questions, this.answers);
        const isComplete = mode === SPARK_CHECK_MODES.READING_ONLY || result.isComplete;
        return {
            score: isComplete ? 100 : 0,
            isComplete,
            details: mode === SPARK_CHECK_MODES.READING_ONLY
                ? 'Reading-only Spark.'
                : `${result.correct} of ${result.total} check questions complete.`
        };
    }

    reportProgress() {
        this.onProgress?.(this.getScore());
    }

    saveAnswers(answers = {}) {
        this.answers = { ...this.answers, ...answers };
        const result = evaluateSparkAnswers(this.getQuestions(), this.answers);
        if (!result.isComplete) {
            const incorrect = result.results.find(item => item.answered && !item.correct);
            this.feedback = incorrect
                ? 'Not quite yet. Review the reading and try the highlighted question again.'
                : `Answer every question. Short responses need at least ${SPARK_RESPONSE_MIN_LENGTH} characters.`;
            this.persistCurrentState();
            return false;
        }
        this.completedAt = this.completedAt || new Date().toISOString();
        this.feedback = 'Check complete! Your responses were saved.';
        this.persistCurrentState();
        this.reportProgress();
        return true;
    }

    createQuestionFieldsHtml(questions) {
        const evaluation = evaluateSparkAnswers(questions, this.answers);
        return questions.map((question, index) => {
            const result = evaluation.results[index];
            const invalidClass = this.feedback && result && !result.correct ? ' is-invalid' : '';
            if (question.type === SPARK_QUESTION_TYPES.MULTIPLE_CHOICE) {
                const selected = Number(this.answers[question.id]);
                return `
                    <fieldset class="spark-check-question${invalidClass}" data-question-id="${escapeHtml(question.id)}">
                        <legend><span>${index + 1}</span>${escapeHtml(question.prompt)}</legend>
                        <div class="spark-check-options">
                            ${question.options.map((option, optionIndex) => `
                                <label class="spark-check-option">
                                    <input type="radio" name="spark-answer-${escapeHtml(question.id)}" value="${optionIndex}"${selected === optionIndex ? ' checked' : ''}>
                                    <span>${escapeHtml(option)}</span>
                                </label>
                            `).join('')}
                        </div>
                    </fieldset>
                `;
            }
            return `
                <div class="spark-check-question${invalidClass}" data-question-id="${escapeHtml(question.id)}">
                    <label for="spark-answer-${escapeHtml(question.id)}"><span>${index + 1}</span>${escapeHtml(question.prompt)}</label>
                    <textarea id="spark-answer-${escapeHtml(question.id)}" rows="3" minlength="${SPARK_RESPONSE_MIN_LENGTH}" maxlength="240" placeholder="Write one complete thought…">${escapeHtml(String(this.answers[question.id] || ''))}</textarea>
                </div>
            `;
        }).join('');
    }

    readAnswersFromForm(form, questions) {
        return questions.reduce((answers, question) => {
            const group = form.querySelector(`[data-question-id="${question.id}"]`);
            if (question.type === SPARK_QUESTION_TYPES.MULTIPLE_CHOICE) {
                const selected = group?.querySelector('input[type="radio"]:checked');
                answers[question.id] = selected ? Number(selected.value) : '';
            } else {
                answers[question.id] = String(group?.querySelector('textarea')?.value || '').trim().slice(0, 240);
            }
            return answers;
        }, {});
    }

    render() {
        this.container.innerHTML = '';
        const activity = createElement('div', 'spark-reading-activity');
        const sourceHtml = this.spark.sourceUrl
            ? `<a href="${escapeHtml(this.spark.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(this.spark.sourceTitle || 'Source')}</a>`
            : '';
        const mode = normalizeSparkCheckMode(this.spark.checkMode);
        const questions = this.getQuestions();
        const evaluation = evaluateSparkAnswers(questions, this.answers);
        const modeLabel = mode === SPARK_CHECK_MODES.REQUIRED ? 'Required check' : 'Optional check';
        const questionLabel = `${questions.length} ${questions.length === 1 ? 'question' : 'questions'}`;
        activity.innerHTML = `
            <div class="spark-reading-layout">
                ${this.sparks.length > 1 ? `
                    <nav class="spark-reader-navigation" aria-label="Browse Sparks">
                        <button class="btn text-btn spark-reader-nav-btn" type="button" data-spark-direction="older"${this.activeSparkIndex === this.sparks.length - 1 ? ' disabled' : ''}>
                            <i data-lucide="arrow-left" aria-hidden="true"></i>
                            Older Spark
                        </button>
                        <span class="spark-reader-position">
                            <strong>${this.activeSparkIndex + 1}</strong> of ${this.sparks.length}
                        </span>
                        <button class="btn text-btn spark-reader-nav-btn" type="button" data-spark-direction="newer"${this.activeSparkIndex === 0 ? ' disabled' : ''}>
                            Newer Spark
                            <i data-lucide="arrow-right" aria-hidden="true"></i>
                        </button>
                    </nav>
                ` : ''}
                <article class="spark-reading-copy">
                    <div class="spark-reading-kicker">
                        <span><i data-lucide="sparkles"></i> ${escapeHtml(TYPE_LABELS[this.spark.sparkType] || 'Spark')}</span>
                        ${this.spark.scheduledDate ? `<time>${escapeHtml(this.spark.scheduledDate)}</time>` : ''}
                    </div>
                    <h3>${escapeHtml(this.spark.title || 'Technology Spark')}</h3>
                    <p class="spark-reading-text">${escapeHtml(this.spark.sparkText)}</p>
                    ${this.spark.whyItMatters ? `
                        <aside class="spark-reading-why">
                            <strong>Why it matters</strong>
                            <span>${escapeHtml(this.spark.whyItMatters)}</span>
                        </aside>
                    ` : ''}
                    ${sourceHtml ? `<p class="spark-reading-source">Learn more: ${sourceHtml}</p>` : ''}
                    ${mode === SPARK_CHECK_MODES.READING_ONLY ? `
                        <div class="spark-reading-confirmed"><i data-lucide="book-open-check"></i> Reading only · no response required</div>
                    ` : `
                        <button class="btn primary-btn spark-check-open-btn" type="button">
                            <i data-lucide="message-circle-question"></i>
                            <span>Check Your Understanding</span>
                            <small>${escapeHtml(modeLabel)} · ${escapeHtml(questionLabel)}</small>
                        </button>
                        ${evaluation.isComplete ? `
                            <div class="spark-reading-confirmed"><i data-lucide="check-circle-2"></i> Understanding check complete</div>
                        ` : ''}
                    `}
                </article>
            </div>
            ${mode === SPARK_CHECK_MODES.READING_ONLY ? '' : `
                <div class="modal hidden spark-check-modal" role="dialog" aria-modal="true" aria-labelledby="spark-check-modal-title">
                    <form class="modal-content spark-check-modal-content spark-response-form spark-check-form" novalidate>
                        <div class="modal-header spark-check-modal-header">
                            <div>
                                <span class="spark-response-step">${escapeHtml(modeLabel)} · ${escapeHtml(questionLabel)}</span>
                                <h2 id="spark-check-modal-title">Check Your Understanding</h2>
                            </div>
                            <button class="close-modal spark-check-modal-close" type="button" aria-label="Close understanding check">
                                <i data-lucide="x" aria-hidden="true"></i>
                            </button>
                        </div>
                        <div class="modal-body spark-check-modal-body">
                            <p class="spark-check-modal-intro">Use the Spark you just read to help you answer.</p>
                            ${this.createQuestionFieldsHtml(questions)}
                            <p class="spark-response-feedback" role="status" aria-live="polite">${escapeHtml(this.feedback || (evaluation.isComplete ? 'Check complete. You may update your answers.' : 'Answer each question, then submit your check.'))}</p>
                        </div>
                        <div class="modal-footer spark-check-modal-footer">
                            <button class="btn secondary-btn spark-check-modal-cancel" type="button">Cancel</button>
                            <button class="btn primary-btn" type="submit">${evaluation.isComplete ? 'Update answers' : 'Submit check'}</button>
                        </div>
                    </form>
                </div>
            `}
        `;

        const modal = activity.querySelector('.spark-check-modal');
        activity.querySelector('.spark-check-open-btn')?.addEventListener('click', () => {
            openModal(modal, { initialFocus: modal?.querySelector('textarea, input') });
        });
        activity.querySelector('.spark-check-modal-close')?.addEventListener('click', () => closeModal(modal));
        activity.querySelector('.spark-check-modal-cancel')?.addEventListener('click', () => closeModal(modal));
        activity.querySelectorAll('[data-spark-direction]').forEach(button => {
            button.addEventListener('click', () => {
                const offset = button.dataset.sparkDirection === 'newer' ? -1 : 1;
                this.showSparkAt(this.activeSparkIndex + offset);
            });
        });
        activity.querySelector('.spark-response-form')?.addEventListener('submit', event => {
            event.preventDefault();
            const answers = this.readAnswersFromForm(event.currentTarget, questions);
            const completed = this.saveAnswers(answers);
            this.render();
            if (!completed) {
                const nextModal = this.container.querySelector('.spark-check-modal');
                const invalidField = nextModal?.querySelector('.spark-check-question.is-invalid textarea, .spark-check-question.is-invalid input');
                openModal(nextModal, { initialFocus: invalidField });
            }
        });

        this.container.appendChild(activity);
        if (window.lucide) window.lucide.createIcons({ root: activity });
    }
}
