import { $, createElement, escapeHtml } from '../main.js';
import { getSubjectBySlug, getVocabSubjectSlug, preloadVocabularyFile } from '../services/vocabularyApi.js';
import { MONTH_INDEX } from './studentActivityConstants.js';
import { StudentActivityHomeSpark } from './studentActivityHomeSpark.js';

export class StudentActivityHome {
    constructor(activities) {
        this.activities = activities;
        this.sm = activities.sm;
        this.spark = new StudentActivityHomeSpark(this);
    }

    get currentSparkSessionCache() {
        return this.spark.currentSparkSessionCache;
    }

    getUnitProgressKey(...args) {
        return this.activities.getUnitProgressKey(...args);
    }

    getActivityFlowConfig(...args) {
        return this.activities.getActivityFlowConfig(...args);
    }

    renderSubjectPicker(...args) {
        return this.activities.renderSubjectPicker(...args);
    }

    getVisibleVocabularyList(...args) {
        return this.activities.getVisibleVocabularyList(...args);
    }

    getVocabSchedule(...args) {
        return this.activities.getVocabSchedule(...args);
    }

    getVocabTrimesterKey(...args) {
        return this.activities.getVocabTrimesterKey(...args);
    }

    getTrimesterLabel(...args) {
        return this.activities.getTrimesterLabel(...args);
    }

    formatVocabularyCardTitle(...args) {
        return this.activities.formatVocabularyCardTitle(...args);
    }

    formatVocabularyPurpose(...args) {
        return this.activities.formatVocabularyPurpose(...args);
    }

    getVocabularyPurposeClass(...args) {
        return this.activities.getVocabularyPurposeClass(...args);
    }

    loadVocabulary(...args) {
        return this.activities.loadVocabulary(...args);
    }

    scheduleFirstVocabularyPreload(...args) {
        return this.activities.scheduleFirstVocabularyPreload(...args);
    }

    getUnitProgressSummary(vocab) {
        const completion = this.activities.getUnitRequiredCompletion(vocab);
        const { scores } = completion;
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
            completedRequired: completion.completed,
            requiredTotal: completion.total,
            isComplete: completion.isComplete,
            nextActivityType: completion.nextActivityType,
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

        const weekItems = vocabularyThisWeekItems
            .sort((a, b) => a.sortTime - b.sortTime)
            .slice(0, 4);

        const arcadeAccess = this.activities.getPendingRequiredWork(today);
        const recommendation = this.getHomeRecommendation({
            decoratedVocabs,
            weekItems,
            requiredWork: arcadeAccess,
            today
        });
        const dashboardHeading = $('#student-home-heading');
        if (dashboardHeading) {
            dashboardHeading.textContent = recommendation.heading;
            dashboardHeading.closest('.student-dashboard-heading')?.removeAttribute('hidden');
        }
        const mainMenuView = $('#main-menu-view');
        mainMenuView?.classList.remove('student-home-loading');
        mainMenuView?.setAttribute('aria-busy', 'false');

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
        container.appendChild(this.createContinueLearningHero(recommendation.item, message, recommendation));
        if (arcadeAccess.isBlocked) {
            container.appendChild(this.createArcadeGateNotice(arcadeAccess));
        }

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

    getHomeRecommendation({ decoratedVocabs = [], weekItems = [], requiredWork = {}, today = new Date() } = {}) {
        const getIdentity = vocab => String(vocab?.path || vocab?.id || vocab?.name || '');
        const decoratedByIdentity = new Map(
            decoratedVocabs.map(item => [getIdentity(item.vocab), item])
        );
        const requiredItems = (requiredWork.units || [])
            .map(required => decoratedByIdentity.get(getIdentity(required.vocab)))
            .filter(Boolean);
        const oldestRequired = requiredItems.find(item => this.isHomeScheduleBeforeCurrentWeek(item.schedule, today));

        if (oldestRequired) {
            return {
                item: oldestRequired,
                mode: 'required',
                heading: 'Your oldest required work',
                badge: 'Catch up',
                action: 'Continue required work'
            };
        }

        const unfinished = decoratedVocabs
            .filter(item => !item.progress.isComplete && (
                item.progress.latestPlayed > 0
                || item.progress.completedRequired > 0
                || item.progress.bestScore > 0
            ))
            .sort((a, b) => {
                if (a.progress.latestPlayed !== b.progress.latestPlayed) {
                    return b.progress.latestPlayed - a.progress.latestPlayed;
                }
                return a.sortTime - b.sortTime;
            })[0];

        if (unfinished) {
            return {
                item: unfinished,
                mode: 'unfinished',
                heading: 'Continue learning',
                badge: 'In progress',
                action: 'Continue'
            };
        }

        if (weekItems[0]) {
            return {
                item: weekItems[0],
                mode: 'current',
                heading: 'Start this week\u2019s work',
                badge: 'This week',
                action: 'Start unit'
            };
        }

        const nextRequired = requiredItems[0] || decoratedVocabs.find(item => !item.progress.isComplete) || null;
        if (nextRequired) {
            return {
                item: nextRequired,
                mode: 'required',
                heading: 'Your next required work',
                badge: 'Required',
                action: 'Start required work'
            };
        }

        return {
            item: null,
            mode: 'complete',
            heading: 'You\u2019re all caught up',
            badge: '',
            action: ''
        };
    }

    createContinueLearningHero(item, emptyText = '', context = {}) {
        const hero = createElement(item?.vocab ? 'button' : 'section', 'student-continue-hero');
        if (item?.vocab) hero.type = 'button';
        hero.dataset.recommendation = context.mode || (item?.vocab ? 'available' : 'complete');

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
        const purposeLabel = context.badge || this.formatVocabularyPurpose?.(vocab.purpose) || 'Unit';
        const purposeClass = this.getVocabularyPurposeClass?.(vocab.purpose) || 'is-unit';
        const recommendationClass = context.mode ? `is-${context.mode}` : '';
        const actionLabel = context.action || 'Continue';
        const percent = this.getContinueLearningPercent(progress);
        const progressText = progress.requiredTotal > 0
            ? `${progress.completedRequired}/${progress.requiredTotal} required complete`
            : `${progress.bestScore}% best score`;
        const scheduleText = schedule.label || this.getTrimesterLabel(this.getVocabTrimesterKey(vocab));

        hero.style.setProperty('--subject-color', subject.color);
        hero.innerHTML = `
            <div class="student-continue-copy">
                <span class="student-hero-purpose ${escapeHtml(purposeClass)} ${escapeHtml(recommendationClass)}">${escapeHtml(purposeLabel)}</span>
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
                <span>${escapeHtml(actionLabel)}</span>
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

    renderSparkLibrary() {
        return this.spark.renderSparkLibrary();
    }

    createArcadeGateNotice(access) {
        const notice = createElement('aside', 'student-arcade-gate-notice');
        notice.setAttribute('aria-label', 'Arcade unlock progress');
        const copy = createElement('div', 'student-arcade-gate-copy');
        const title = createElement('strong', null, 'Arcade unlock progress');
        const activityLabel = access.remainingActivities === 1 ? 'activity' : 'activities';
        const unitLabel = access.unitCount === 1 ? 'unit' : 'units';
        const message = createElement(
            'span',
            null,
            `${access.remainingActivities} required ${activityLabel} remaining in ${access.unitCount} ${unitLabel}.`
        );
        copy.append(title, message);
        notice.appendChild(copy);

        if (access.next?.vocab) {
            const continueButton = createElement('button', 'btn secondary-btn', 'Continue required work');
            continueButton.type = 'button';
            continueButton.addEventListener('click', () => this.loadVocabulary(access.next.vocab));
            notice.appendChild(continueButton);
        }

        return notice;
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

    isHomeScheduleBeforeCurrentWeek(schedule = {}, date = new Date()) {
        if (schedule.dueDate instanceof Date && !Number.isNaN(schedule.dueDate.getTime())) {
            return schedule.dueDate.getTime() < this.getHomeCurrentWeekBounds(date).start;
        }
        if (!schedule.month || !schedule.week) return false;
        const currentMonth = date.getMonth();
        const currentWeek = Math.floor((date.getDate() - 1) / 7) + 1;
        const monthIndex = MONTH_INDEX[schedule.month];
        return monthIndex < currentMonth || (monthIndex === currentMonth && schedule.week < currentWeek);
    }

    normalizeSpark(spark = {}) {
        return this.spark.normalizeSpark(spark);
    }

    getStudentGradeLevel() {
        return this.spark.getStudentGradeLevel();
    }

    fetchCurrentSpark() {
        return this.spark.fetchCurrentSpark();
    }

    loadAndRenderCurrentSpark(host) {
        return this.spark.loadAndRenderCurrentSpark(host);
    }

    getStudentSparkQuestion(spark) {
        return this.spark.getStudentSparkQuestion(spark);
    }

    createStudentSparkCard(spark) {
        return this.spark.createStudentSparkCard(spark);
    }

    removeSparkHomePanel(host) {
        return this.spark.removeSparkHomePanel(host);
    }

    createSparkHomePanel(title, subtitle, active = false) {
        return this.spark.createSparkHomePanel(title, subtitle, active);
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
