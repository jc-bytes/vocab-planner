import { $, createElement, escapeHtml } from '../main.js';
import { getSubjectBySlug, getVocabSubjectSlug, preloadVocabularyFile } from '../services/vocabularyApi.js';
import {
    studentApi as supabaseService,
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    where
} from '../services/studentApi.js';
import { MONTH_INDEX } from './studentActivityConstants.js';

const SPARK_COLLECTION = 'weeklySparks';
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

class StudentActivityHomeMethods {
    getUnitProgressSummary(vocab) {
        const unitProgress = this.sm.progressData?.units?.[this.getUnitProgressKey(vocab)]
            || this.sm.progressData?.units?.[vocab.name]
            || {};
        const scores = unitProgress.scores || {};
        const flow = this.getActivityFlowConfig(vocab);
        const completedRequired = flow.required.filter(activityType => {
            const scoreData = scores[activityType];
            return Boolean(scoreData?.isComplete) || (Number(scoreData?.score) || 0) >= 100;
        }).length;
        const latestPlayed = Object.values(scores).reduce((latest, scoreData) => {
            const timestamp = scoreData?.lastPlayed || scoreData?.updatedAt || '';
            const time = timestamp ? new Date(timestamp).getTime() : 0;
            return Number.isFinite(time) ? Math.max(latest, time) : latest;
        }, 0);
        const bestScore = Object.values(scores).reduce((best, scoreData) => {
            return Math.max(best, Number(scoreData?.score) || 0);
        }, 0);

        return {
            scores,
            completedRequired,
            requiredTotal: flow.required.length,
            isComplete: flow.required.length > 0 && completedRequired >= flow.required.length,
            latestPlayed,
            bestScore
        };
    }

    async renderStudentHome() {
        const container = $('#student-home-dashboard');
        if (!container) return;
        this.sm.logStudentDomUpdate?.('student-home-dashboard', { source: 'renderStudentHome:clear' });

        this.renderSubjectPicker('#student-subject-picker');
        container.innerHTML = '';

        const { vocabs, message } = this.getVisibleVocabularyList({
            availableOnly: true,
            currentTrimesterOnly: true
        });

        const today = new Date();
        const currentMonth = today.getMonth();
        const currentWeek = Math.floor((today.getDate() - 1) / 7) + 1;
        const decoratedVocabs = vocabs.map(vocab => {
            const schedule = this.getVocabSchedule(vocab, today);
            return {
                kind: 'vocabulary',
                id: `vocab:${vocab.path || vocab.name || ''}`,
                vocab,
                schedule,
                progress: this.getUnitProgressSummary(vocab),
                sortTime: schedule.dueDate?.getTime?.() || 0
            };
        }).sort((a, b) => {
            const aTime = a.schedule.dueDate?.getTime() || 0;
            const bTime = b.schedule.dueDate?.getTime() || 0;
            if (aTime !== bTime) return aTime - bTime;
            return String(a.vocab.name || '').localeCompare(String(b.vocab.name || ''));
        });

        const vocabularyThisWeekItems = decoratedVocabs
            .filter(item => {
                if (this.isVocabScheduleInCurrentWeek(item.schedule, today)) return true;
                const monthIndex = MONTH_INDEX[item.schedule.month];
                return monthIndex === currentMonth && item.schedule.week === currentWeek;
            })
            .slice(0, 3);

        const vocabularyPendingItems = decoratedVocabs
            .filter(item => {
                if (item.progress.isComplete) return false;
                if (item.schedule.dueDate) return item.schedule.dueDate <= today;
                if (!item.schedule.month || !item.schedule.week) return true;
                const monthIndex = MONTH_INDEX[item.schedule.month];
                return monthIndex < currentMonth || (monthIndex === currentMonth && item.schedule.week <= currentWeek);
            })
            .slice(-3)
            .reverse();

        const pendingItems = vocabularyPendingItems
            .sort((a, b) => b.sortTime - a.sortTime)
            .slice(0, 4);

        const weekItems = vocabularyThisWeekItems
            .sort((a, b) => a.sortTime - b.sortTime)
            .slice(0, 4);

        const continueItem = pendingItems[0] || weekItems[0] || decoratedVocabs[0] || null;

        const panels = [
            {
                key: 'spark',
                title: 'Spark',
                subtitle: 'Question of the week'
            },
            {
                key: 'week',
                title: 'This Week',
                subtitle: 'Current vocabulary units',
                items: weekItems,
                emptyText: 'No work is scheduled this week.'
            }
        ];

        container.replaceChildren();
        container.appendChild(this.createContinueLearningHero(continueItem, message));

        const tabList = createElement('div', 'student-home-tabs secondary-tabs');
        tabList.setAttribute('role', 'tablist');
        tabList.setAttribute('aria-label', 'Dashboard sections');
        panels.forEach((panel, index) => {
            const tab = createElement(
                'button',
                `student-home-tab secondary-tab${index === 0 ? ' active secondary-tab--active' : ''}`
            );
            tab.type = 'button';
            tab.id = `student-home-tab-${panel.key}`;
            tab.dataset.panel = panel.key;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
            tab.setAttribute('aria-controls', `student-home-panel-${panel.key}`);
            tab.tabIndex = index === 0 ? 0 : -1;
            tab.innerHTML = `<span>${panel.title}</span>`;
            tabList.appendChild(tab);
        });
        container.appendChild(tabList);

        panels.forEach((panel, index) => {
            const homePanel = panel.key === 'spark'
                ? this.createSparkHomePanel(panel.title, panel.subtitle, index === 0)
                : this.createHomePanel(panel.key, panel.title, panel.subtitle, panel.items, panel.emptyText, index === 0);
            container.appendChild(homePanel);
        });
        this.bindHomePanelTabs(container);
        this.loadAndRenderCurrentSpark(container.querySelector('.student-spark-host'));
        this.scheduleFirstVocabularyPreload(container);

        if (window.lucide) {
            window.lucide.createIcons({ root: container });
        }
    }

    createContinueLearningHero(item, emptyText = '') {
        const hero = createElement(item?.vocab ? 'button' : 'section', 'student-continue-hero');
        if (item?.vocab) hero.type = 'button';

        if (!item?.vocab) {
            hero.innerHTML = `
                <div class="student-continue-copy">
                    <h3>All caught up for now.</h3>
                    <p>${escapeHtml(emptyText || 'No current vocabulary work is available yet.')}</p>
                </div>
            `;
            return hero;
        }

        const { vocab, schedule, progress } = item;
        const subject = getSubjectBySlug(this.sm.subjects, getVocabSubjectSlug(vocab));
        const title = this.formatVocabularyCardTitle?.(vocab) || vocab.name || 'Vocabulary Unit';
        const purposeLabel = this.formatVocabularyPurpose?.(vocab.purpose) || 'Unit';
        const purposeClass = this.getVocabularyPurposeClass?.(vocab.purpose) || 'is-unit';
        const percent = this.getContinueLearningPercent(progress);
        const progressText = progress.requiredTotal > 0
            ? `${progress.completedRequired}/${progress.requiredTotal} required complete`
            : `${progress.bestScore}% best score`;
        const scheduleText = schedule.label || this.getTrimesterLabel(this.getVocabTrimesterKey(vocab));

        hero.style.setProperty('--subject-color', subject.color);
        hero.innerHTML = `
            <div class="student-continue-copy">
                <span class="student-hero-purpose ${escapeHtml(purposeClass)}">${escapeHtml(purposeLabel)}</span>
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(subject.name)} · ${escapeHtml(scheduleText)}</p>
                <div class="student-continue-progress" aria-label="${escapeHtml(progressText)}">
                    <div class="student-continue-progress-top">
                        <span>Unit progress</span>
                        <strong>${percent}% complete</strong>
                    </div>
                    <div class="student-continue-track" aria-hidden="true">
                        <span style="width:${percent}%"></span>
                    </div>
                </div>
            </div>
            <span class="student-continue-action">
                <span>Continue</span>
                <i data-lucide="play"></i>
            </span>
        `;

        if (vocab.path) {
            hero.dataset.vocabPath = vocab.path;
            const preload = () => preloadVocabularyFile(vocab.path);
            hero.addEventListener('pointerenter', preload, { once: true });
            hero.addEventListener('focus', preload, { once: true });
        }
        hero.addEventListener('click', () => this.loadVocabulary(vocab));
        return hero;
    }

    getContinueLearningPercent(progress = {}) {
        if (progress.requiredTotal > 0) {
            return Math.min(100, Math.round((progress.completedRequired / progress.requiredTotal) * 100));
        }
        return Math.min(100, Math.max(0, Math.round(Number(progress.bestScore) || 0)));
    }

    isVocabScheduleInCurrentWeek(schedule = {}, date = new Date()) {
        if (!(schedule.dueDate instanceof Date) || Number.isNaN(schedule.dueDate.getTime())) return false;
        const bounds = this.getHomeCurrentWeekBounds(date);
        const scheduleTime = schedule.dueDate.getTime();
        return scheduleTime >= bounds.start && scheduleTime <= bounds.end;
    }

    getHomeCurrentWeekBounds(date = new Date()) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const daysSinceMonday = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - daysSinceMonday);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start: start.getTime(), end: end.getTime() };
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
        if (this.sm.currentSparkSessionCache?.has(cacheKey)) {
            return this.sm.currentSparkSessionCache.get(cacheKey);
        }
        const db = supabaseService.getDatabase();
        const snapshot = await getDocs(query(
            collection(db, SPARK_COLLECTION),
            where('subjectSlug', '==', subjectSlug),
            where('status', '==', 'scheduled'),
            where('scheduledDate', '<=', dateValue),
            orderBy('scheduledDate', 'desc'),
            orderBy('updatedAt', 'desc'),
            limit(40)
        ));
        const sparks = snapshot.docs.map(docSnap => this.normalizeSpark({ id: docSnap.id, ...docSnap.data() }));
        let currentSpark = null;
        if (grade) {
            const gradeMatch = sparks.find(spark => spark.targetGrades.includes(grade));
            if (gradeMatch) currentSpark = gradeMatch;
        }
        currentSpark = currentSpark || sparks.find(isAllGradeSpark) || null;
        this.sm.currentSparkSessionCache?.set(cacheKey, currentSpark);
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

    bindHomePanelTabs(container) {
        const tabs = Array.from(container.querySelectorAll('.student-home-tab'));
        const panels = Array.from(container.querySelectorAll('.student-home-panel'));
        const activate = (key, focus = false) => {
            tabs.forEach(tab => {
                const active = tab.dataset.panel === key;
                tab.classList.toggle('active', active);
                tab.classList.toggle('secondary-tab--active', active);
                tab.setAttribute('aria-selected', active ? 'true' : 'false');
                tab.tabIndex = active ? 0 : -1;
                if (active && focus) tab.focus({ preventScroll: true });
            });
            panels.forEach(panel => {
                const active = panel.dataset.panel === key;
                panel.classList.toggle('active', active);
            });
        };

        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => activate(tab.dataset.panel));
            tab.addEventListener('keydown', event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                let nextIndex = index;
                if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
                if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
                if (event.key === 'Home') nextIndex = 0;
                if (event.key === 'End') nextIndex = tabs.length - 1;
                event.preventDefault();
                activate(tabs[nextIndex].dataset.panel, true);
            });
        });
    }

    createHomePanel(key, title, subtitle, items, emptyText, active = false) {
        const panel = createElement('section', `student-home-panel${active ? ' active' : ''}`);
        panel.id = `student-home-panel-${key}`;
        panel.dataset.panel = key;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', `student-home-tab-${key}`);
        panel.innerHTML = `
            <div class="teacher-panel-header">
                <div>
                    <h3>${title}</h3>
                    <p>${subtitle}</p>
                </div>
            </div>
        `;

        const list = createElement('div', 'student-home-list');
        if (items.length === 0) {
            list.innerHTML = `<p class="teacher-empty-state">${emptyText}</p>`;
        } else {
            items.forEach(item => list.appendChild(this.createHomeWorkCard(item)));
        }
        panel.appendChild(list);
        return panel;
    }

    createHomeWorkCard(item) {
        return this.createHomeUnitCard(item);
    }

    createHomeUnitCard(item) {
        const { vocab, schedule, progress } = item;
        const subject = getSubjectBySlug(this.sm.subjects, getVocabSubjectSlug(vocab));
        const card = createElement('button', 'student-home-unit');
        card.type = 'button';
        if (vocab.path) card.dataset.vocabPath = vocab.path;

        const progressText = progress.requiredTotal > 0
            ? `${progress.completedRequired}/${progress.requiredTotal} required`
            : `${progress.bestScore}% best`;

        card.innerHTML = `
            <div class="student-home-unit-icon"><i data-lucide="book-open"></i></div>
            <div class="student-home-unit-copy">
                <strong>${escapeHtml(vocab.name || 'Vocabulary Unit')}</strong>
                <span>Vocabulary · ${escapeHtml(subject.name)} · ${escapeHtml(schedule.label || this.getTrimesterLabel(this.getVocabTrimesterKey(vocab)))}</span>
            </div>
            <div class="student-home-unit-status">
                <span>${progressText}</span>
                <i data-lucide="chevron-right"></i>
            </div>
        `;
        if (vocab.path) {
            const preload = () => preloadVocabularyFile(vocab.path);
            card.addEventListener('pointerenter', preload, { once: true });
            card.addEventListener('focus', preload, { once: true });
        }
        card.addEventListener('click', () => this.loadVocabulary(vocab));
        return card;
    }

}

export function installStudentActivityHomeMethods(StudentActivities) {
    for (const name of Object.getOwnPropertyNames(StudentActivityHomeMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentActivityHomeMethods.prototype, name)
        );
    }
}
