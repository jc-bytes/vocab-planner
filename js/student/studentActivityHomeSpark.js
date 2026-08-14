import { $, createElement, escapeHtml } from '../main.js';
import { sparksRepository } from '../services/sparksRepository.js';

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

    async fetchCurrentSpark() {
        if (this.sm.authDisabled || !this.sm.currentUser) return null;
        const subjectSlug = this.sm.selectedSubjectSlug || 'technology';
        const dateValue = getPanamaDateValue();
        const grade = this.getStudentGradeLevel();
        const cacheKey = `${subjectSlug}:${grade || 'all'}:${dateValue}`;
        if (this.currentSparkSessionCache.has(cacheKey)) {
            return this.currentSparkSessionCache.get(cacheKey);
        }
        const sparks = (await sparksRepository.listScheduledForStudent({
            subjectSlug,
            onOrBefore: dateValue,
            limit: 40
        })).map(spark => this.normalizeSpark(spark));
        let currentSpark = null;
        if (grade) {
            const gradeMatch = sparks.find(spark => spark.targetGrades.includes(grade));
            if (gradeMatch) currentSpark = gradeMatch;
        }
        currentSpark = currentSpark || sparks.find(isAllGradeSpark) || null;
        this.currentSparkSessionCache.set(cacheKey, currentSpark);
        return currentSpark;
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
            if (window.lucide) window.lucide.createIcons({ root: host });
        } catch {
            this.removeSparkHomePanel(host);
        }
    }

    getStudentSparkQuestion(spark) {
        const grade = this.getStudentGradeLevel();
        return String(spark.gradeQuestions?.[grade] || spark.question || '').trim();
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
                    <span>${escapeHtml(question)}</span>
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
        return panel;
    }
}
