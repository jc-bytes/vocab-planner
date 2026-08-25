import { $ } from './main.js';

export function initTeacherSettingsListeners(manager) {
    const listen = (target, type, handler) => {
        if (!target) return;
        if (typeof manager.addOwnedListener === 'function') {
            manager.addOwnedListener(target, type, handler);
        } else {
            target.addEventListener(type, handler);
        }
    };
    const operationOptions = () => ({ isCurrent: () => !manager.destroyed });
    const saveGamificationBtn = $('#save-gamification-btn');
    listen(saveGamificationBtn, 'click', () => manager.saveGamificationSettings(operationOptions()));

    const saveSchoolCalendarBtn = $('#save-school-calendar-btn');
    listen(saveSchoolCalendarBtn, 'click', () => manager.saveSchoolCalendarSettings(operationOptions()));
    manager.bindSchoolCalendarInputs?.(listen);

    listen($('#add-subject-btn'), 'click', () => manager.addSubjectFromForm());
    listen($('#save-subjects-btn'), 'click', () => manager.saveSubjectSettings(operationOptions()));
}
