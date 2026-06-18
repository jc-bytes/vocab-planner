import { $, createElement } from '../main.js';
import { getCurrentSchoolYear, getVocabSubjectSlug } from '../services/vocabularyApi.js';
import {
    DEFAULT_PRACTICE_REQUIRED_ROTATION,
    DEFAULT_REQUIRED_BY_PURPOSE,
    VOCAB_ACTIVITY_IDS
} from './studentActivityConstants.js';

class StudentActivityProgressFlowMethods {
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
            trimester: this.getVocabTrimesterKey(vocab),
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
        switch (activityType) {
            case 'matching':
                return words.filter(word => String(word.word || '').length >= 2).length;
            case 'synonym-antonym':
                return words.filter(word => (
                    word.synonyms?.length > 0 || word.antonyms?.length > 0
                )).length;
            case 'word-search':
                return words.filter(word => String(word.word || '').length >= 4).length;
            case 'crossword':
                return words.filter(word => (
                    String(word.word || '').length > 1 &&
                    /^[a-zA-Z]+$/.test(String(word.word || ''))
                )).length;
            case 'wordle':
                return words.filter(word => {
                    const label = String(word.word || '');
                    const cleanWord = label.replace(/[^a-zA-Z]/g, '');
                    return /^[a-zA-Z\s-]+$/.test(label) && cleanWord.length >= 3 && cleanWord.length <= 10;
                }).length;
            case 'fill-in-blank':
                return words.filter(word => word.example).length;
            case 'flashcards':
            case 'quiz':
            case 'illustration':
            case 'hangman':
            case 'scramble':
            case 'speed-match':
                return words.length;
            default:
                return 0;
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
        let uniqueRequired = [...new Set(required)];
        if (!uniqueRequired.includes('flashcards')) {
            uniqueRequired.unshift('flashcards');
        }
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
        if (!scoreData) return false;
        return Boolean(scoreData.isComplete) || (Number(scoreData.score) || 0) >= 100;
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
        if (flow.required.includes(activityType)) return true;
        if (!flow.additional.includes(activityType)) return false;
        return this.getRequiredCompletion(flow).isComplete;
    }

    updateActivityGateDisplay(cards, flow = this.getActivityFlowConfig()) {
        const grid = document.querySelector('#activity-menu-view .activities-grid');
        if (!grid) return;

        const completion = this.getRequiredCompletion(flow);
        const allCards = Array.from(cards);
        const cardByType = new Map(allCards.map(card => [card.dataset.activity, card]));
        const nextActivityType = completion.isComplete
            ? null
            : flow.required.find(activityType => !this.isActivityComplete(activityType));
        const status = $('#required-activities-status');
        if (status) status.remove();

        const staleHeaderCoverage = document.querySelector('#activity-menu-view .section-header #overall-coverage-indicator');
        if (staleHeaderCoverage) staleHeaderCoverage.remove();

        allCards.forEach(card => card.remove());
        grid.querySelectorAll('.activity-flow-section').forEach(section => section.remove());
        grid.style.display = 'block';

        const createSection = (title, className, description = '') => {
            const section = createElement('section', `activity-flow-section ${className}`);
            const headingBlock = createElement('div', 'activity-flow-heading');
            const heading = createElement('h3', null, title);
            headingBlock.appendChild(heading);
            if (description) headingBlock.appendChild(createElement('p', null, description));
            const innerGrid = createElement('div', 'activities-grid-inner');
            section.appendChild(headingBlock);
            section.appendChild(innerGrid);
            grid.appendChild(section);
            return innerGrid;
        };

        const requiredGrid = createSection(
            'Required Path',
            'required-activity-section',
            'Complete these activities to unlock the full practice library.'
        );
        requiredGrid.classList.add('required-activity-path');
        requiredGrid.style.setProperty('--required-count', Math.max(flow.required.length, 1));
        const pathTrack = createElement('div', 'required-path-track');
        const pathTrackFill = createElement('span');
        pathTrack.style.setProperty(
            '--path-progress',
            `${completion.total > 0 ? (completion.completed / completion.total) * 100 : 0}%`
        );
        pathTrack.appendChild(pathTrackFill);
        requiredGrid.appendChild(pathTrack);
        const additionalDetails = createElement('details', 'activity-flow-section additional-activity-section activity-secondary-disclosure');
        additionalDetails.open = true;
        const additionalSummary = createElement(
            'summary',
            null,
            completion.isComplete
                ? `Additional Practice (${flow.additional.length})`
                : `Additional Practice (${flow.additional.length}) · locked`
        );
        const additionalGrid = createElement('div', 'activities-grid-inner activity-secondary-grid');
        additionalDetails.appendChild(additionalSummary);
        if (!completion.isComplete) {
            additionalDetails.appendChild(createElement(
                'p',
                'activity-disclosure-note',
                'Finish the required activities first. These are still listed here so you can see what unlocks next.'
            ));
        }
        additionalDetails.appendChild(additionalGrid);

        const unavailableDetails = createElement('details', 'activity-flow-section unavailable-activity-section activity-secondary-disclosure');
        unavailableDetails.open = false;
        const unavailableSummary = createElement('summary', null, `Not Required (${flow.hidden.length})`);
        const unavailableGrid = createElement('div', 'activities-grid-inner activity-secondary-grid activity-unavailable-grid');
        unavailableDetails.appendChild(unavailableSummary);
        unavailableDetails.appendChild(createElement(
            'p',
            'activity-disclosure-note',
            'These activities are visible for reference but are not part of this vocabulary unit.'
        ));
        unavailableDetails.appendChild(unavailableGrid);

        const prepareCard = (card) => {
            if (!card) return;
            const activityType = card.dataset.activity;
            const isRequired = flow.required.includes(activityType);
            const isAdditional = flow.additional.includes(activityType);
            const isHidden = flow.hidden.includes(activityType);
            const isLockedAdditional = isAdditional && !completion.isComplete;
            card.classList.toggle('required-activity-card', isRequired);
            card.classList.toggle('additional-activity-card', isAdditional);
            card.classList.toggle('activity-locked-card', isLockedAdditional);
            card.classList.toggle('activity-unavailable-card', isHidden);
            const isNext = activityType === nextActivityType;
            const isComplete = this.isActivityComplete(activityType);
            card.classList.toggle('next-activity-card', isNext);
            card.classList.toggle('activity-flow-card-compact', !isNext);
            card.classList.toggle('activity-path-complete', isRequired && isComplete);
            card.disabled = isHidden;
            card.setAttribute('aria-disabled', isHidden ? 'true' : 'false');
            card.title = isHidden
                ? 'Not required for this vocabulary unit.'
                : (isLockedAdditional ? 'Finish the required activities to unlock this practice.' : '');

            if (isNext && !card.querySelector('.next-activity-label')) {
                card.prepend(createElement('span', 'next-activity-label', 'Next'));
            }
            if (isHidden && !card.querySelector('.activity-unavailable-label')) {
                card.prepend(createElement('span', 'activity-unavailable-label', 'Not required'));
            }
            if (isLockedAdditional && !card.querySelector('.activity-lock-label')) {
                card.prepend(createElement('span', 'activity-lock-label', 'Locked'));
            }
            if (isRequired) {
                const statusText = isComplete ? 'Complete' : (isNext ? 'Next' : 'Ready');
                card.appendChild(createElement('span', 'activity-path-status', statusText));
            }
        };

        flow.required.forEach(activityType => {
            const card = cardByType.get(activityType);
            prepareCard(card);
            if (card) requiredGrid.appendChild(card);
        });

        flow.additional.forEach(activityType => {
            const card = cardByType.get(activityType);
            prepareCard(card);
            if (card) additionalGrid.appendChild(card);
        });

        if (flow.additional.length > 0) grid.appendChild(additionalDetails);

        flow.hidden.forEach(activityType => {
            const card = cardByType.get(activityType);
            prepareCard(card);
            if (card) unavailableGrid.appendChild(card);
        });

        if (flow.hidden.length > 0) grid.appendChild(unavailableDetails);
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

        this.scheduleIdleTask(() => {
            this.loadActivityClass(activityType).catch(() => {});
        }, 900);
    }
}

export function installStudentActivityProgressFlowMethods(StudentActivities) {
    for (const name of Object.getOwnPropertyNames(StudentActivityProgressFlowMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentActivityProgressFlowMethods.prototype, name)
        );
    }
}
