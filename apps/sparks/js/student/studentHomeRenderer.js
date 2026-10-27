import { getUnitProgressSummary, getHomeRecommendation, getContinueLearningPercent, isVocabScheduleInCurrentWeek, getHomeCurrentWeekBounds, isHomeScheduleBeforeCurrentWeek, createStudentSparkCard, removeSparkHomePanel, createSparkHomePanel } from './studentHomePresentation.js';
import { $, createElement, escapeHtml, refreshIcons } from '../main.js';
import { getSubjectBySlug, getVocabSubjectSlug, preloadVocabularyFile } from '../services/vocabularyApi.js';
import { getKeyboardNavigatedTab } from '../ui/tabNavigation.js';
import { MONTH_INDEX } from './studentActivityConstants.js';

// Dashboard rendering is loaded only when its view is requested.
export async function renderStudentHomeContent({ isCurrent, forceRefresh = false }) {
    const container = $('#student-home-dashboard');
    if (!container || !isCurrent()) return;
    this.sm.logStudentDomUpdate?.('student-home-dashboard', { source: 'renderStudentHome:clear' });

    if (!this.sm.authDisabled) {
        try { if (await this.activities.vocabularyData.prepareClassData({ isCurrent, forceRefresh }) === null) return; }
        catch (error) {
            const { showSectionLoadError } = await import('../ui/sectionRecovery.js');
            showSectionLoadError(container, { label: "today's work", error, current: isCurrent, keepContent: this.ready,
                retry: () => this.renderStudentHome({ forceRefresh: true }) });
            if (isCurrent()) { $('#main-menu-view')?.classList.remove('student-home-loading'); $('#main-menu-view')?.setAttribute('aria-busy', 'false'); }
            return;
        }
    }
    if (!isCurrent()) return;
    // Class loading may establish the initial selection; bind its data scope only after it settles.
    isCurrent = this.spark.captureCurrentSparkScope(isCurrent);
    this.activities.vocabularyData.renderSubjectPicker('#student-subject-picker');

    try {
        await this.refreshCurrentSparkGate({ updateDisplay: false, isCurrent });
    } catch (error) {
        console.warn('Could not refresh the current Spark gate', error);
    }

    if (!isCurrent()) return;
    this.ready = true;
    this.readyClass = this.activities.vocabularyData.classSelection?.selectedId;
    const { vocabs, message } = this.activities.vocabularyData.getVisibleVocabularyList({
        availableOnly: true,
        currentTrimesterOnly: true
    });

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentWeek = Math.floor((today.getDate() - 1) / 7) + 1;
    const decoratedVocabs = vocabs.map(vocab => {
        const schedule = this.activities.schedule.getVocabSchedule(vocab, today);
        return {
            kind: 'vocabulary',
            id: `vocab:${vocab.path || vocab.name || ''}`,
            vocab,
            schedule,
            progress: getUnitProgressSummary(this.activities, vocab),
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
            if (isVocabScheduleInCurrentWeek(item.schedule, today)) return true;
            const monthIndex = MONTH_INDEX[item.schedule.month];
            return monthIndex === currentMonth && item.schedule.week === currentWeek;
        })
        .slice(0, 3);

    const weekItems = vocabularyThisWeekItems
        .sort((a, b) => a.sortTime - b.sortTime)
        .slice(0, 4);

    const arcadeAccess = this.activities.getPendingRequiredWork(today);
    const recommendation = getHomeRecommendation({
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
    container.appendChild(createContinueLearningHero.call(this, recommendation.item, message, recommendation));
    if (arcadeAccess.isBlocked) {
        container.appendChild(createArcadeGateNotice.call(this, arcadeAccess));
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
            ? createSparkHomePanel(route => this.sm.navigateTo(route), panel.title, panel.subtitle, index === 0)
            : createHomePanel.call(this, panel.key, panel.title, panel.subtitle, panel.items, panel.emptyText, index === 0);
        container.appendChild(homePanel);
    });
    bindHomePanelTabs.call(this, container);
    this.loadAndRenderCurrentSpark(container.querySelector('.student-spark-host'), { isCurrent });
    this.activities.scheduleFirstVocabularyPreload(container);

    refreshIcons(container);

}

function createContinueLearningHero(item, emptyText = '', context = {}) {
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
    const percent = getContinueLearningPercent(progress);
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

function createArcadeGateNotice(access) {
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

function bindHomePanelTabs(container) {
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

function createHomePanel(key, title, subtitle, items, emptyText, active = false) {
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
        items.forEach(item => list.appendChild(createHomeUnitCard.call(this, item)));
    }
    panel.appendChild(list);
    return panel;
}

function createHomeUnitCard(item) {
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

export async function renderCurrentHomeSpark(host, { isCurrent = () => true } = {}) {
        if (!host || !isCurrent()) return;
        try {
            this.sm.logStudentDomUpdate?.('student-spark-host', { source: 'loadAndRenderCurrentSpark:fetch' });
            const spark = await this.fetchCurrentSpark({ isCurrent });
            if (!isCurrent()) return;
            if (!spark?.id) {
                removeSparkHomePanel(host, this.sm.logStudentDomUpdate?.bind(this.sm));
                return;
            }
            this.sm.logStudentDomUpdate?.('student-spark-host', { source: 'loadAndRenderCurrentSpark:replaceChildren' });
            host.replaceChildren(createStudentSparkCard(spark, this.getStudentSparkQuestion(spark)));
            this.activities.updateArcadeGateDisplay();
            refreshIcons(host);
        } catch (error) {
            if (!isCurrent()) return;
            const { showSectionLoadError } = await import('../ui/sectionRecovery.js');
            showSectionLoadError(host, { label: 'the current Spark', error, current: isCurrent,
                keepContent: Boolean(host.children.length), retry: () => this.loadAndRenderCurrentSpark(host) });
        }
    }
