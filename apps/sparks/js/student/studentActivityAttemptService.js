import { studentApi } from '../services/studentApi.js';
import { createRequestError } from '../services/requestReliability.js';
import { runActivityStartupStage } from './studentActivityStartupRecovery.js';
import { createUniqueId } from '../randomUtils.js';

export class StudentActivityAttemptService {
    constructor(persistence) {
        this.persistence = persistence;
        this.activities = persistence.activities;
        this.sm = persistence.sm;
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
        const unitKey = this.activities.getUnitProgressKey(vocab);
        const vocabularyId = vocab?.id || '';
        const launchId = this.activities.session.activityLaunchId;
        const userId = this.sm.currentUser?.uid;
        const isCurrent = () => !options.signal?.aborted && this.sm.currentVocab === vocab
            && this.activities.session.activityLaunchId === launchId
            && this.sm.currentUser?.uid === userId;
        const attempt = await runActivityStartupStage('verification', signal => {
            if (!isCurrent()) throw createRequestError('Activity launch changed.', 'REQUEST_ABORTED');
            return studentApi.startStudentActivityAttempt({
                unitKey,
                vocabularyId,
                activityType,
                signal
            }, { ownerUserId: userId });
        }, options);
        if (!isCurrent()) return null;
        if (!attempt?.attemptId) throw new Error('The server did not create a verified activity attempt.');
        this.activities.session.activityAttempt = attempt;
        return attempt;
    }

    buildActivityProgressPayload(activityType, scoreData = {}, settings = {}) {
        const unitProgress = this.activities.getCurrentUnitProgress();
        if (!unitProgress || !this.sm.currentVocab) return null;
        const flow = this.activities.getActivityFlowConfig(this.sm.currentVocab);
        const metrics = this.getActivityAttemptMetrics(activityType, scoreData);
        const evidence = this.sanitizeActivityEvidence(activityType, scoreData.evidence);
        const stateSnapshot = this.persistence.sanitizeActivityState(
            this.sm.unitStates?.[activityType] ?? unitProgress.states?.[activityType] ?? null
        );
        return {
            eventId: createUniqueId('activity-progress:'),
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
            activeSeconds: this.activities.session.getActivityTimeSnapshot?.().activeSeconds || 0,
            timeLimitSeconds: this.activities.session.getActivityTimeSnapshot?.().timeLimitSeconds || null,
            score: Number(scoreData.score) || 0,
            isComplete: Boolean(scoreData.isComplete),
            isFinished: this.isActivityAttemptFinished(activityType, scoreData),
            details: {
                summary: typeof scoreData.details === 'string' ? scoreData.details : '',
                evidence,
                accuracy: Number(scoreData.accuracy) || 0
            },
            metrics,
            stateSnapshot: stateSnapshot === undefined ? null : stateSnapshot,
            activitySettings: {
                progressReward: settings.progressReward,
                completionBonus: settings.completionBonus
            },
            clientId: this.sm.progress?.clientId || ''
        };
    }

    sanitizeActivityEvidence(activityType, sourceEvidence) {
        const evidence = sourceEvidence && typeof sourceEvidence === 'object'
            ? { ...sourceEvidence }
            : {};
        if (activityType !== 'flashcards') return evidence;

        const correct = Number(evidence.firstAttemptCorrectCount);
        const attempted = Number(evidence.attemptedCount);
        const validAccuracyCounts = Number.isInteger(correct)
            && Number.isInteger(attempted)
            && correct >= 0
            && attempted > 0
            && correct <= attempted;
        if (!validAccuracyCounts) {
            delete evidence.firstAttemptCorrectCount;
            delete evidence.attemptedCount;
        }
        return evidence;
    }

    async reportActiveTime(snapshot = this.activities.session.getActivityTimeSnapshot?.() || {}) {
        const attemptId = String(snapshot.attemptId || this.activities.session.activityAttempt?.attemptId || '');
        if (!attemptId || this.sm.authDisabled || !this.sm.currentUser) return null;

        const result = await studentApi.reportStudentActivityTime({
            attemptId,
            activeSeconds: Math.max(0, Math.floor(Number(snapshot.activeSeconds) || 0))
        });
        if (this.activities.session.activityAttempt?.attemptId === attemptId && result) {
            Object.assign(this.activities.session.activityAttempt, result);
            this.activities.session.workTimer?.render?.();
        }
        return result;
    }

    getActivityAttemptMetrics(activityType, scoreData = {}) {
        const evidence = scoreData.evidence && typeof scoreData.evidence === 'object'
            ? scoreData.evidence
            : {};
        const integer = value => {
            const number = Number(value);
            return Number.isInteger(number) && number >= 0 ? number : null;
        };
        let correctActions = null;
        let attemptedActions = null;

        if (['quiz', 'synonym-antonym'].includes(activityType)) {
            correctActions = integer(evidence.correctCount);
            attemptedActions = integer(evidence.answeredCount);
        } else if (activityType === 'flashcards') {
            correctActions = integer(evidence.firstAttemptCorrectCount);
            attemptedActions = integer(evidence.attemptedCount);
        } else if (activityType === 'matching' || activityType === 'scramble') {
            correctActions = integer(evidence.correctCount);
            attemptedActions = integer(evidence.attemptedCount);
        } else if (activityType === 'wordle') {
            correctActions = integer(evidence.correctCount);
            const failedCount = integer(evidence.failedCount);
            attemptedActions = correctActions === null || failedCount === null
                ? null
                : correctActions + failedCount;
        }

        if (correctActions === null || attemptedActions === null || attemptedActions <= 0
            || correctActions > attemptedActions) {
            return {};
        }
        return { correctActions, attemptedActions };
    }

    isActivityAttemptFinished(activityType, scoreData = {}) {
        if (scoreData.isFinished !== undefined) return Boolean(scoreData.isFinished);
        if (scoreData.isComplete) return true;
        const evidence = scoreData.evidence && typeof scoreData.evidence === 'object'
            ? scoreData.evidence
            : {};
        const total = Number(evidence.totalCount);
        if (!(total > 0)) return false;
        if (['quiz', 'synonym-antonym'].includes(activityType)) {
            return Number(evidence.answeredCount) >= total;
        }
        if (activityType === 'scramble') return Number(evidence.attemptedCount) >= total;
        if (activityType === 'wordle') {
            return Number(evidence.correctCount) + Number(evidence.failedCount) >= total;
        }
        return false;
    }
}
