import { $ } from '../main.js';
import { imageDB } from '../db.js';
import { studentApi as supabaseService } from '../services/studentApi.js';
import { createRequestError, requestWithTimeout } from '../services/requestReliability.js';

function getSyncErrorSummary(error) {
    const parts = [error?.code, error?.message, error?.details, error?.hint]
        .map(value => String(value || '').trim())
        .filter(Boolean);
    return parts.join(' | ') || String(error || 'Unknown sync error');
}

export class StudentActivityProgressPersistence {
    constructor(activities) {
        this.activities = activities;
        this.sm = activities.sm;
        this.activitySyncChains = new Map();
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

    async startVerifiedActivityAttempt(activityType, options = {}) {
        if (this.sm.authDisabled || !this.sm.currentUser) {
            this.activities.session.activityAttempt = null;
            return null;
        }

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            throw createRequestError('An internet connection is required to start this activity.', 'OFFLINE');
        }

        const vocab = this.sm.currentVocab;
        const attempt = await requestWithTimeout(signal => (
            supabaseService.startStudentActivityAttempt({
                unitKey: this.activities.getUnitProgressKey(vocab),
                vocabularyId: this.sm.getVocabRouteId?.(vocab) || vocab?.id || '',
                activityType,
                signal
            })
        ), {
            signal: options.signal,
            timeoutMs: options.timeoutMs || 10000,
            label: 'Starting the verified activity'
        });
        if (!attempt?.attemptId) throw new Error('The server did not create a verified activity attempt.');
        this.activities.session.activityAttempt = attempt;
        return attempt;
    }

    handleAutoSave(scoreData) {
        if (this.sm.currentVocab && this.sm.currentActivityType) {
            const activityType = this.sm.currentActivityType;
            const settings = this.sm.currentVocab.activitySettings || {};
            const { progressReward, completionBonus } = this.getActivityCoinRewards(activityType, settings);
            let persistedScoreData = scoreData;

            // Non-replayable activities (flashcards, illustration) - only reward first-time progress
            const nonReplayable = ['flashcards', 'illustration'];

            if (nonReplayable.includes(activityType)) {
                // Original behavior: only reward if new score > old score
                const oldScoreData = this.sm.unitScores[activityType];
                const oldScore = oldScoreData ? (oldScoreData.score || 0) : 0;
                const newScore = scoreData.score || 0;

                if (newScore > oldScore) {
                    const stepsOld = Math.floor(oldScore / 10);
                    const stepsNew = Math.floor(newScore / 10);
                    const stepsGained = stepsNew - stepsOld;
                    let totalReward = Math.max(0, stepsGained * progressReward);

                    if (newScore === 100 && oldScore < 100) {
                        totalReward += completionBonus;
                    }

                    if (totalReward > 0) {
                        this.sm.progress.addCoins(totalReward);
                    }
                }

                persistedScoreData = {
                    ...scoreData,
                    score: Math.max(oldScore, newScore),
                    details: newScore >= oldScore ? scoreData.details : oldScoreData?.details,
                    isComplete: Boolean(oldScoreData?.isComplete) || Boolean(scoreData.isComplete) || oldScore >= 100
                };
                this.sm.unitScores[activityType] = persistedScoreData;
            } else {
                // Replayable activities: track best score + total plays + earn coins on each play
                const oldScoreData = this.sm.unitScores[activityType] || { score: 0, plays: 0, totalEarned: 0 };
                const oldScore = oldScoreData.score || 0;
                const newScore = scoreData.score || 0;

                // Track session progress for coin rewards
                if (!this.sm.sessionProgress) this.sm.sessionProgress = {};
                if (!this.sm.sessionProgress[activityType]) {
                    this.sm.sessionProgress[activityType] = { lastScore: 0 };
                }

                const sessionLastScore = this.sm.sessionProgress[activityType].lastScore;

                // Award coins for progress within this session
                if (newScore > sessionLastScore) {
                    const stepsOld = Math.floor(sessionLastScore / 10);
                    const stepsNew = Math.floor(newScore / 10);
                    const stepsGained = stepsNew - stepsOld;
                    let totalReward = Math.max(0, stepsGained * progressReward);

                    // Completion bonus only once per session
                    if (newScore === 100 && sessionLastScore < 100) {
                        totalReward += completionBonus;
                    }

                    if (totalReward > 0) {
                        this.sm.progress.addCoins(totalReward);
                        oldScoreData.totalEarned = (oldScoreData.totalEarned || 0) + totalReward;
                    }
                }

                this.sm.sessionProgress[activityType].lastScore = newScore;

                // Update best score and increment plays on completion
                if (scoreData.isComplete) {
                    oldScoreData.plays = (oldScoreData.plays || 0) + 1;
                    this.sm.sessionProgress[activityType].lastScore = 0; // Reset for next play
                }

                // Keep best score
                oldScoreData.score = Math.max(oldScore, newScore);
                oldScoreData.details = scoreData.details;
                oldScoreData.isComplete = oldScoreData.isComplete || scoreData.isComplete;
                if (scoreData.evidence && typeof scoreData.evidence === 'object') {
                    oldScoreData.evidence = scoreData.evidence;
                }
                if (scoreData.accuracy !== undefined) {
                    oldScoreData.accuracy = Number(scoreData.accuracy) || 0;
                }
                oldScoreData.lastPlayed = new Date().toISOString();

                this.sm.unitScores[activityType] = oldScoreData;
                persistedScoreData = oldScoreData;
            }

            this.sm.progress.saveLocalProgress();
            this.syncActivityProgressToCloud(activityType, persistedScoreData, {
                ...settings,
                progressReward,
                completionBonus
            });
            this.activities.scheduleActivityPreload();
            this.activities.updateArcadeGateDisplay();

            // Update in-game progress indicator
            const indicator = $('#activity-progress-indicator');
            if (indicator) {
                const percent = persistedScoreData.score || 0;
                indicator.textContent = `Progress: ${percent}%`;
                indicator.classList.remove('hidden');
            }
        }
    }

    buildActivityProgressPayload(activityType, scoreData = {}, settings = {}) {
        const unitProgress = this.activities.getCurrentUnitProgress();
        if (!unitProgress || !this.sm.currentVocab) return null;
        const flow = this.activities.getActivityFlowConfig(this.sm.currentVocab);
        return {
            unitKey: this.activities.getUnitProgressKey(this.sm.currentVocab),
            unitContext: {
                unitId: unitProgress.unitId || this.sm.getVocabRouteId?.(this.sm.currentVocab) || this.sm.currentVocab.id || '',
                unitName: unitProgress.unitName || this.sm.currentVocab.name || '',
                subjectSlug: unitProgress.subjectSlug || '',
                trimester: unitProgress.trimester || '',
                schoolYear: unitProgress.schoolYear || '',
                grade: unitProgress.grade || this.sm.studentProfile?.grade || ''
            },
            activityType,
            isRequired: flow.required.includes(activityType),
            attemptId: this.activities.session.activityAttempt?.attemptId || '',
            score: Number(scoreData.score) || 0,
            isComplete: Boolean(scoreData.isComplete),
            details: {
                summary: typeof scoreData.details === 'string' ? scoreData.details : '',
                evidence: scoreData.evidence && typeof scoreData.evidence === 'object'
                    ? scoreData.evidence
                    : {},
                accuracy: Number(scoreData.accuracy) || 0
            },
            activitySettings: {
                progressReward: settings.progressReward,
                completionBonus: settings.completionBonus
            },
            clientId: this.sm.progress?.clientId || ''
        };
    }

    async syncActivityProgressToCloud(activityType, scoreData = {}, settings = {}) {
        if (this.sm.authDisabled || !this.sm.currentUser) return;
        const payload = this.buildActivityProgressPayload(activityType, scoreData, settings);
        if (!payload) return;

        const syncKey = `${payload.unitKey}:${activityType}`;
        const previousSync = this.activitySyncChains.get(syncKey) || Promise.resolve();
        const currentSync = previousSync
            .catch(() => {})
            .then(() => this.submitActivityProgressPayload(payload));
        this.activitySyncChains.set(syncKey, currentSync);

        try {
            await currentSync;
        } finally {
            if (this.activitySyncChains.get(syncKey) === currentSync) {
                this.activitySyncChains.delete(syncKey);
            }
        }
    }

    async submitActivityProgressPayload(payload) {
        try {
            const previousTotalXp = Number(this.sm.progressData?.totalXp) || 0;
            const progress = await supabaseService.submitStudentActivityProgress(payload);
            const xpAwarded = this.getAwardedXp(previousTotalXp, progress);
            this.sm.progress.applyProgressSnapshot(progress, { saveLocal: true });
            this.sm.setAuthStatus('Synced');
            if (payload.isComplete) {
                this.showActivityXpReward(xpAwarded, payload.activityType);
            }
        } catch (error) {
            console.warn(`Could not sync activity progress event: ${getSyncErrorSummary(error)}`);
            try {
                await imageDB.enqueueSyncAction('student-activity-progress', payload);
            } catch (queueError) {
                console.warn('Could not queue activity progress event:', queueError);
            }
            this.sm.setAuthStatus(navigator.onLine ? 'Sync failed - saved locally' : 'Saved locally - offline');
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

    resetActivityState(activityType) {
        if (!this.sm.currentVocab) return;

        const vocabName = this.sm.currentVocab.name;
        const vocabID = this.sm.currentVocab.id || vocabName;

        // Clear only this activity's transient state. A broken save in one game
        // must never erase another activity's in-progress round.
        const wordCount = this.sm.currentVocab.words.length;
        const firstWord = this.sm.currentVocab.words[0]?.word || 'empty';
        const stateKeysByActivity = {
            flashcards: [`flashcards_state_${firstWord}_${wordCount}`, `flashcards_state_${wordCount}`],
            hangman: [`hangman_state_${wordCount}`],
            scramble: [`scramble_state_${wordCount}`],
            wordle: [`wordle_state_${wordCount}`],
            crossword: [`crossword_state_${wordCount}`],
            'fill-in-blank': [`fib_state_${wordCount}`],
            matching: [`matching_state_${firstWord}_${wordCount}`],
            quiz: [`quiz_state_${firstWord}_${wordCount}`],
            'synonym-antonym': [`synonym_antonym_state_${firstWord}_${wordCount}`],
            'word-search': [`word_search_state_${vocabID}`],
            'speed-match': [`speedmatch_highscore_${wordCount}`]
        };
        const stateKeys = stateKeysByActivity[activityType] || [];

        stateKeys.forEach(key => {
            const normalizedKey = key.trim();
            localStorage.removeItem(key);
            localStorage.removeItem(normalizedKey);
            localStorage.removeItem(`${normalizedKey} `); // Handle legacy keys with a trailing space.
        });

        // Clear saved state in progress data
        if (this.sm.unitStates && this.sm.unitStates[activityType]) {
            delete this.sm.unitStates[activityType];
        }

        if (activityType === 'illustration') {
            localStorage.removeItem(`word_hunt_state_${vocabName}_${this.sm.currentVocab.words.length}`);
            const progressKey = this.activities.getUnitProgressKey(this.sm.currentVocab);
            if (this.sm.progressData.units[progressKey]?.wordHunt) {
                delete this.sm.progressData.units[progressKey].wordHunt;
            }
            this.sm.unitWordHunt = {};
        }

        // Reset session progress
        if (this.sm.sessionProgress && this.sm.sessionProgress[activityType]) {
            this.sm.sessionProgress[activityType].lastScore = 0;
        }

        this.sm.progress.saveLocalProgress();
    }

    sanitizeActivityState(stateData) {
        if (stateData === null) return null;

        try {
            const serialized = JSON.stringify(stateData);
            if (/data:image\/|base64/i.test(serialized)) {
                console.warn('Rejected activity state because it contains image data.');
                return undefined;
            }

            const byteLength = new TextEncoder().encode(serialized).length;
            if (byteLength > 50 * 1024) {
                console.warn(`Rejected activity state above 50 KB (${byteLength} bytes).`);
                return undefined;
            }

            return JSON.parse(serialized);
        } catch (error) {
            console.warn('Rejected invalid activity state:', error);
            return undefined;
        }
    }

    areActivityStatesEquivalent(firstState, secondState) {
        if (firstState === secondState) return true;
        if (!firstState || !secondState || typeof firstState !== 'object' || typeof secondState !== 'object') {
            return false;
        }

        const canonicalize = value => {
            if (Array.isArray(value)) return value.map(item => canonicalize(item));
            if (!value || typeof value !== 'object') return value;

            return Object.keys(value)
                .filter(key => key !== 'updatedAt')
                .sort()
                .reduce((result, key) => {
                    result[key] = canonicalize(value[key]);
                    return result;
                }, {});
        };

        try {
            return JSON.stringify(canonicalize(firstState)) === JSON.stringify(canonicalize(secondState));
        } catch {
            return false;
        }
    }

    handleStateSave(stateData) {
        if (this.sm.currentVocab && this.sm.currentActivityType) {
            const sanitizedState = this.sanitizeActivityState(stateData);
            if (sanitizedState === undefined) return;

            const unitProgress = this.activities.getCurrentUnitProgress();
            if (!unitProgress.states) unitProgress.states = {};
            const activityType = this.sm.currentActivityType;
            const existingState = unitProgress.states[activityType];

            if (
                (sanitizedState === null && existingState === undefined)
                || this.areActivityStatesEquivalent(existingState, sanitizedState)
            ) {
                return;
            }

            if (sanitizedState === null) {
                delete unitProgress.states[activityType];
            } else {
                unitProgress.states[activityType] = sanitizedState;
            }

            this.sm.unitStates = unitProgress.states;
            this.sm.progress.saveLocalProgress();
        }
    }
}
