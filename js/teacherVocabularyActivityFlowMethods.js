import { $, createElement, notifications } from './main.js';
import {
    DEFAULT_REQUIRED_BY_PURPOSE,
    VOCAB_ACTIVITY_IDS,
    VOCAB_ACTIVITY_OPTIONS
} from './teacherVocabularyEditorConstants.js';

class TeacherVocabularyActivityFlowMethods {
    getDefaultRequiredActivities(vocab = this.vocabSet) {
        const purpose = String(vocab?.purpose || '').trim().toLowerCase();
        return DEFAULT_REQUIRED_BY_PURPOSE[purpose] || DEFAULT_REQUIRED_BY_PURPOSE.default;
    }

    getActivityFlowConfig(vocab = this.vocabSet) {
        const settings = vocab?.activitySettings || {};
        const validIds = new Set(VOCAB_ACTIVITY_IDS);
        const hasExplicitFlow = Array.isArray(settings.requiredActivities) || Array.isArray(settings.additionalActivities);
        const defaultRequired = this.getDefaultRequiredActivities(vocab).filter(id => validIds.has(id));
        const requestedRequired = hasExplicitFlow ? settings.requiredActivities : defaultRequired;
        const required = (Array.isArray(requestedRequired) ? requestedRequired : defaultRequired)
            .filter(id => validIds.has(id));
        const uniqueRequired = [...new Set(required)];
        const requiredSet = new Set(uniqueRequired);
        const requestedAdditional = hasExplicitFlow
            ? settings.additionalActivities
            : VOCAB_ACTIVITY_IDS.filter(id => !requiredSet.has(id));
        const additional = (Array.isArray(requestedAdditional) ? requestedAdditional : [])
            .filter(id => validIds.has(id) && !requiredSet.has(id));
        const uniqueAdditional = [...new Set(additional)];

        if (uniqueRequired.length === 0) {
            uniqueRequired.push('flashcards');
        }

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
        this.triggerAutoSave();
    }

    renderActivityFlowSettings() {
        const container = $('#activity-flow-settings');
        if (!container) return;

        const flow = this.getActivityFlowConfig(this.vocabSet);
        container.innerHTML = '';

        VOCAB_ACTIVITY_OPTIONS.forEach(activity => {
            const currentValue = flow.required.includes(activity.id)
                ? 'required'
                : flow.additional.includes(activity.id)
                    ? 'additional'
                    : 'hidden';
            const group = createElement('div', 'form-group');
            group.style.cssText = 'background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.75rem;';
            group.innerHTML = `
                <label for="flow-${activity.id}" style="display:block; margin-bottom:0.35rem;">${activity.label}</label>
                <select id="flow-${activity.id}" class="activity-flow-select" data-activity="${activity.id}">
                    <option value="required"${currentValue === 'required' ? ' selected' : ''}>Required</option>
                    <option value="additional"${currentValue === 'additional' ? ' selected' : ''}>Additional</option>
                    <option value="hidden"${currentValue === 'hidden' ? ' selected' : ''}>Hidden</option>
                </select>
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
