import { $, $$, createElement } from '../main.js';
import { getSubjectBySlug, getVocabSubjectSlug } from '../services/vocabularyApi.js';

export class StudentActivityMenu {
    constructor(activities) {
        this.activities = activities;
        this.sm = activities.sm;
    }

    showActivityMenu(options = {}) {
        const unitTitle = this.activities.formatVocabularyCardTitle?.(this.sm.currentVocab)
            || this.sm.currentVocab.name;
        $('#current-unit-title').textContent = unitTitle;
        const subject = getSubjectBySlug(this.sm.subjects, getVocabSubjectSlug(this.sm.currentVocab));
        const subjectEl = $('#current-unit-subject');
        if (subjectEl) {
            const purpose = this.activities.formatVocabularyPurpose?.(this.sm.currentVocab.purpose) || 'Unit';
            const schedule = this.activities.formatVocabularyScheduleLabel?.(this.sm.currentVocab) || '';
            subjectEl.textContent = [subject.name, purpose, schedule].filter(Boolean).join(' · ');
            subjectEl.style.setProperty('--subject-color', subject.color);
        }
        const descriptionEl = $('#current-unit-description');
        if (descriptionEl) {
            descriptionEl.textContent = this.activities.formatVocabularyCardDescription?.(this.sm.currentVocab, unitTitle)
                || this.sm.currentVocab.description
                || '';
        }

        // Get word coverage stats
        const coverageStats = this.activities.getWordCoverageStats();
        const activityFlow = this.activities.getActivityFlowConfig();

        // Update progress on cards
        const cards = $$('.activity-card');
        cards.forEach(card => {
            const type = card.dataset.activity;
            const scoreData = this.sm.unitScores[type];
            let progress = 0;
            let isComplete = false;

            if (scoreData) {
                progress = scoreData.score || 0;
                isComplete = scoreData.isComplete || (progress >= 100);
            }

            card.querySelector('.progress-badge')?.remove();
            card.querySelector('.coverage-badge')?.remove();
            card.querySelector('.plays-badge')?.remove();
            card.querySelector('.next-activity-label')?.remove();
            card.querySelector('.activity-lock-label')?.remove();
            card.querySelector('.activity-unavailable-label')?.remove();
            card.querySelector('.activity-path-status')?.remove();
            card.querySelector('.activity-path-step')?.remove();
            card.classList.remove(
                'next-activity-card',
                'activity-flow-card-compact',
                'activity-locked-card',
                'activity-unavailable-card',
                'required-activity-card',
                'additional-activity-card',
                'activity-path-complete'
            );
            card.disabled = false;
            card.removeAttribute('aria-disabled');
            card.removeAttribute('title');
            card.dataset.activityTitle = card.querySelector('h3')?.textContent?.trim() || type;
            card.dataset.activityDescription = card.querySelector('p')?.textContent?.trim() || '';
            card.dataset.activityProgressSummary = 'Not started';
            card.dataset.activityPlaysSummary = '';
            card.dataset.activityCoverageSummary = '';

            if (scoreData) {
                const badge = createElement('div', 'progress-badge');
                const nonReplayable = ['flashcards', 'illustration'];
                badge.textContent = nonReplayable.includes(type) ? `${progress}%` : `Best ${progress}%`;
                if (isComplete) badge.classList.add('complete');
                card.appendChild(badge);
                card.dataset.activityProgressSummary = isComplete
                    ? `${badge.textContent} complete`
                    : badge.textContent;

                if (!nonReplayable.includes(type) && scoreData.plays > 0) {
                    card.dataset.activityPlaysSummary = scoreData.plays === 1 ? '1 play' : `${scoreData.plays} plays`;
                }
            }

            // Show word coverage for activities that track it
            if (coverageStats && coverageStats[type] && !['flashcards', 'illustration'].includes(type)) {
                const coverage = coverageStats[type];
                if (coverage.practiced > 0) {
                    const allSeen = coverage.practiced >= coverage.total;
                    card.dataset.activityCoverageSummary = allSeen
                        ? `All ${coverage.total} words seen`
                        : `${coverage.practiced}/${coverage.total} words seen`;
                }
            }
        });
        this.activities.updateActivityGateDisplay(cards, activityFlow);

        const completion = this.activities.getRequiredCompletion(activityFlow);
        const percent = completion.total > 0
            ? Math.round((completion.completed / completion.total) * 100)
            : 0;
        const percentEl = $('#current-unit-progress-percent');
        const fillEl = $('#current-unit-progress-fill');
        const progressCopyEl = $('#current-unit-progress-copy');
        if (percentEl) percentEl.textContent = `${percent}%`;
        if (fillEl) fillEl.style.width = `${percent}%`;
        if (progressCopyEl) {
            progressCopyEl.textContent = `${completion.completed} of ${completion.total} required complete`;
        }

        // Update overall coverage display if element exists
        this.activities.updateOverallCoverageDisplay(coverageStats);

        if (!options.fromRoute) {
            const unitId = this.sm.getCurrentVocabRouteId();
            if (unitId) {
                this.sm.setRoute({ view: 'unit', unitId });
            }
        }

        this.sm.switchView('activity-menu-view');
        this.activities.scheduleActivityPreload(activityFlow);
        if (window.lucide) window.lucide.createIcons({ root: $('#activity-menu-view') });
    }
}
