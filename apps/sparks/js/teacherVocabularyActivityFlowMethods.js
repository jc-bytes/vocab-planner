import { $, notifications } from './main.js';
import {
    normalizeActivityRewardSetting,
    resolveActivityCoinRewards
} from './gamificationConfig.js';
import {
    VOCAB_ACTIVITY_IDS,
    VOCAB_ACTIVITY_SETTING_KEYS
} from './teacherVocabularyEditorConstants.js';
import {
    getDefaultRequiredActivities as resolveDefaultRequiredActivities,
    getPracticeRequiredRotationIndex as resolvePracticeRequiredRotationIndex
} from './activityFlowPolicy.js';

class TeacherVocabularyActivityFlowMethods {
    getDefaultRequiredActivities(vocab = this.vocabSet) {
        return resolveDefaultRequiredActivities(vocab);
    }

    getPracticeRequiredRotationIndex(vocab = this.vocabSet) {
        return resolvePracticeRequiredRotationIndex(vocab);
    }

    getActivityFlowConfig(vocab = this.vocabSet) {
        const settings = vocab?.activitySettings || {};
        const validIds = new Set(VOCAB_ACTIVITY_IDS);
        const hasExplicitFlow = Array.isArray(settings.requiredActivities) || Array.isArray(settings.additionalActivities);
        const defaultRequired = this.getDefaultRequiredActivities(vocab).filter(id => validIds.has(id));
        const requestedRequired = hasExplicitFlow ? settings.requiredActivities : defaultRequired;
        const required = (Array.isArray(requestedRequired) ? requestedRequired : defaultRequired)
            .filter(id => validIds.has(id));
        const uniqueRequired = [...new Set([
            'flashcards',
            ...required.filter(id => id !== 'flashcards')
        ])];
        const requiredSet = new Set(uniqueRequired);
        const requestedAdditional = hasExplicitFlow
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

    normalizeActivityFlowSettings(vocab = this.vocabSet) {
        if (!vocab.activitySettings) vocab.activitySettings = {};
        const flow = this.getActivityFlowConfig(vocab);
        vocab.activitySettings.requiredActivities = flow.required;
        vocab.activitySettings.additionalActivities = flow.additional;
        return flow;
    }

    setActivityFlowChoice(activityId, choice) {
        if (!VOCAB_ACTIVITY_IDS.includes(activityId)) return;
        if (!['required', 'additional', 'hidden'].includes(choice)) return;
        if (activityId === 'flashcards' && choice !== 'required') {
            notifications.warning('Flashcards must remain Step 1 in the required path.');
            this.renderActivityFlowSettings();
            return;
        }
        if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};

        const flow = this.getActivityFlowConfig(this.vocabSet);
        let required = flow.required.filter(id => id !== activityId);
        let additional = flow.additional.filter(id => id !== activityId);

        if (choice === 'required') {
            required.push(activityId);
        } else if (choice === 'additional') {
            additional.push(activityId);
        }

        if (required.length === 0) {
            notifications.warning('At least one required activity is needed.');
            required = [activityId];
            additional = additional.filter(id => id !== activityId);
        }

        this.vocabSet.activitySettings.requiredActivities = [...new Set(required)];
        this.vocabSet.activitySettings.additionalActivities = [...new Set(additional)];
        this.renderActivityFlowSettings();
        this.renderWords();
        this.triggerAutoSave();
        this.updateVocabularyEditorSummary();
    }

    setActivityWordCount(activityId, value) {
        const settingKey = VOCAB_ACTIVITY_SETTING_KEYS[activityId];
        if (!settingKey) return;
        if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};

        const parsedValue = Number.parseInt(value, 10);
        if (Number.isFinite(parsedValue) && parsedValue > 0) {
            this.vocabSet.activitySettings[settingKey] = parsedValue;
        } else {
            delete this.vocabSet.activitySettings[settingKey];
        }

        this.triggerAutoSave();
    }

    getActivityTimeLimit(activityId) {
        const value = Number(this.vocabSet?.activitySettings?.activityTimeLimits?.[activityId]);
        return Number.isInteger(value) && value > 0 ? value : null;
    }

    setActivityTimeLimit(activityId, value) {
        if (!VOCAB_ACTIVITY_IDS.includes(activityId)) return;
        if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};

        const parsedValue = Number.parseInt(value, 10);
        if (Number.isInteger(parsedValue) && parsedValue >= 1 && parsedValue <= 480) {
            this.vocabSet.activitySettings.activityTimeLimits ||= {};
            this.vocabSet.activitySettings.activityTimeLimits[activityId] = parsedValue;
        } else if (value === '' || !Number.isFinite(parsedValue) || parsedValue <= 0) {
            if (this.vocabSet.activitySettings.activityTimeLimits) {
                delete this.vocabSet.activitySettings.activityTimeLimits[activityId];
                if (Object.keys(this.vocabSet.activitySettings.activityTimeLimits).length === 0) {
                    delete this.vocabSet.activitySettings.activityTimeLimits;
                }
            }
        } else {
            notifications.warning('Activity time must be between 1 and 480 minutes.');
            this.renderActivityFlowSettings();
            return;
        }

        this.triggerAutoSave();
    }

    setWordHuntTextPasteAllowed(value) {
        if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
        this.vocabSet.activitySettings.wordHuntAllowTextPaste = value === true || value === 'allow';
        this.triggerAutoSave();
    }

    getActivityRewardSettings(activityId) {
        const settings = this.vocabSet?.activitySettings || {};
        return resolveActivityCoinRewards(settings, activityId);
    }

    setActivityRewardSetting(activityId, field, value) {
        if (!VOCAB_ACTIVITY_IDS.includes(activityId)) return;
        if (!['completionBonus', 'progressReward'].includes(field)) return;
        if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
        if (!this.vocabSet.activitySettings.activityRewards) {
            this.vocabSet.activitySettings.activityRewards = {};
        }
        if (!this.vocabSet.activitySettings.activityRewards[activityId]) {
            this.vocabSet.activitySettings.activityRewards[activityId] = {};
        }

        this.vocabSet.activitySettings.activityRewards[activityId][field] =
            normalizeActivityRewardSetting(field, value);

        this.triggerAutoSave();
    }

    async renderActivityFlowSettings() {
        if (!$('#activity-flow-settings')) return;
        const document = this.vocabSet;
        const owner = this.currentUser?.uid || this.currentUser?.id;
        const generation = this.teacherVocabularyDocumentGeneration;
        try {
            const { renderActivitySettings } = await import('./teacherActivitySettingsView.js');
            if (document !== this.vocabSet || generation !== this.teacherVocabularyDocumentGeneration
                || owner !== (this.currentUser?.uid || this.currentUser?.id)) return;
            renderActivitySettings.call(this);
        } catch (error) {
            console.error('Could not load activity settings:', error);
            notifications.error('Activity settings could not load. Reopen the editor to retry.');
        }
    }

}

export function installTeacherVocabularyActivityFlowMethods(TeacherManager) {
    for (const name of Object.getOwnPropertyNames(TeacherVocabularyActivityFlowMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherVocabularyActivityFlowMethods.prototype, name)
        );
    }
}
