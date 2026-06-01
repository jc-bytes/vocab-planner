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

            // Remove existing badges
            const existingBadge = card.querySelector('.progress-badge');
            if (existingBadge) existingBadge.remove();
            const existingCoverage = card.querySelector('.coverage-badge');
            if (existingCoverage) existingCoverage.remove();
            const existingPlays = card.querySelector('.plays-badge');
            if (existingPlays) existingPlays.remove();

            if (scoreData) {
                const badge = createElement('div', 'progress-badge');
                const nonReplayable = ['flashcards', 'illustration'];
                badge.textContent = nonReplayable.includes(type) ? `${progress}%` : `Best ${progress}%`;
                if (isComplete) badge.classList.add('complete');
                card.appendChild(badge);

                // Show plays count for replayable activities
                if (!nonReplayable.includes(type) && scoreData.plays > 0) {
                    const playsBadge = createElement('div', 'plays-badge');
                    playsBadge.textContent = scoreData.plays === 1 ? '1 play' : `${scoreData.plays} plays`;
                    card.appendChild(playsBadge);
                }
            }

            // Show word coverage for activities that track it
            if (coverageStats && coverageStats[type] && !['flashcards', 'illustration'].includes(type)) {
                const coverage = coverageStats[type];
                if (coverage.practiced > 0) {
                    const coverageBadge = createElement('div', 'coverage-badge');
                    const allSeen = coverage.practiced >= coverage.total;
                    coverageBadge.textContent = allSeen ? `All ${coverage.total} seen` : `${coverage.practiced} seen`;
                    coverageBadge.title = `${coverage.practiced} of ${coverage.total} unit words have appeared in this activity. New rounds rotate through less-practiced words.`;
                    card.appendChild(coverageBadge);
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
