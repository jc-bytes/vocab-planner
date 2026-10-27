import { $, createElement, escapeHtml } from '../main.js';
import { MONTH_INDEX } from './studentActivityConstants.js';
import { getStudentPageSkeleton } from './studentLoadingSkeletons.js';

const SPARK_TYPE_LABELS = {
    cool_fact: 'Cool Fact',
    trivia: 'Trivia',
    good_news: 'Good News',
    reflection: 'Reflection',
    debate: 'Debate'
};
function getSafeExternalUrl(value) {
    try {
        const url = new URL(String(value || ''));
        return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch (_error) {
        return '';
    }
}

export function getUnitProgressSummary(activities, vocab) {
        const completion = activities.getUnitRequiredCompletion(vocab);
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

export function getHomeRecommendation({ decoratedVocabs = [], weekItems = [], requiredWork = {}, today = new Date() } = {}) {
        const getIdentity = vocab => String(vocab?.path || vocab?.id || vocab?.name || '');
        const decoratedByIdentity = new Map(
            decoratedVocabs.map(item => [getIdentity(item.vocab), item])
        );
        const requiredItems = (requiredWork.units || [])
            .map(required => decoratedByIdentity.get(getIdentity(required.vocab)))
            .filter(Boolean);
        const oldestRequired = requiredItems.find(item => isHomeScheduleBeforeCurrentWeek(item.schedule, today));

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

export function getContinueLearningPercent(progress = {}) {
        if (progress.requiredTotal > 0) {
            return Math.min(100, Math.round((progress.completedRequired / progress.requiredTotal) * 100));
        }
        return Math.min(100, Math.max(0, Math.round(Number(progress.bestScore) || 0)));
    }

export function isVocabScheduleInCurrentWeek(schedule = {}, date = new Date()) {
        if (!(schedule.dueDate instanceof Date) || Number.isNaN(schedule.dueDate.getTime())) return false;
        const bounds = getHomeCurrentWeekBounds(date);
        const scheduleTime = schedule.dueDate.getTime();
        return scheduleTime >= bounds.start && scheduleTime <= bounds.end;
    }

export function getHomeCurrentWeekBounds(date = new Date()) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const daysSinceMonday = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - daysSinceMonday);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start: start.getTime(), end: end.getTime() };
    }

export function isHomeScheduleBeforeCurrentWeek(schedule = {}, date = new Date()) {
        if (schedule.dueDate instanceof Date && !Number.isNaN(schedule.dueDate.getTime())) {
            return schedule.dueDate.getTime() < getHomeCurrentWeekBounds(date).start;
        }
        if (!schedule.month || !schedule.week) return false;
        const currentMonth = date.getMonth();
        const currentWeek = Math.floor((date.getDate() - 1) / 7) + 1;
        const monthIndex = MONTH_INDEX[schedule.month];
        return monthIndex < currentMonth || (monthIndex === currentMonth && schedule.week < currentWeek);
    }

export function createStudentSparkCard(spark, question = '') {
        const card = createElement('section', 'student-spark-card');
        card.setAttribute('aria-label', 'Spark of the Week');
        const safeSourceUrl = getSafeExternalUrl(spark.sourceUrl);
        const sourceHtml = safeSourceUrl
            ? `<a href="${escapeHtml(safeSourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(spark.sourceTitle || 'Source')}</a>`
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

export function removeSparkHomePanel(host, logDomUpdate = () => {}) {
        logDomUpdate('student-home-dashboard', { source: 'removeSparkHomePanel' });
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

export function createSparkHomePanel(navigate, title, subtitle, active = false) {
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
                ${getStudentPageSkeleton('list', 'Loading Spark')}
            </div>
        `;
        const openButton = createElement('button', 'student-home-spark-open');
        openButton.type = 'button';
        openButton.setAttribute('aria-label', 'Open Sparks');
        openButton.addEventListener('click', () => navigate({ view: 'sparks' }));
        panel.appendChild(openButton);
        return panel;
    }
