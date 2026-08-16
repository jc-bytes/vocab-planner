import { $, createElement, escapeHtml } from '../main.js';
import { sparksRepository } from '../services/sparksRepository.js';
import { normalizeSchoolCalendar } from '../services/vocabularyApi.js';
import {
    evaluateSparkAnswers,
    getSparkQuestionsForGrade,
    normalizeSparkCheckMode,
    normalizeSparkQuestions,
    SPARK_CHECK_MODES
} from '../sparkCheckModel.js';
import { getStudentPageSkeleton, setStudentPageLoading } from './studentLoadingSkeletons.js';

const SPARK_TYPE_LABELS = {
    cool_fact: 'Cool Fact',
    trivia: 'Trivia',
    good_news: 'Good News',
    reflection: 'Reflection',
    debate: 'Debate'
};
const SPARK_GRADE_LEVELS = ['6', '7', '8', '9'];

function getPanamaDateValue(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Panama',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const valueByType = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${valueByType.year}-${valueByType.month}-${valueByType.day}`;
}

function normalizeSparkGradeQuestions(value) {
    const source = value && typeof value === 'object' ? value : {};
    return SPARK_GRADE_LEVELS.reduce((questions, grade) => {
        const text = String(source[grade] ?? source[`grade${grade}`] ?? '').trim();
        if (text) questions[grade] = text;
        return questions;
    }, {});
}

function normalizeSparkTargetGrades(value) {
    const source = Array.isArray(value) ? value : String(value || '').split(',');
    const grades = source
        .flatMap(item => String(item || '').split(','))
        .map(item => item.trim().match(/\d+/)?.[0] || '')
        .filter(grade => SPARK_GRADE_LEVELS.includes(grade));
    return Array.from(new Set(grades));
}

function isAllGradeSpark(spark) {
    const targetGrades = normalizeSparkTargetGrades(spark?.targetGrades ?? spark?.target_grades);
    return SPARK_GRADE_LEVELS.every(grade => targetGrades.includes(grade));
}

export class StudentActivityHomeSpark {
    constructor(home) {
        this.home = home;
        this.activities = home.activities;
        this.sm = home.sm;
        this.currentSparkSessionCache = new Map();
        this.currentSpark = null;
    }

    normalizeSpark(spark = {}) {
        const source = spark && typeof spark === 'object' ? spark : {};
        const sparkType = SPARK_TYPE_LABELS[source.sparkType || source.spark_type]
            ? (source.sparkType || source.spark_type)
            : 'cool_fact';
        return {
            id: String(source.id || ''),
            sparkType,
            title: String(source.title || '').trim(),
            sparkText: String(source.sparkText ?? source.spark_text ?? '').trim(),
            whyItMatters: String(source.whyItMatters ?? source.why_it_matters ?? '').trim(),
            question: String(source.question || '').trim(),
            gradeQuestions: normalizeSparkGradeQuestions(source.gradeQuestions ?? source.grade_questions),
            checkMode: normalizeSparkCheckMode(source.checkMode ?? source.check_mode),
            questions: normalizeSparkQuestions(source.questions),
            targetGrades: normalizeSparkTargetGrades(source.targetGrades ?? source.target_grades ?? SPARK_GRADE_LEVELS),
            sourceTitle: String(source.sourceTitle ?? source.source_title ?? '').trim(),
            sourceUrl: String(source.sourceUrl ?? source.source_url ?? '').trim(),
            subjectSlug: String(source.subjectSlug ?? source.subject_slug ?? 'technology').trim() || 'technology',
            scheduledDate: String(source.scheduledDate ?? source.scheduled_date ?? '').trim()
        };
    }

    getStudentGradeLevel() {
        return String(this.sm.studentProfile?.grade || '').match(/\d+/)?.[0] || '';
    }

    getCurrentSparkDateRange(dateValue = getPanamaDateValue()) {
        const date = new Date(`${dateValue}T12:00:00`);
        const trimester = this.activities.getCurrentTrimesterKey(date);
        const calendar = normalizeSchoolCalendar(this.activities.schoolCalendar, date);
        const range = calendar.trimesters?.[trimester] || {};
        return {
            trimester,
            onOrAfter: String(range.startDate || ''),
            onOrBefore: dateValue
        };
    }

    async fetchCurrentSpark() {
        if (this.sm.authDisabled || !this.sm.currentUser) return null;
        const subjectSlug = this.sm.selectedSubjectSlug || 'technology';
        const dateValue = getPanamaDateValue();
        const dateRange = this.getCurrentSparkDateRange(dateValue);
        const grade = this.getStudentGradeLevel();
        const cacheKey = `${subjectSlug}:${grade || 'all'}:${dateRange.trimester}:${dateRange.onOrAfter}:${dateRange.onOrBefore}`;
        if (this.currentSparkSessionCache.has(cacheKey)) {
            this.currentSpark = this.currentSparkSessionCache.get(cacheKey);
            return this.currentSpark;
        }
        const sparks = (await sparksRepository.listScheduledForStudent({
            subjectSlug,
            onOrAfter: dateRange.onOrAfter,
            onOrBefore: dateRange.onOrBefore,
            targetGrade: grade,
            limit: 1
        })).map(spark => this.normalizeSpark(spark));
        let currentSpark = null;
        if (grade) {
            const gradeMatch = sparks.find(spark => spark.targetGrades.includes(grade));
            if (gradeMatch) currentSpark = gradeMatch;
        }
        currentSpark = currentSpark || sparks.find(isAllGradeSpark) || null;
        this.currentSpark = currentSpark;
        this.currentSparkSessionCache.set(cacheKey, currentSpark);
        return currentSpark;
    }

    async fetchAvailableSparks() {
        if (this.sm.authDisabled || !this.sm.currentUser) return [];
        const subjectSlug = this.sm.selectedSubjectSlug || 'technology';
        const dateValue = getPanamaDateValue();
        const dateRange = this.getCurrentSparkDateRange(dateValue);
        const grade = this.getStudentGradeLevel();
        const cacheKey = `library:${subjectSlug}:${grade || 'all'}:${dateRange.trimester}:${dateRange.onOrAfter}:${dateRange.onOrBefore}`;
        if (this.currentSparkSessionCache.has(cacheKey)) {
            return this.currentSparkSessionCache.get(cacheKey);
        }
        const sparks = (await sparksRepository.listScheduledForStudent({
            subjectSlug,
            onOrAfter: dateRange.onOrAfter,
            onOrBefore: dateRange.onOrBefore,
            targetGrade: grade,
            limit: 20
        })).map(spark => this.normalizeSpark(spark));
        const available = grade
            ? sparks.filter(spark => spark.targetGrades.includes(grade) || isAllGradeSpark(spark))
            : sparks.filter(isAllGradeSpark);
        this.currentSparkSessionCache.set(cacheKey, available);
        return available;
    }

    getSparkLibraryStorageKey() {
        const studentId = String(this.sm.currentUser?.id || this.sm.currentUser?.email || 'student');
        const subjectSlug = String(this.sm.selectedSubjectSlug || 'technology');
        return `student_spark_library_v1:${studentId}:${subjectSlug}`;
    }

    loadSparkLibraryProgress() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.getSparkLibraryStorageKey()) || '{}');
            return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
        } catch {
            return {};
        }
    }

    saveSparkLibraryState(state = {}) {
        if (!state.sparkId) return;
        const progress = this.loadSparkLibraryProgress();
        progress[state.sparkId] = {
            version: Number(state.version) || 2,
            sparkId: String(state.sparkId),
            answers: state.answers && typeof state.answers === 'object' ? { ...state.answers } : {},
            completedAt: String(state.completedAt || '')
        };
        localStorage.setItem(this.getSparkLibraryStorageKey(), JSON.stringify(progress));
        this.activities.updateArcadeGateDisplay();
    }

    getCurrentSparkGateWork() {
        const spark = this.currentSpark;
        if (!spark?.id || spark.checkMode !== SPARK_CHECK_MODES.REQUIRED) return null;
        const state = this.loadSparkLibraryProgress()[spark.id] || null;
        const questions = getSparkQuestionsForGrade(spark, this.getStudentGradeLevel());
        if (questions.length === 0) return null;
        const answers = Number(state?.version) === 1 && state?.response && questions[0]
            ? { [questions[0].id]: state.response }
            : (state?.answers || {});
        const evaluation = evaluateSparkAnswers(questions, answers);
        if (evaluation.isComplete) return null;
        return {
            spark,
            routeId: spark.id,
            remaining: Math.max(1, evaluation.total - evaluation.correct),
            total: evaluation.total
        };
    }

    async refreshCurrentSparkGate({ updateDisplay = true } = {}) {
        await this.fetchCurrentSpark();
        const work = this.getCurrentSparkGateWork();
        if (updateDisplay) this.activities.updateArcadeGateDisplay();
        return work;
    }

    async renderSparkLibrary() {
        const container = $('#student-sparks-library');
        if (!container) return;
        const view = $('#student-sparks-view');
        setStudentPageLoading(view, true);
        this.activities.renderSubjectPicker('#spark-subject-picker');
        container.innerHTML = getStudentPageSkeleton('sparks', 'Loading Sparks');
        try {
            const sparks = await this.fetchAvailableSparks();
            if (sparks.length === 0) {
                container.innerHTML = '<p class="teacher-empty-state">No Sparks are available for this class yet.</p>';
                return;
            }
            this.currentSpark = sparks[0];
            const progress = this.loadSparkLibraryProgress();
            const dateRange = this.getCurrentSparkDateRange();
            const { SparkReadingActivity } = await import('../activities/sparkReading.js');
            new SparkReadingActivity(
                container,
                {
                    subjectSlug: this.sm.selectedSubjectSlug || 'technology',
                    grade: this.getStudentGradeLevel(),
                    scheduledDate: dateRange.onOrBefore,
                    onOrAfter: dateRange.onOrAfter,
                    loadSparks: async () => sparks,
                    getSparkState: sparkId => progress[sparkId] || null
                },
                null,
                state => this.saveSparkLibraryState(state),
                progress[sparks[0].id] || null
            );
        } catch (error) {
            console.error('Failed to render Spark library', error);
            container.innerHTML = '<p class="teacher-empty-state">Could not load Sparks. Please try again.</p>';
        } finally {
            setStudentPageLoading(view, false);
        }
    }

    async loadAndRenderCurrentSpark(host) {
        if (!host) return;
        try {
            this.sm.logStudentDomUpdate?.('student-spark-host', { source: 'loadAndRenderCurrentSpark:fetch' });
            const spark = await this.fetchCurrentSpark();
            if (!spark?.id) {
                this.removeSparkHomePanel(host);
                return;
            }
            this.sm.logStudentDomUpdate?.('student-spark-host', { source: 'loadAndRenderCurrentSpark:replaceChildren' });
            host.replaceChildren(this.createStudentSparkCard(spark));
            this.activities.updateArcadeGateDisplay();
            if (window.lucide) window.lucide.createIcons({ root: host });
        } catch {
            this.removeSparkHomePanel(host);
        }
    }

    getStudentSparkQuestion(spark) {
        return getSparkQuestionsForGrade(spark, this.getStudentGradeLevel())[0]?.prompt || '';
    }

    createStudentSparkCard(spark) {
        const card = createElement('section', 'student-spark-card');
        card.setAttribute('aria-label', 'Spark of the Week');
        const question = this.getStudentSparkQuestion(spark);
        const sourceHtml = spark.sourceUrl
            ? `<a href="${escapeHtml(spark.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(spark.sourceTitle || 'Source')}</a>`
            : '';
        card.innerHTML = `
            <div class="student-spark-heading">
                <span class="student-spark-badge"><i data-lucide="sparkles"></i> Spark of the Week</span>
                <span>${escapeHtml(SPARK_TYPE_LABELS[spark.sparkType] || 'Spark')}</span>
            </div>
            <h3>${escapeHtml(spark.title || 'Technology Spark')}</h3>
            <p>${escapeHtml(spark.sparkText)}</p>
            ${spark.whyItMatters ? `
                <div class="student-spark-detail">
                    <strong>Why it matters</strong>
                    <span>${escapeHtml(spark.whyItMatters)}</span>
                </div>
            ` : ''}
            ${question ? `
                <div class="student-spark-question">
                    <i data-lucide="message-circle-question"></i>
                    <span>${escapeHtml(spark.questions.length > 1 ? `${spark.questions.length} Check Your Understanding questions` : question)}</span>
                </div>
            ` : ''}
            ${sourceHtml ? `<div class="student-spark-source">${sourceHtml}</div>` : ''}
        `;
        return card;
    }

    removeSparkHomePanel(host) {
        this.sm.logStudentDomUpdate?.('student-home-dashboard', { source: 'removeSparkHomePanel' });
        const panel = host?.closest('.student-home-panel');
        const tab = $('#student-home-tab-spark');
        panel?.remove();
        tab?.remove();
        const firstTab = $('.student-home-tab');
        if (firstTab) {
            firstTab.classList.add('active', 'secondary-tab--active');
            firstTab.setAttribute('aria-selected', 'true');
            firstTab.tabIndex = 0;
            const firstPanel = $(`#${firstTab.getAttribute('aria-controls')}`);
            firstPanel?.classList.add('active');
        }
    }

    createSparkHomePanel(title, subtitle, active = false) {
        const panel = createElement('section', `student-home-panel student-home-spark-panel${active ? ' active' : ''}`);
        panel.id = 'student-home-panel-spark';
        panel.dataset.panel = 'spark';
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', 'student-home-tab-spark');
        panel.innerHTML = `
            <div class="teacher-panel-header">
                <div>
                    <h3>${title}</h3>
                    <p>${subtitle}</p>
                </div>
            </div>
            <div class="student-spark-host">
                <p class="teacher-empty-state">Loading Spark...</p>
            </div>
        `;
        const openButton = createElement('button', 'student-home-spark-open');
        openButton.type = 'button';
        openButton.setAttribute('aria-label', 'Open Sparks');
        openButton.addEventListener('click', () => this.sm.navigateTo({ view: 'sparks' }));
        panel.appendChild(openButton);
        return panel;
    }
}
