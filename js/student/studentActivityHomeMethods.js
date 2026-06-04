import { $, createElement, escapeHtml } from '../main.js';
import { getSubjectBySlug, getVocabSubjectSlug, preloadVocabularyFile } from '../services/vocabularyApi.js';
import { MONTH_INDEX } from './studentActivityConstants.js';

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

    renderStudentHome() {
        const container = $('#student-home-dashboard');
        if (!container) return;

        this.renderSubjectPicker('#student-subject-picker');
        container.innerHTML = '';
        const { vocabs, message } = this.getVisibleVocabularyList({
            availableOnly: true,
            currentTrimesterOnly: true
        });

        if (vocabs.length === 0) {
            container.innerHTML = `<p class="teacher-empty-state">${message}</p>`;
            return;
        }

        const today = new Date();
        const currentMonth = today.getMonth();
        const currentWeek = Math.floor((today.getDate() - 1) / 7) + 1;
        const decorated = vocabs.map(vocab => ({
            vocab,
            schedule: this.getVocabSchedule(vocab, today),
            progress: this.getUnitProgressSummary(vocab)
        })).sort((a, b) => {
            const aTime = a.schedule.dueDate?.getTime() || 0;
            const bTime = b.schedule.dueDate?.getTime() || 0;
            if (aTime !== bTime) return aTime - bTime;
            return String(a.vocab.name || '').localeCompare(String(b.vocab.name || ''));
        });

        const dueItems = decorated
            .filter(item => {
                if (item.progress.isComplete) return false;
                if (item.schedule.dueDate) return item.schedule.dueDate <= today;
                if (!item.schedule.month || !item.schedule.week) return true;
                const monthIndex = MONTH_INDEX[item.schedule.month];
                return monthIndex < currentMonth || (monthIndex === currentMonth && item.schedule.week <= currentWeek);
            })
            .slice(-2)
            .reverse();

        const recentItems = decorated
            .filter(item => item.progress.latestPlayed > 0 && !item.progress.isComplete)
            .sort((a, b) => b.progress.latestPlayed - a.progress.latestPlayed)
            .slice(0, 2);

        const weekItems = decorated
            .filter(item => {
                const monthIndex = MONTH_INDEX[item.schedule.month];
                return monthIndex === currentMonth && item.schedule.week === currentWeek;
            })
            .slice(0, 3);

        const fallbackWeekItems = weekItems.length > 0
            ? weekItems
            : decorated
                .filter(item => !item.progress.isComplete)
                .slice(-3)
                .reverse();

        const panels = [
            {
                key: 'pending',
                title: 'Pending',
                subtitle: 'Due this trimester',
                items: dueItems,
                emptyText: 'No pending units due yet.'
            },
            {
                key: 'recent',
                title: 'Recent',
                subtitle: 'Unfinished practice',
                items: recentItems,
                emptyText: 'No unfinished recent work.'
            },
            {
                key: 'week',
                title: 'This Week',
                subtitle: 'Current vocabulary',
                items: fallbackWeekItems,
                emptyText: 'No vocabulary is scheduled this week.'
            }
        ];

        const tabList = createElement('div', 'student-home-tabs');
        tabList.setAttribute('role', 'tablist');
        tabList.setAttribute('aria-label', 'Dashboard sections');
        panels.forEach((panel, index) => {
            const tab = createElement('button', `student-home-tab${index === 0 ? ' active' : ''}`);
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
            container.appendChild(this.createHomePanel(panel.key, panel.title, panel.subtitle, panel.items, panel.emptyText, index === 0));
        });
        this.bindHomePanelTabs(container);
        this.scheduleFirstVocabularyPreload(container);

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    bindHomePanelTabs(container) {
        const tabs = Array.from(container.querySelectorAll('.student-home-tab'));
        const panels = Array.from(container.querySelectorAll('.student-home-panel'));
        const activate = (key, focus = false) => {
            tabs.forEach(tab => {
                const active = tab.dataset.panel === key;
                tab.classList.toggle('active', active);
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
            items.forEach(item => list.appendChild(this.createHomeUnitCard(item)));
        }
        panel.appendChild(list);
        return panel;
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
                <span>${escapeHtml(subject.name)} · ${escapeHtml(schedule.label || this.getTrimesterLabel(this.getVocabTrimesterKey(vocab)))}</span>
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
