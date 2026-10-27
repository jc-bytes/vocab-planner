import { StudentActivityFlowConfig } from './studentActivityFlowConfig.js';
import { loadStudentFeatureStyles } from './studentFeatureStyleLoader.js';
import { weeklySettings, weeklyWordPlayable, isVocabularyProjectBreak } from './weeklyVocabularyPolicy.js';
import { StudentActivityGateDisplay } from './studentActivityGateDisplay.js';
import { getCurrentSchoolYear, getVocabSubjectSlug } from '../services/vocabularyApi.js';
import { VOCAB_ACTIVITY_IDS } from './studentActivityConstants.js';
import { getStudentActivity } from './studentActivityRegistry.js';

export class StudentActivityProgressFlow extends StudentActivityFlowConfig {
    constructor(activities) {
        super();
        this.activities = activities;
        this.sm = activities.sm;
        this.activityPreloadKeys = new Set();
        this.gateDisplay = new StudentActivityGateDisplay(this);
    }

    getUnitGrade(vocab = this.sm.currentVocab) {
        const profileGrade = this.sm.studentProfile?.grade;
        if (profileGrade) return String(profileGrade);
        if (Array.isArray(vocab?.grades) && vocab.grades.length > 0) return String(vocab.grades[0]);
        if (vocab?.grade) return String(vocab.grade);
        return '';
    }

    getUnitProgressKey(vocab = this.sm.currentVocab) {
        if (vocab?.assignmentId) return `assignment:${vocab.assignmentId}`;
        const unitId = this.sm.getVocabRouteId(vocab) || vocab?.id || vocab?.name || 'unit';
        return `${getVocabSubjectSlug(vocab)}:${unitId}`;
    }

    ensureUnitProgress(vocab = this.sm.currentVocab) {
        if (!vocab) return null;
        if (!this.sm.progressData.units) this.sm.progressData.units = {};

        const progressKey = this.getUnitProgressKey(vocab);
        const legacyProgress = this.sm.progressData.units[vocab.name] || {};
        const existing = this.sm.progressData.units[progressKey] || (
            getVocabSubjectSlug(vocab) === 'technology' ? legacyProgress : {}
        );
        const unitProgress = {
            ...existing,
            unitId: this.sm.getVocabRouteId(vocab),
            unitName: vocab.name || '',
            subjectSlug: getVocabSubjectSlug(vocab),
            trimester: this.activities.schedule.getVocabTrimesterKey(vocab),
            schoolYear: existing.schoolYear || getCurrentSchoolYear(),
            grade: this.getUnitGrade(vocab),
            scores: existing.scores || {},
            images: existing.images || {},
            wordHunt: existing.wordHunt || {},
            states: existing.states || {}
        };

        this.sm.progressData.units[progressKey] = unitProgress;
        return unitProgress;
    }

    getCurrentUnitProgress() {
        if (!this.sm.currentVocab) return null;
        return this.ensureUnitProgress(this.sm.currentVocab);
    }

    restoreWordsFromState(initialState, fallbackWords, filter = null) {
        const wordKeys = Array.isArray(initialState?.wordKeys) ? initialState.wordKeys : null;
        if (!wordKeys || wordKeys.length === 0 || !this.sm.currentVocab?.words) {
            return fallbackWords;
        }

        const eligibleWords = filter
            ? this.sm.currentVocab.words.filter(filter)
            : this.sm.currentVocab.words;
        const wordsByKey = new Map(eligibleWords.map(word => [word.word, word]));
        const restoredWords = wordKeys.map(wordKey => wordsByKey.get(wordKey)).filter(Boolean);

        return restoredWords.length === wordKeys.length ? restoredWords : fallbackWords;
    }

    isActivityComplete(activityType) {
        const scoreData = this.sm.unitScores?.[activityType];
        return this.isActivityScoreComplete(scoreData);
    }

    isActivityScoreComplete(scoreData) {
        if (!scoreData) return false;
        const completed = Boolean(scoreData.isComplete) || (Number(scoreData.score) || 0) >= 100;
        if (!completed) return false;
        if (this.sm.authDisabled || !this.sm.currentUser) return true;
        return scoreData.verified === true;
    }

    getUnitScores(vocab) {
        if (!vocab) return {};
        const progressKey = this.getUnitProgressKey(vocab);
        const unitProgress = this.sm.progressData?.units?.[progressKey]
            || this.sm.progressData?.units?.[vocab.name]
            || {};
        return unitProgress.scores || {};
    }

    getUnitRequiredCompletion(vocab) {
        const flow = this.getActivityFlowConfig(vocab);
        const scores = this.getUnitScores(vocab);
        const completed = flow.required.filter(activityType => (
            this.isActivityScoreComplete(scores[activityType])
        )).length;
        const nextActivityType = flow.required.find(activityType => (
            !this.isActivityScoreComplete(scores[activityType])
        )) || null;

        return {
            completed,
            total: flow.required.length,
            isComplete: (flow.required.length > 0 || weeklySettings(vocab)?.reviewOnly) && completed >= flow.required.length,
            nextActivityType,
            remaining: Math.max(0, flow.required.length - completed),
            flow,
            scores
        };
    }

    getPendingRequiredWork(date = new Date()) {
        const currentTrimester = this.activities.getCurrentTrimesterKey(date);
        const vocabs = this.activities
            .filterStudentAvailableVocabulary(this.activities.getGradeMatchedVocabularySources(), date)
            .filter(vocab => this.activities.getVocabTrimesterKey(vocab) === currentTrimester)
            .filter(vocab => !vocab.activitySettings?.retiredWeeklySet && !weeklySettings(vocab)?.reviewOnly && !isVocabularyProjectBreak(date));

        const units = vocabs
            .map(vocab => {
                const completion = this.getUnitRequiredCompletion(vocab);
                const schedule = this.activities.getVocabSchedule(vocab, date);
                return {
                    vocab,
                    completion,
                    schedule,
                    routeId: this.sm.getVocabRouteId?.(vocab) || vocab.id || vocab.name || ''
                };
            })
            .filter(item => !item.completion.isComplete)
            .sort((a, b) => {
                const aTime = a.schedule.dueDate?.getTime?.() || 0;
                const bTime = b.schedule.dueDate?.getTime?.() || 0;
                if (aTime !== bTime) {
                    if (!aTime) return 1;
                    if (!bTime) return -1;
                    return aTime - bTime;
                }
                return String(a.vocab.name || '').localeCompare(String(b.vocab.name || ''));
            });

        const vocabularyRemainingActivities = units.reduce((total, item) => total + item.completion.remaining, 0);
        const sparkWork = this.activities.getCurrentSparkGateWork?.() || null;
        const remainingSparkQuestions = sparkWork?.remaining || 0;
        const remainingActivities = vocabularyRemainingActivities + remainingSparkQuestions;
        return {
            isBlocked: units.length > 0 || Boolean(sparkWork),
            unitCount: units.length,
            remainingActivities,
            vocabularyRemainingActivities,
            remainingSparkQuestions,
            spark: sparkWork,
            units,
            next: sparkWork ? { kind: 'spark', ...sparkWork } : (units[0] || null)
        };
    }

    getRequiredCompletion(flow = this.getActivityFlowConfig()) {
        const completed = flow.required.filter(activityType => this.isActivityComplete(activityType)).length;
        return {
            completed,
            total: flow.required.length,
            isComplete: (flow.required.length > 0 || weeklySettings(this.sm.currentVocab)?.reviewOnly) && completed >= flow.required.length
        };
    }

    isActivityUnlocked(activityType) {
        const flow = this.getActivityFlowConfig();
        if (flow.required.includes(activityType)) {
            if (this.isActivityComplete(activityType)) return true;
            const activityIndex = flow.required.indexOf(activityType);
            return flow.required
                .slice(0, activityIndex)
                .every(requiredType => this.isActivityComplete(requiredType));
        }
        if (!flow.additional.includes(activityType)) return false;
        return this.getRequiredCompletion(flow).isComplete;
    }

    updateActivityGateDisplay(cards, flow = this.getActivityFlowConfig()) {
        return this.gateDisplay.updateActivityGateDisplay(cards, flow);
    }

    updateArcadeGateDisplay(status = this.getPendingRequiredWork()) {
        return this.gateDisplay.updateArcadeGateDisplay(status);
    }

    getNextActivityPreloadType(flow = this.getActivityFlowConfig()) {
        const completion = this.getRequiredCompletion(flow);

        if (completion.isComplete) {
            return flow.additional.find(activityType => this.isActivityUnlocked(activityType)) || null;
        }

        return flow.required.find(activityType => !this.isActivityComplete(activityType))
            || flow.required.find(activityType => this.isActivityUnlocked(activityType))
            || null;
    }

    scheduleActivityPreload(flow = this.getActivityFlowConfig()) {
        const activityType = this.getNextActivityPreloadType(flow);
        if (!activityType) return;

        const vocabId = this.sm.getCurrentVocabRouteId() || this.sm.currentVocab?.name || 'current';
        const key = `${vocabId}:${activityType}`;
        if (this.activityPreloadKeys.has(key)) return;
        this.activityPreloadKeys.add(key);

        this.activities.calendar.scheduleIdleTask(() => {
            Promise.all([
                loadStudentFeatureStyles(),
                this.activities.moduleLoader.loadActivityClass(activityType)
            ]).catch(() => {});
        }, 900);
    }
}
