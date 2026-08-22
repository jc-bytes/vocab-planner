import { $ } from '../main.js';
import { refreshLocalFormativeWindow } from './studentArcadeTimeStorage.js';

const NON_REPLAYABLE_ACTIVITIES = new Set(['flashcards', 'illustration']);

export class StudentActivityAutoSave {
    constructor(persistence) {
        this.persistence = persistence;
        this.activities = persistence.activities;
        this.sm = persistence.sm;
    }

    getActivityCoinRewards(activityType, settings = {}) {
        const activityRewards = settings.activityRewards?.[activityType] || {};
        return {
            progressReward: activityRewards.progressReward !== undefined
                ? activityRewards.progressReward
                : (settings.progressReward !== undefined ? settings.progressReward : 1),
            completionBonus: activityRewards.completionBonus !== undefined
                ? activityRewards.completionBonus
                : (settings.completionBonus !== undefined ? settings.completionBonus : 50)
        };
    }

    handleAutoSave(scoreData) {
        if (!this.sm.currentVocab || !this.sm.currentActivityType) return;
        const activityType = this.sm.currentActivityType;
        if (this.persistence.isActivityAttemptFinished(activityType, scoreData)) {
            this.activities.session.workTimer?.pause?.();
        }
        const settings = this.sm.currentVocab.activitySettings || {};
        const { progressReward, completionBonus } = this.getActivityCoinRewards(activityType, settings);
        const wasComplete = Boolean(this.sm.unitScores[activityType]?.isComplete);
        const persistedScoreData = NON_REPLAYABLE_ACTIVITIES.has(activityType)
            ? this.updateNonReplayableScore(activityType, scoreData, progressReward, completionBonus)
            : this.updateReplayableScore(activityType, scoreData, progressReward, completionBonus);

        this.sm.progress.saveLocalProgress(true);
        if (this.sm.authDisabled && activityType !== 'flashcards'
            && !wasComplete && Boolean(persistedScoreData.isComplete)) {
            refreshLocalFormativeWindow();
            this.sm.showToast?.('Formative complete: Arcade is ready for 10 minutes!');
        }
        this.persistence.syncActivityProgressToCloud(activityType, scoreData, {
            ...settings,
            progressReward,
            completionBonus
        });
        this.activities.scheduleActivityPreload();
        this.activities.updateArcadeGateDisplay();

        const indicator = $('#activity-progress-indicator');
        if (indicator) {
            indicator.textContent = `Progress: ${persistedScoreData.score || 0}%`;
            indicator.classList.remove('hidden');
        }
    }

    updateNonReplayableScore(activityType, scoreData, progressReward, completionBonus) {
        const oldScoreData = this.sm.unitScores[activityType];
        const oldScore = oldScoreData?.score || 0;
        const newScore = scoreData.score || 0;

        if (newScore > oldScore) {
            const stepsGained = Math.floor(newScore / 10) - Math.floor(oldScore / 10);
            let totalReward = Math.max(0, stepsGained * progressReward);
            if (newScore === 100 && oldScore < 100) totalReward += completionBonus;
            if (totalReward > 0) {
                this.sm.progress.addCoins(totalReward, 'activity', '', { skipCloud: true });
            }
        }

        const persistedScoreData = {
            ...oldScoreData,
            ...scoreData,
            score: Math.max(oldScore, newScore),
            details: newScore >= oldScore ? scoreData.details : oldScoreData?.details,
            isComplete: Boolean(oldScoreData?.isComplete) || Boolean(scoreData.isComplete) || oldScore >= 100
        };
        this.sm.unitScores[activityType] = persistedScoreData;
        return persistedScoreData;
    }

    updateReplayableScore(activityType, scoreData, progressReward, completionBonus) {
        const oldScoreData = this.sm.unitScores[activityType] || { score: 0, plays: 0, totalEarned: 0 };
        const oldScore = oldScoreData.score || 0;
        const newScore = scoreData.score || 0;

        this.sm.sessionProgress ||= {};
        this.sm.sessionProgress[activityType] ||= { lastScore: 0 };
        const sessionLastScore = this.sm.sessionProgress[activityType].lastScore;

        if (newScore > sessionLastScore) {
            const stepsGained = Math.floor(newScore / 10) - Math.floor(sessionLastScore / 10);
            let totalReward = Math.max(0, stepsGained * progressReward);
            if (newScore === 100 && sessionLastScore < 100) totalReward += completionBonus;
            if (totalReward > 0) {
                this.sm.progress.addCoins(totalReward, 'activity', '', { skipCloud: true });
                oldScoreData.totalEarned = (oldScoreData.totalEarned || 0) + totalReward;
            }
        }

        this.sm.sessionProgress[activityType].lastScore = newScore;
        if (scoreData.isComplete) {
            oldScoreData.plays = (oldScoreData.plays || 0) + 1;
            this.sm.sessionProgress[activityType].lastScore = 0;
        }

        const isNewBest = newScore >= oldScore;
        oldScoreData.score = Math.max(oldScore, newScore);
        if (isNewBest) oldScoreData.details = scoreData.details;
        oldScoreData.isComplete = oldScoreData.isComplete || scoreData.isComplete;
        if (isNewBest && scoreData.evidence && typeof scoreData.evidence === 'object') {
            oldScoreData.evidence = scoreData.evidence;
        }
        if (isNewBest && scoreData.accuracy !== undefined) {
            oldScoreData.accuracy = Number(scoreData.accuracy) || 0;
        }
        oldScoreData.lastPlayed = new Date().toISOString();

        this.sm.unitScores[activityType] = oldScoreData;
        return oldScoreData;
    }
}
