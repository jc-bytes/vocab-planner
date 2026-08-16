import { createElement, escapeHtml } from '../main.js';
import { sparksRepository } from '../services/sparksRepository.js';

const RESPONSE_MIN_LENGTH = 12;
const SPARK_STATE_VERSION = 1;
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
        this.pastSparks = [];
        this.hasRead = false;
        this.response = '';
        this.completedAt = '';
        this.feedback = '';
        this.renderLoading();
        this.init();
    }

    async init() {
        try {
            const sparks = await this.loadEligibleSparks();
            this.spark = sparks[0] || this.createFallbackSpark();
            this.pastSparks = sparks.slice(1);
        } catch (error) {
            console.error('Failed to load Spark reading', error);
            this.spark = this.createFallbackSpark();
            this.pastSparks = [];
        }
        this.restoreState();
        this.render();
        this.reportProgress();
    }

    renderLoading() {
        this.container.innerHTML = '<div class="loading-spinner">Loading Spark...</div>';
    }

    async loadEligibleSparks() {
        const onOrBefore = this.context.scheduledDate || new Date().toISOString().slice(0, 10);
        const rows = this.context.loadSparks
            ? await this.context.loadSparks({ onOrBefore })
            : await sparksRepository.listScheduledForStudent({
                subjectSlug: this.context.subjectSlug || 'technology',
                onOrBefore,
                limit: 40
            });
        const grade = normalizeGrade(this.context.grade);
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

    getQuestion(spark = this.spark) {
        const grade = normalizeGrade(this.context.grade);
        return String(spark?.gradeQuestions?.[grade] || spark?.question || 'What useful idea did you learn from this Spark?').trim();
    }

    restoreState() {
        const state = this.initialState;
        if (!state || Number(state.version) !== SPARK_STATE_VERSION || state.sparkId !== this.spark?.id) return;
        this.hasRead = Boolean(state.hasRead);
        this.response = String(state.response || '').trim().slice(0, 240);
        this.completedAt = String(state.completedAt || '');
    }

    getState() {
        return {
            version: SPARK_STATE_VERSION,
            sparkId: this.spark?.id || '',
            hasRead: this.hasRead,
            response: this.response,
            completedAt: this.completedAt
        };
    }

    getScore() {
        const isComplete = this.response.length >= RESPONSE_MIN_LENGTH;
        return {
            score: isComplete ? 100 : 0,
            isComplete,
            details: isComplete ? `Spark response: ${this.response}` : (this.hasRead ? 'Reading complete; response pending.' : 'Reading pending.')
        };
    }

    reportProgress() {
        this.onProgress?.(this.getScore());
    }

    markRead() {
        this.hasRead = true;
        this.feedback = '';
        this.onSaveState?.(this.getState());
        this.render();
        this.container.querySelector('textarea')?.focus();
    }

    saveResponse(value) {
        if (!this.hasRead) {
            this.feedback = 'Finish the reading before answering.';
            return false;
        }
        const response = String(value || '').trim();
        if (response.length < RESPONSE_MIN_LENGTH) {
            this.feedback = `Please write at least ${RESPONSE_MIN_LENGTH} characters.`;
            return false;
        }
        this.response = response.slice(0, 240);
        this.completedAt = this.completedAt || new Date().toISOString();
        this.feedback = 'Response saved. Spark complete!';
        this.onSaveState?.(this.getState());
        this.reportProgress();
        return true;
    }

    render() {
        this.container.innerHTML = '';
        const activity = createElement('div', 'spark-reading-activity');
        const sourceHtml = this.spark.sourceUrl
            ? `<a href="${escapeHtml(this.spark.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(this.spark.sourceTitle || 'Source')}</a>`
            : '';
        activity.innerHTML = `
            <div class="spark-reading-layout">
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
                    ${this.hasRead ? `
                        <div class="spark-reading-confirmed"><i data-lucide="check-circle-2"></i> Reading complete</div>
                    ` : `
                        <button class="btn secondary-btn spark-reading-confirm-btn" type="button">
                            <i data-lucide="book-open-check"></i> I finished reading
                        </button>
                    `}
                </article>
                <section class="spark-response-panel${this.hasRead ? '' : ' is-locked'}" aria-label="Required short response">
                    <span class="spark-response-step">Required response</span>
                    ${this.hasRead ? `
                        <h3>${escapeHtml(this.getQuestion())}</h3>
                        <form class="spark-response-form">
                            <label for="spark-response-input">Your answer</label>
                            <textarea id="spark-response-input" rows="5" minlength="${RESPONSE_MIN_LENGTH}" maxlength="240" required placeholder="Write one complete thought…"></textarea>
                            <p class="spark-response-feedback" role="status" aria-live="polite">${escapeHtml(this.feedback || (this.response ? 'Response saved.' : `At least ${RESPONSE_MIN_LENGTH} characters.`))}</p>
                            <button class="btn primary-btn" type="submit">${this.response ? 'Update response' : 'Complete Spark'}</button>
                        </form>
                    ` : `
                        <div class="spark-response-lock">
                            <i data-lucide="lock-keyhole"></i>
                            <h3>Read first</h3>
                            <p>The short question unlocks after you finish the reading.</p>
                        </div>
                    `}
                </section>
            </div>
        `;

        const textarea = activity.querySelector('textarea');
        if (textarea) textarea.value = this.response;
        activity.querySelector('.spark-reading-confirm-btn')?.addEventListener('click', () => this.markRead());
        activity.querySelector('.spark-response-form')?.addEventListener('submit', event => {
            event.preventDefault();
            if (this.saveResponse(textarea?.value)) this.render();
            else {
                const feedback = activity.querySelector('.spark-response-feedback');
                if (feedback) feedback.textContent = this.feedback;
                textarea?.focus();
            }
        });

        if (this.pastSparks.length > 0) activity.appendChild(this.createHistory());
        this.container.appendChild(activity);
        if (window.lucide) window.lucide.createIcons({ root: activity });
    }

    createHistory() {
        const history = createElement('details', 'spark-reading-history');
        history.innerHTML = `
            <summary><span><i data-lucide="history"></i> Review earlier Sparks</span><small>${this.pastSparks.length}</small></summary>
            <div class="spark-reading-history-list"></div>
        `;
        const list = history.querySelector('.spark-reading-history-list');
        this.pastSparks.slice(0, 12).forEach(spark => {
            const savedState = this.context.getSparkState?.(spark.id);
            const savedResponse = String(savedState?.response || '').trim();
            const item = createElement('details', 'spark-reading-history-item');
            item.innerHTML = `
                <summary>
                    <span>${escapeHtml(spark.title || 'Technology Spark')}</span>
                    <small>${savedResponse ? 'Completed · ' : ''}${escapeHtml(spark.scheduledDate)}</small>
                </summary>
                <div>
                    <p>${escapeHtml(spark.sparkText)}</p>
                    ${spark.whyItMatters ? `<p><strong>Why it matters:</strong> ${escapeHtml(spark.whyItMatters)}</p>` : ''}
                    ${savedResponse ? `
                        <blockquote class="spark-reading-saved-response">
                            <strong>Your response</strong>
                            <span>${escapeHtml(savedResponse)}</span>
                        </blockquote>
                    ` : ''}
                </div>
            `;
            list?.appendChild(item);
        });
        return history;
    }
}
