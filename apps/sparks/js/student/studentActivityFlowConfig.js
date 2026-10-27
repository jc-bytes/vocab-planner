import { weeklySettings, weeklyWordPlayable } from './weeklyVocabularyPolicy.js';
import { VOCAB_ACTIVITY_IDS } from './studentActivityConstants.js';
import { getStudentActivity } from './studentActivityRegistry.js';
import {
    getDefaultRequiredActivities as resolveDefaultRequiredActivities,
    getPracticeRequiredRotationIndex as resolvePracticeRequiredRotationIndex,
    REQUIRED_ACTIVITY_REPLACEMENT_ORDER
} from '../activityFlowPolicy.js';

export class StudentActivityFlowConfig {
    getDefaultRequiredActivities(vocab = this.sm.currentVocab) {
        return resolveDefaultRequiredActivities(vocab);
    }

    getPracticeRequiredRotationIndex(vocab = this.sm.currentVocab) {
        return resolvePracticeRequiredRotationIndex(vocab);
    }

    getActivityPlayableCount(activityType, vocab = this.sm.currentVocab) {
        const words = Array.isArray(vocab?.words) ? vocab.words : [];
        return words.filter(word => weeklyWordPlayable(activityType, word, vocab, getStudentActivity(activityType)?.isPlayable)).length;
    }

    isActivityWordPlayable(activityType, word = {}) {
        const descriptor = getStudentActivity(activityType);
        if (descriptor?.isPlayable) {
            return weeklyWordPlayable(activityType, word, this.sm.currentVocab, descriptor.isPlayable);
        }

        return false;
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
        const replacementOrder = REQUIRED_ACTIVITY_REPLACEMENT_ORDER
            .filter(activityType => validIds.has(activityType));
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
            ...(weeklySettings(vocab)?.reviewOnly ? [] : ['flashcards']),
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

}
