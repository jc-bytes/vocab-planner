import { StudentActivityGateDisplay } from './studentActivityGateDisplay.js';
import { getCurrentSchoolYear, getVocabSubjectSlug } from '../services/vocabularyApi.js';
import {
    DEFAULT_PRACTICE_REQUIRED_ROTATION,
    DEFAULT_REQUIRED_BY_PURPOSE,
    VOCAB_ACTIVITY_IDS
} from './studentActivityConstants.js';

export class StudentActivityProgressFlow {
    constructor(activities) {
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

    getWordHuntWords(settings = {}) {
        if (!this.sm.currentVocab?.words) return [];

        const flow = this.getActivityFlowConfig(this.sm.currentVocab);
        const wordHuntIsRequired = flow.required.includes('illustration');
        const customSelection = settings.wordHuntSelectionMode === 'custom';
        if (wordHuntIsRequired && !customSelection) {
            return [...this.sm.currentVocab.words];
        }

        const selectedWords = this.sm.currentVocab.words.filter(word => (
            word.wordHunt === true ||
            word.wordHunt === 'true' ||
            word.word_hunt === true
        ));
        if (selectedWords.length > 0) {
            return selectedWords;
        }

        const fallbackLimit = settings.illustration || this.sm.currentVocab.words.length;
        return this.sm.currentVocab.words.slice(0, fallbackLimit);
    }

    getDefaultRequiredActivities(vocab = this.sm.currentVocab) {
        const purpose = String(vocab?.purpose || '').trim().toLowerCase();
        if (purpose === 'practice') {
            const rotationIndex = this.getPracticeRequiredRotationIndex(vocab);
            return DEFAULT_PRACTICE_REQUIRED_ROTATION[rotationIndex] || DEFAULT_REQUIRED_BY_PURPOSE.practice;
        }
        return DEFAULT_REQUIRED_BY_PURPOSE[purpose] || DEFAULT_REQUIRED_BY_PURPOSE.default;
    }

    getPracticeRequiredRotationIndex(vocab = this.sm.currentVocab) {
        const rotationLength = DEFAULT_PRACTICE_REQUIRED_ROTATION.length;
        if (rotationLength === 0) return 0;

        const week = Number(vocab?.week);
        if (Number.isFinite(week) && week > 0) {
            return (Math.floor(week) - 1) % rotationLength;
        }

        const unitKey = String(vocab?.id || vocab?.name || '');
        const weekMatch = unitKey.match(/week[_-]?(\d+)/i);
        if (weekMatch) {
            return (Number(weekMatch[1]) - 1) % rotationLength;
        }

        let hash = 0;
        for (let index = 0; index < unitKey.length; index += 1) {
            hash = ((hash << 5) - hash + unitKey.charCodeAt(index)) | 0;
        }
        return Math.abs(hash) % rotationLength;
    }

    getActivityPlayableCount(activityType, vocab = this.sm.currentVocab) {
        const words = Array.isArray(vocab?.words) ? vocab.words : [];
        return words.filter(word => this.isActivityWordPlayable(activityType, word)).length;
    }

    isActivityWordPlayable(activityType, word = {}) {
        switch (activityType) {
            case 'matching':
                return (
                    String(word.word || '').trim().length >= 2
                    && String(word.definition || '').trim().length > 0
                );
            case 'synonym-antonym':
                return (
                    String(word.word || '').trim().length > 0
                    && (word.synonyms?.length > 0 || word.antonyms?.length > 0)
                );
            case 'word-search':
                return String(word.word || '').trim().length >= 4;
            case 'crossword':
                return (
                    String(word.word || '').length > 1 &&
                    /^[a-zA-Z]+$/.test(String(word.word || ''))
                    && String(word.definition || '').trim().length > 0
                );
            case 'wordle':
                {
                    const label = String(word.word || '');
                    const cleanWord = label.replace(/[^a-zA-Z]/g, '');
                    return /^[a-zA-Z\s-]+$/.test(label) && cleanWord.length >= 3 && cleanWord.length <= 10;
                }
            case 'fill-in-blank':
                return (
                    String(word.word || '').trim().length > 0
                    && String(word.example || '').trim().length > 0
                );
            case 'flashcards':
            case 'quiz':
            case 'speed-match':
                return (
                    String(word.word || '').trim().length > 0
                    && String(word.definition || '').trim().length > 0
                );
            case 'illustration':
            case 'hangman':
            case 'scramble':
                return String(word.word || '').trim().length > 0;
            default:
                return false;
        }
    }

    getRequiredActivityMinimum(vocab = this.sm.currentVocab) {
        const wordCount = Array.isArray(vocab?.words) ? vocab.words.length : 0;
        return Math.min(4, wordCount);
    }

    isActivitySuitableForRequired(activityType, vocab = this.sm.currentVocab) {
        const minimum = this.getRequiredActivityMinimum(vocab);
        if (minimum <= 0) return activityType === 'flashcards';
        return this.getActivityPlayableCount(activityType, vocab) >= minimum;
    }

    replaceUnsuitableRequiredActivities(requiredActivities, vocab = this.sm.currentVocab, validIds = new Set(VOCAB_ACTIVITY_IDS)) {
        const replacementOrder = [
            'word-search',
            'matching',
            'scramble',
            'hangman',
            'quiz',
            'speed-match',
            'synonym-antonym',
            'fill-in-blank',
            'flashcards'
        ].filter(activityType => validIds.has(activityType));
        const selected = [];

        requiredActivities.forEach(activityType => {
            if (this.isActivitySuitableForRequired(activityType, vocab) && !selected.includes(activityType)) {
                selected.push(activityType);
                return;
            }

            const replacement = replacementOrder.find(candidate => (
                !selected.includes(candidate) &&
                !requiredActivities.includes(candidate) &&
                this.isActivitySuitableForRequired(candidate, vocab)
            ));

            selected.push(replacement || activityType);
        });

        return [...new Set(selected)];
    }

    getActivityFlowConfig(vocab = this.sm.currentVocab) {
        const settings = vocab?.activitySettings || {};
        const validIds = new Set(VOCAB_ACTIVITY_IDS);
        const hasExplicitRequired = Array.isArray(settings.requiredActivities);
        const hasExplicitAdditional = Array.isArray(settings.additionalActivities);
        const defaultRequired = this.getDefaultRequiredActivities(vocab).filter(id => validIds.has(id));
        const requestedRequired = hasExplicitRequired ? settings.requiredActivities : defaultRequired;
        const required = (Array.isArray(requestedRequired) ? requestedRequired : defaultRequired)
            .filter(id => validIds.has(id));
        let uniqueRequired = [
            'flashcards',
            ...required.filter(id => id !== 'flashcards')
        ];
        uniqueRequired = [...new Set(uniqueRequired)];
        if (!hasExplicitRequired) {
            uniqueRequired = this.replaceUnsuitableRequiredActivities(uniqueRequired, vocab, validIds);
        }
        const requiredSet = new Set(uniqueRequired);
        const requestedAdditional = hasExplicitAdditional
            ? settings.additionalActivities
            : VOCAB_ACTIVITY_IDS.filter(id => !requiredSet.has(id));
        const additional = (Array.isArray(requestedAdditional) ? requestedAdditional : [])
            .filter(id => validIds.has(id) && !requiredSet.has(id));
        const uniqueAdditional = [...new Set(additional)];

        return {
            required: uniqueRequired,
            additional: uniqueAdditional,
            hidden: VOCAB_ACTIVITY_IDS.filter(id => !uniqueRequired.includes(id) && !uniqueAdditional.includes(id))
        };
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
            isComplete: flow.required.length > 0 && completed >= flow.required.length,
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
            .filter(vocab => this.activities.getVocabTrimesterKey(vocab) === currentTrimester);

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
            isComplete: flow.required.length > 0 && completed >= flow.required.length
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
                import('./studentFeatureStyles.js'),
                this.activities.moduleLoader.loadActivityClass(activityType)
            ]).catch(() => {});
        }, 900);
    }
}
