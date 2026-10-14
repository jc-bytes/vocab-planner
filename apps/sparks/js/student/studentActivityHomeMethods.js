import { $, createElement, escapeHtml, refreshIcons } from '../main.js';
import { getSubjectBySlug, getVocabSubjectSlug, preloadVocabularyFile } from '../services/vocabularyApi.js';
import { MONTH_INDEX } from './studentActivityConstants.js';
import { StudentActivityHomeSpark } from './studentActivityHomeSpark.js';
import { getKeyboardNavigatedTab } from '../ui/tabNavigation.js';
import { studentSchoolScope } from './studentSchoolSession.js';

export class StudentActivityHome {
    constructor(activities) {
        this.activities = activities;
        this.sm = activities.sm;
        this.spark = new StudentActivityHomeSpark(this);
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
        const request = this.homeRenderRequest = (this.homeRenderRequest || 0) + 1;
        const owner = this.sm.currentUser?.uid || this.sm.currentUser?.id;
        let key;
        const current = () => request === this.homeRenderRequest && owner === (this.sm.currentUser?.uid || this.sm.currentUser?.id)
            && (this.sm.authDisabled || !key || key === studentSchoolScope(this.sm).key);
        if (!this.sm.authDisabled) {
            try {
                const { loadAssignedVocabulary } = await import('./studentAssignedVocabulary.js');
                await loadAssignedVocabulary(this.activities);
                key = this.activities.assignedVocabulary?.key;
            } catch (error) {
                if (!current() || error.name === 'AbortError') return;
                const host = $('#student-home-dashboard');
                if (host) host.textContent = error.message || 'Your assigned vocabulary could not load. Open Units to try again.';
                return;
            }
        }
        const { renderStudentHomeContent } = await import('./studentHomeRenderer.js');
        if (current()) return renderStudentHomeContent.call(this, { isCurrent: current });
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
        const scheduleText = schedule.label || this.activities.schedule.getTrimesterLabel(
            this.activities.schedule.getVocabTrimesterKey(vocab)
        );

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
        hero.addEventListener('click', () => this.activities.vocabularyData.loadVocabulary(vocab));
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
        const activityLabel = access.vocabularyRemainingActivities === 1 ? 'activity' : 'activities';
        const unitLabel = access.unitCount === 1 ? 'unit' : 'units';
        const parts = [];
        if (access.spark) parts.push("today's Spark check");
        if (access.vocabularyRemainingActivities > 0) {
            parts.push(`${access.vocabularyRemainingActivities} required ${activityLabel} in ${access.unitCount} ${unitLabel}`);
        }
        const message = createElement(
            'span',
            null,
            `Complete ${parts.join(' and ')} to unlock Arcade.`
        );
        copy.append(title, message);
        notice.appendChild(copy);

        if (access.spark) {
            const continueButton = createElement('button', 'btn secondary-btn', 'Complete Spark check');
            continueButton.type = 'button';
            continueButton.addEventListener('click', () => this.sm.navigateTo({ view: 'sparks' }));
            notice.appendChild(continueButton);
        } else if (access.next?.vocab) {
            const continueButton = createElement('button', 'btn secondary-btn', 'Continue required work');
            continueButton.type = 'button';
            continueButton.addEventListener('click', () => (
                this.activities.vocabularyData.loadVocabulary(access.next.vocab)
            ));
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

    getCurrentSparkGateWork() {
        return this.spark.getCurrentSparkGateWork();
    }

    refreshCurrentSparkGate(options = {}) {
        return this.spark.refreshCurrentSparkGate(options);
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

        tabs.forEach(tab => {
            tab.addEventListener('click', () => activate(tab.dataset.panel));
            tab.addEventListener('keydown', event => {
                const nextTab = getKeyboardNavigatedTab(tabs, tab, event.key);
                if (!nextTab) return;
                event.preventDefault();
                activate(nextTab.dataset.panel, true);
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
                <span>Vocabulary · ${escapeHtml(subject.name)} · ${escapeHtml(
                    schedule.label || this.activities.schedule.getTrimesterLabel(
                        this.activities.schedule.getVocabTrimesterKey(vocab)
                    )
                )}</span>
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
        card.addEventListener('click', () => this.activities.vocabularyData.loadVocabulary(vocab));
        return card;
    }

}
