import { $, $$, createElement } from '../main.js';
import { getSubjectBySlug, getVocabSubjectSlug } from '../services/vocabularyApi.js';

class StudentActivityMenuMethods {
    showActivityMenu(options = {}) {
        $('#current-unit-title').textContent = this.sm.currentVocab.name;
        const subject = getSubjectBySlug(this.sm.subjects, getVocabSubjectSlug(this.sm.currentVocab));
        const subjectEl = $('#current-unit-subject');
        if (subjectEl) {
            subjectEl.textContent = subject.name;
            subjectEl.style.setProperty('--subject-color', subject.color);
        }

        // Get word coverage stats
        const coverageStats = this.getWordCoverageStats();
        const activityFlow = this.getActivityFlowConfig();

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
            card.classList.remove('next-activity-card', 'activity-flow-card-compact');
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
        this.updateActivityGateDisplay(cards, activityFlow);

        // Update overall coverage display if element exists
        this.updateOverallCoverageDisplay(coverageStats);

        if (!options.fromRoute) {
            const unitId = this.sm.getCurrentVocabRouteId();
            if (unitId) {
                this.sm.setRoute({ view: 'unit', unitId });
            }
        }

        this.sm.switchView('activity-menu-view');
        this.scheduleActivityPreload(activityFlow);
    }
}

export function installStudentActivityMenuMethods(StudentActivities) {
    for (const name of Object.getOwnPropertyNames(StudentActivityMenuMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentActivityMenuMethods.prototype, name)
        );
    }
}
