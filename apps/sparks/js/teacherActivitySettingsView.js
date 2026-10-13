import { $, createElement } from './main.js';
import { VOCAB_ACTIVITY_OPTIONS, VOCAB_ACTIVITY_SETTING_KEYS } from './teacherVocabularyEditorConstants.js';

export function renderActivitySettings() {
        const container = $('#activity-flow-settings');
        if (!container) return;

        const flow = this.getActivityFlowConfig(this.vocabSet);
        const settings = this.vocabSet?.activitySettings || {};
        const presets = $('#activity-preset-controls');
        if (presets) {
            presets.replaceChildren();
            const summary = createElement('p');
            summary.textContent = `Required: ${flow.required.map(id => VOCAB_ACTIVITY_OPTIONS.find(a => a.id === id)?.label || id).join(', ')}. ${flow.additional.length} optional activities.`;
            presets.append(summary);
            for (const [preset, label] of [['practice', 'Use Flashcards + Matching'], ['evidence', 'Use Flashcards + Word Hunt']]) {
                const button = createElement('button', 'btn secondary-btn');
                button.type = 'button'; button.textContent = label;
                button.addEventListener('click', () => applyActivityPreset(this, preset));
                presets.append(button);
            }
        }
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
            const answerEntrySetting = activity.id === 'illustration'
                ? `<select aria-label="Word Hunt answer entry" data-word-hunt-text-paste${disabled}>
                    <option value="typing"${settings.wordHuntAllowTextPaste === false ? ' selected' : ''}>Typing only</option>
                    <option value="allow"${settings.wordHuntAllowTextPaste === false ? '' : ' selected'}>Allow paste</option>
                </select>`
                : '<span class="activity-setting-not-applicable" aria-label="Not applicable">-</span>';
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
                ${answerEntrySetting}
            `;
            container.appendChild(group);
        });
}

export function applyActivityPreset(manager, preset) {
        const paths = { practice: ['flashcards', 'matching'], evidence: ['flashcards', 'illustration'] };
        if (!paths[preset]) return;
        manager.vocabSet.activitySettings ||= {};
        manager.vocabSet.activitySettings.requiredActivities = [...paths[preset]];
        manager.vocabSet.activitySettings.additionalActivities = [];
        manager.renderActivityFlowSettings();
        manager.renderWords();
        manager.triggerAutoSave();
        manager.updateVocabularyEditorSummary();
    }
