import { $ } from './main.js';

export function initTeacherSettingsListeners(manager) {
    const saveGamificationBtn = $('#save-gamification-btn');
    if (saveGamificationBtn) {
        saveGamificationBtn.addEventListener('click', () => {
            manager.saveGamificationSettings();
        });
    }

    const saveSchoolCalendarBtn = $('#save-school-calendar-btn');
    if (saveSchoolCalendarBtn) {
        saveSchoolCalendarBtn.addEventListener('click', () => {
            manager.saveSchoolCalendarSettings();
        });
    }

    $('#add-subject-btn')?.addEventListener('click', () => manager.addSubjectFromForm());
    $('#save-subjects-btn')?.addEventListener('click', () => manager.saveSubjectSettings());
}
