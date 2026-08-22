export class StudentActivityResultProcessor {
    constructor(activities) {
        this.activities = activities;
        this.sm = activities.sm;
    }

    applyActivityProgressResult(progress, payload = {}) {
        if (!progress) return;
        if (!progress.activity) {
            this.sm.progress.applyProgressSnapshot(progress, { saveLocal: true });
            return;
        }

        const activity = progress.activity;
        const unitKey = activity.unitKey || payload.unitKey;
        const activityType = activity.activityType || payload.activityType;
        const units = this.sm.progressData.units ||= {};
        const unit = units[unitKey] ||= { ...(payload.unitContext || {}), scores: {}, states: {} };
        unit.scores ||= {};
        const previous = unit.scores[activityType] || {};
        const bestAttempt = activity.bestAttempt && typeof activity.bestAttempt === 'object'
            ? activity.bestAttempt
            : null;
        const coherentDetails = bestAttempt?.details && typeof bestAttempt.details === 'object'
            ? bestAttempt.details
            : activity.details;
        unit.scores[activityType] = {
            ...previous,
            score: Number(activity.score) || 0,
            isComplete: Boolean(activity.isComplete),
            plays: Number(activity.plays) || 0,
            totalEarned: Number(activity.totalEarned) || 0,
            accuracy: activity.accuracy === null || activity.accuracy === undefined
                ? previous.accuracy
                : Number(activity.accuracy) || 0,
            bestAccuracy: activity.bestAccuracy ?? previous.bestAccuracy,
            lifetimeCorrect: Number(activity.lifetimeCorrect) || 0,
            lifetimeAttempted: Number(activity.lifetimeAttempted) || 0,
            lifetimeAccuracy: activity.lifetimeAccuracy ?? previous.lifetimeAccuracy,
            finishedRuns: Number(activity.finishedRuns) || 0,
            masteredRuns: Number(activity.masteredRuns) || 0,
            details: coherentDetails?.summary ?? previous.details ?? '',
            evidence: coherentDetails?.evidence ?? previous.evidence,
            verified: Boolean(activity.verified),
            attemptId: activity.attemptId || previous.attemptId || '',
            bestAttemptId: activity.bestAttemptId || previous.bestAttemptId || '',
            latestAttemptId: activity.latestAttemptId || previous.latestAttemptId || '',
            bestAttempt: bestAttempt || previous.bestAttempt,
            latestAttempt: activity.latestAttempt || previous.latestAttempt,
            lastPlayed: activity.lastPlayed || previous.lastPlayed,
            updatedAt: activity.updatedAt || progress.updatedAt
        };
        if (bestAttempt?.state !== undefined && bestAttempt.state !== null) {
            unit.states ||= {};
            unit.states[activityType] = bestAttempt.state;
        }
        this.sm.progressData.totalXp = Number(progress.totalXp) || 0;
        this.sm.progressData.version = Number(progress.version) || this.sm.progressData.version || 0;
        if (progress.coinData) {
            this.sm.progress.applyCoinSnapshot(progress.coinData, this.sm.coinHistory, { saveLocal: false });
        }
        const isCurrentUnit = this.sm.currentVocab
            && this.activities.getUnitProgressKey(this.sm.currentVocab) === unitKey;
        if (isCurrentUnit) {
            this.sm.unitScores = unit.scores;
        }
        this.sm.progress.updateLevelDisplay?.();
        this.sm.progress.saveLocalProgress(true);
        this.activities.updateArcadeGateDisplay?.();

        const activityMenuView = typeof document === 'undefined'
            ? null
            : document.querySelector('#activity-menu-view');
        if (isCurrentUnit && activityMenuView && !activityMenuView.classList.contains('hidden')) {
            this.activities.showActivityMenu?.({ fromRoute: true, skipActivityPreload: true });
        }
    }

    getAwardedXp(previousTotalXp, progress = {}) {
        const before = Math.max(0, Number(previousTotalXp) || 0);
        const after = Math.max(0, Number(progress.totalXp) || 0);
        return Math.max(0, Math.round(after - before));
    }

    getActivityXpRewardText(xpAwarded) {
        const amount = Math.max(0, Number(xpAwarded) || 0);
        return amount > 0 ? `+${amount} XP` : 'No new XP';
    }

    showActivityXpReward(xpAwarded, activityType = '') {
        if (this.sm.currentActivityType !== activityType || typeof document === 'undefined' || !document.body) {
            return null;
        }

        document.getElementById('activity-xp-reward')?.remove();

        const amount = Math.max(0, Number(xpAwarded) || 0);
        const reward = document.createElement('div');
        reward.id = 'activity-xp-reward';
        reward.className = `activity-xp-reward${amount > 0 ? '' : ' activity-xp-reward--none'}`;
        reward.setAttribute('role', 'status');
        reward.setAttribute('aria-live', 'polite');

        const emblem = document.createElement('span');
        emblem.className = 'activity-xp-reward__emblem';
        emblem.textContent = 'XP';
        emblem.setAttribute('aria-hidden', 'true');

        const copy = document.createElement('span');
        copy.className = 'activity-xp-reward__copy';

        const value = document.createElement('strong');
        value.className = 'activity-xp-reward__value';
        value.textContent = this.getActivityXpRewardText(amount);

        copy.append(value);
        reward.append(emblem, copy);
        document.body.appendChild(reward);

        window.setTimeout(() => reward.classList.add('activity-xp-reward--leaving'), 4700);
        window.setTimeout(() => reward.remove(), 5200);
        return reward;
    }
}
