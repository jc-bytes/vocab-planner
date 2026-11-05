import { normalizeVocabularyGrading } from './vocabularyGrading.js';

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

// Grading belongs to the vocabulary draft. Publishing freezes the configured
// requirements and points in the assigned copy rather than changing past work.
export function renderVocabularyGradingSettings(manager) {
    const presets = document.getElementById('activity-preset-controls');
    if (!presets) return;
    const vocabulary = manager.vocabSet;
    const documentGeneration = manager.teacherVocabularyDocumentGeneration;
    const owner = manager.currentUser?.uid || manager.currentUser?.id;
    const mode = manager.authDisabled;
    const current = () => vocabulary === manager.vocabSet && documentGeneration === manager.teacherVocabularyDocumentGeneration
        && owner === (manager.currentUser?.uid || manager.currentUser?.id) && mode === manager.authDisabled;
    const panel = element('section', undefined, 'vocabulary-grading-settings');
    panel.id = 'vocabulary-grading-settings';
    panel.setAttribute('aria-label', 'Vocabulary grading');
    let settings, malformed = false;
    try { settings = normalizeVocabularyGrading(vocabulary?.activitySettings?.grading); }
    catch { settings = normalizeVocabularyGrading(); malformed = true; }

    const toggleLabel = element('label', undefined, 'vocabulary-grading-toggle');
    const enabled = element('input'); enabled.type = 'checkbox'; enabled.checked = settings.enabled;
    toggleLabel.append(enabled, element('span', 'Grade this vocabulary'));
    const explanation = element('p', 'Each verified completed required activity earns an equal share of the base points. Accuracy is separate. Additional activities can earn extra points once each.');
    const fields = element('fieldset'); fields.disabled = !settings.enabled;
    const legend = element('legend', 'Points'); fields.append(legend);
    function numberField(label, key, value, minimum, placeholder) {
        const wrapper = element('label', label), control = element('input');
        control.type = 'number'; control.step = '0.01'; control.min = String(minimum); control.max = '100000';
        control.value = value === null ? '' : String(value); control.required = key !== 'bonusCap';
        control.dataset.vocabularyGradeField = key; control.setAttribute('aria-label', label);
        if (placeholder) control.placeholder = placeholder;
        wrapper.append(control); fields.append(wrapper); return control;
    }
    const maxPoints = numberField('Base points', 'maxPoints', settings.maxPoints, 0.01);
    const bonusPerActivity = numberField('Extra points per additional activity', 'bonusPerActivity', settings.bonusPerActivity, 0);
    const bonusCap = numberField('Maximum extra points', 'bonusCap', settings.bonusCap, 0, 'No limit');
    const capLabel = element('label', undefined, 'vocabulary-grading-toggle'), cap = element('input');
    cap.type = 'checkbox'; cap.checked = settings.capAtMaxPoints;
    capLabel.append(cap, element('span', 'Limit the final score to the base points')); fields.append(capLabel);
    const status = element('p', malformed ? 'The saved grading settings are invalid. Review the point values before enabling grading.' : '', 'vocabulary-grading-status');
    status.setAttribute('role', 'status');
    const publishing = element('p', 'These settings apply to newly assigned copies. Existing assignments keep their grading settings.', 'vocabulary-grading-note');
    panel.append(toggleLabel, explanation, fields, status, publishing);
    const old = document.getElementById(panel.id);
    if (old) old.replaceWith(panel); else presets.after(panel);
    void import('../css/vocabulary-grading-settings.css').catch(() => {});

    function save() {
        if (!current()) return;
        if (enabled.checked && ![maxPoints, bonusPerActivity, bonusCap].every(input => input.checkValidity())) return;
        let value;
        try {
            value = normalizeVocabularyGrading(enabled.checked ? {
                enabled: true, maxPoints: Number(maxPoints.value), bonusPerActivity: Number(bonusPerActivity.value),
                bonusCap: bonusCap.value === '' ? null : Number(bonusCap.value), capAtMaxPoints: cap.checked
            } : { ...settings, enabled: false });
        } catch (error) { status.textContent = error.message || 'Enter valid grading points.'; return; }
        vocabulary.activitySettings ||= {};
        vocabulary.activitySettings.grading = value;
        settings = value; fields.disabled = !value.enabled;
        status.textContent = value.enabled ? 'Grading enabled for newly assigned copies.' : 'This vocabulary is not graded.';
        manager.triggerAutoSave(); manager.updateVocabularyEditorSummary?.();
    }
    enabled.addEventListener('change', save); cap.addEventListener('change', save);
    for (const input of [maxPoints, bonusPerActivity, bonusCap]) {
        input.addEventListener('input', save);
        input.addEventListener('change', () => { if (current() && !input.checkValidity()) input.reportValidity(); });
    }
}
