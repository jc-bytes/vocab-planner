import { $, createElement, refreshIcons } from '../main.js';
import { MONTH_INDEX } from './studentActivityConstants.js';

export async function renderStudentHomeContent({ isCurrent = () => true } = {}) {
        if (!isCurrent()) return;
        const container = $('#student-home-dashboard');
        if (!container) return;
        this.sm.logStudentDomUpdate?.('student-home-dashboard', { source: 'renderStudentHome:clear' });

        this.activities.vocabularyData.renderSubjectPicker('#student-subject-picker');
        container.innerHTML = '';

        try {
            await this.refreshCurrentSparkGate({ updateDisplay: false });
        } catch (error) {
            console.warn('Could not refresh the current Spark gate', error);
        }
        if (!isCurrent()) return;

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
        this.activities.browser.cards.scheduleFirstVocabularyPreload(container);

        refreshIcons(container);
}
