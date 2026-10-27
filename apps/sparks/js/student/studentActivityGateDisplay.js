import { $, createElement } from '../main.js';

export class StudentActivityGateDisplay {
    constructor(progressFlow) {
        this.progressFlow = progressFlow;
        this.activities = progressFlow.activities;
        this.sm = progressFlow.sm;
    }

    getActivityFlowConfig(...args) {
        return this.progressFlow.getActivityFlowConfig(...args);
    }

    getRequiredCompletion(...args) {
        return this.progressFlow.getRequiredCompletion(...args);
    }

    isActivityComplete(...args) {
        return this.progressFlow.isActivityComplete(...args);
    }

    updateArcadeGateDisplay(status = this.progressFlow.getPendingRequiredWork()) {
        const arcadeTab = $('#student-tab-arcade');
        if (!arcadeTab) return status;

        const existingBadge = arcadeTab.querySelector('.student-arcade-lock-count');
        existingBadge?.remove();
        arcadeTab.classList.toggle('student-tab-locked', status.isBlocked);
        arcadeTab.dataset.locked = status.isBlocked ? 'true' : 'false';
        arcadeTab.setAttribute('aria-disabled', status.isBlocked ? 'true' : 'false');

        if (status.isBlocked) {
            const unitLabel = status.unitCount === 1 ? 'unit' : 'units';
            const activityLabel = status.vocabularyRemainingActivities === 1 ? 'activity' : 'activities';
            const vocabularyMessage = status.vocabularyRemainingActivities > 0
                ? `${status.vocabularyRemainingActivities} required ${activityLabel} in ${status.unitCount} ${unitLabel}`
                : '';
            const sparkMessage = status.spark ? "today's Spark check" : '';
            const workMessage = [sparkMessage, vocabularyMessage].filter(Boolean).join(' and ');
            const message = `Complete ${workMessage} to unlock Arcade.`;
            arcadeTab.title = message;
            arcadeTab.setAttribute('aria-label', `Arcade locked. ${message}`);
            const badge = createElement('span', 'student-arcade-lock-count', String(status.remainingActivities));
            badge.setAttribute('aria-hidden', 'true');
            arcadeTab.appendChild(badge);
        } else {
            arcadeTab.removeAttribute('title');
            arcadeTab.setAttribute('aria-label', 'Arcade');
        }

        return status;
    }

    updateActivityGateDisplay(cards, flow = this.getActivityFlowConfig()) {
        return this.activities.menu?.updateVisibleGates(cards, flow);
    }
}
