import { $, createElement, notifications } from './main.js';
import {
    DEFAULT_PRACTICE_REQUIRED_ROTATION,
    DEFAULT_REQUIRED_BY_PURPOSE,
    VOCAB_ACTIVITY_IDS,
    VOCAB_ACTIVITY_OPTIONS,
    VOCAB_ACTIVITY_SETTING_KEYS
} from './teacherVocabularyEditorConstants.js';

class TeacherVocabularyActivityFlowMethods {
    getDefaultRequiredActivities(vocab = this.vocabSet) {
        const purpose = String(vocab?.purpose || '').trim().toLowerCase();
        if (purpose === 'practice') {
            const rotationIndex = this.getPracticeRequiredRotationIndex(vocab);
            return DEFAULT_PRACTICE_REQUIRED_ROTATION[rotationIndex] || DEFAULT_REQUIRED_BY_PURPOSE.practice;
        }
        return DEFAULT_REQUIRED_BY_PURPOSE[purpose] || DEFAULT_REQUIRED_BY_PURPOSE.default;
    }

    getPracticeRequiredRotationIndex(vocab = this.vocabSet) {
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

    normalizeActivityFlowSettings() {
        if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
        const flow = this.getActivityFlowConfig(this.vocabSet);
        this.vocabSet.activitySettings.requiredActivities = flow.required;
        this.vocabSet.activitySettings.additionalActivities = flow.additional;
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

    getActivityRewardSettings(activityId) {
        const settings = this.vocabSet?.activitySettings || {};
        const activityRewards = settings.activityRewards || {};
        const rewardSettings = activityRewards[activityId] || {};

        return {
            completionBonus: rewardSettings.completionBonus !== undefined
                ? rewardSettings.completionBonus
                : (settings.completionBonus !== undefined ? settings.completionBonus : 50),
            progressReward: rewardSettings.progressReward !== undefined
                ? rewardSettings.progressReward
                : (settings.progressReward !== undefined ? settings.progressReward : 1)
        };
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

        const fallback = field === 'completionBonus' ? 50 : 1;
        const parsedValue = Number.parseInt(value, 10);
        this.vocabSet.activitySettings.activityRewards[activityId][field] =
            Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : fallback;

        this.triggerAutoSave();
    }

    renderActivityFlowSettings() {
        const container = $('#activity-flow-settings');
        if (!container) return;

        const flow = this.getActivityFlowConfig(this.vocabSet);
        const settings = this.vocabSet?.activitySettings || {};
        container.innerHTML = '';

        VOCAB_ACTIVITY_OPTIONS.forEach(activity => {
            const currentValue = flow.required.includes(activity.id)
                ? 'required'
                : flow.additional.includes(activity.id)
                    ? 'additional'
                    : 'hidden';
            const settingKey = activity.settingKey || VOCAB_ACTIVITY_SETTING_KEYS[activity.id];
            const wordCount = settings[settingKey];
            const timeLimit = this.getActivityTimeLimit(activity.id);
            const rewardSettings = this.getActivityRewardSettings(activity.id);
            const disabled = currentValue === 'hidden' ? ' disabled' : '';
            const requiredStep = flow.required.indexOf(activity.id) + 1;
            const flowSelectDisabled = activity.id === 'flashcards'
                ? ' disabled title="Flashcards is always required as Step 1"'
                : '';
            const group = createElement('div', `form-group activity-flow-choice${currentValue === 'hidden' ? ' is-hidden' : ''}`);
            group.setAttribute('role', 'row');
            group.innerHTML = `
                <label for="flow-${activity.id}" role="cell">
                    <span>${activity.label}</span>
                    ${requiredStep > 0 ? `<small>Required Step ${requiredStep}</small>` : ''}
                </label>
                <select id="flow-${activity.id}" class="activity-flow-select" data-activity="${activity.id}"${flowSelectDisabled}>
                    <option value="required"${currentValue === 'required' ? ' selected' : ''}>Required</option>
                    <option value="additional"${currentValue === 'additional' ? ' selected' : ''}>Additional</option>
                    <option value="hidden"${currentValue === 'hidden' ? ' selected' : ''}>Hidden</option>
                </select>
                <input type="number" min="1" placeholder="All" aria-label="${activity.label} words" data-activity-word-count="${activity.id}" value="${wordCount || ''}"${disabled}>
                <input type="number" min="1" max="480" placeholder="No limit" aria-label="${activity.label} active time limit in minutes" data-activity-time-limit="${activity.id}" value="${timeLimit || ''}"${disabled}>
                <input type="number" min="0" aria-label="${activity.label} completion coins" data-activity-reward="completionBonus" data-activity="${activity.id}" value="${rewardSettings.completionBonus}"${disabled}>
                <input type="number" min="0" aria-label="${activity.label} progress coins" data-activity-reward="progressReward" data-activity="${activity.id}" value="${rewardSettings.progressReward}"${disabled}>
            `;
            container.appendChild(group);
        });
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
