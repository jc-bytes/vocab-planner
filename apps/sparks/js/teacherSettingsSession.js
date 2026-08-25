import { getDefaultSchoolCalendar } from './services/vocabularyApi.js';
import { ARCADE_ECONOMY } from './gamificationConfig.js';

function getElement(selector) {
    return document.querySelector(selector);
}

export function createTeacherSettingsOperationGuard(owner, options = {}) {
    const generation = owner.teacherSettingsSessionGeneration || 0;
    const externalGuard = typeof options.isCurrent === 'function' ? options.isCurrent : () => true;
    return () => generation === (owner.teacherSettingsSessionGeneration || 0) && externalGuard();
}

export function resetTeacherSettingsView(refreshIcons = () => {}) {
    const clearValue = selector => {
        const element = getElement(selector);
        if (element) element.value = '';
    };
    ['#new-subject-name', '#school-calendar-year'].forEach(clearValue);
    const exchangeRate = getElement('#global-exchange-rate');
    if (exchangeRate) exchangeRate.value = String(ARCADE_ECONOMY.defaultExchangeRate);
    ['it', 'iit', 'iiit'].forEach(trimester => {
        ['start', 'weeks', 'end'].forEach(field => clearValue(`#calendar-${trimester}-${field}`));
        const preview = getElement(`#calendar-${trimester}-range`);
        if (preview) preview.textContent = 'Set start and weeks';
    });
    const subjectColor = getElement('#new-subject-color');
    if (subjectColor) subjectColor.value = '#16a34a';
    const subjectList = getElement('#subjects-manager-list');
    subjectList?.replaceChildren();
    const scheduleList = getElement('#class-schedule-list');
    if (scheduleList) {
        scheduleList.replaceChildren();
        scheduleList.classList.add('is-empty');
    }
    const subjectSelect = getElement('#vocab-subject');
    if (subjectSelect) {
        subjectSelect.replaceChildren();
        subjectSelect.value = '';
    }
    ['#subjects-save-status', '#gamification-save-status', '#school-calendar-save-status'].forEach(selector => {
        const status = getElement(selector);
        if (!status) return;
        status.textContent = '';
        status.style.color = '';
    });
    const buttonDefaults = {
        '#save-subjects-btn': '<i data-lucide="save"></i> Save Subjects',
        '#save-gamification-btn': '<i data-lucide="save"></i> Save Settings',
        '#save-school-calendar-btn': '<i data-lucide="calendar-check"></i> Save Calendar'
    };
    Object.entries(buttonDefaults).forEach(([selector, content]) => {
        const button = getElement(selector);
        if (!button) return;
        button.disabled = false;
        button.innerHTML = content;
    });
    refreshIcons();
}

export function clearTeacherSettingsSessionState(owner) {
    owner.teacherSettingsSessionGeneration = (owner.teacherSettingsSessionGeneration || 0) + 1;
    owner.subjectSettingsLoaded = false;
    owner.gamificationSettingsLoaded = false;
    owner.schoolCalendarSettingsLoaded = false;
    owner.subjects = [];
    owner.schoolCalendar = getDefaultSchoolCalendar();
    globalThis.clearTimeout(owner.gamificationStatusTimer);
    owner.gamificationStatusTimer = null;
    resetTeacherSettingsView(root => owner.refreshIcons?.(root));
}
