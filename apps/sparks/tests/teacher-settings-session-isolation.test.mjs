import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

function createElement(value = '') {
    return {
        value,
        textContent: '',
        innerHTML: '',
        disabled: false,
        style: {},
        dataset: {},
        classList: { add() {}, remove() {} },
        appendChild() {},
        replaceChildren() { this.innerHTML = ''; this.textContent = ''; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        setAttribute() {},
        addEventListener() {}
    };
}

const elements = new Map();
globalThis.document = {
    querySelector(selector) { return elements.get(selector) || null; },
    querySelectorAll() { return []; },
    getElementById(id) { return elements.get(`#${id}`) || null; },
    createElement: () => createElement(),
    body: { appendChild() {} },
    head: { appendChild() {} }
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

const { settingsRepository } = await import('../js/services/settingsRepository.js');
const { subjectsRepository } = await import('../js/services/subjectsRepository.js');
const { supabaseService } = await import('../js/supabaseService.js');
const { teacherGamificationSettingsMethods } = await import('../js/teacherGamificationSettingsMethods.js');
const { teacherSchoolCalendarSettingsMethods } = await import('../js/teacherSchoolCalendarSettingsMethods.js');
const { teacherSubjectSettingsMethods } = await import('../js/teacherSubjectSettingsMethods.js');
const {
    clearTeacherSettingsSessionState,
    resetTeacherSettingsView
} = await import('../js/teacherSettingsSession.js');

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

function calendarFor(schoolYear) {
    return {
        schoolYear,
        trimesters: {
            IT: { startDate: `${schoolYear}-03-01`, weekCount: 10 },
            IIT: { startDate: `${schoolYear}-06-01`, weekCount: 10 },
            IIIT: { startDate: `${schoolYear}-09-01`, weekCount: 10 }
        }
    };
}

function createManager() {
    return {
        ...teacherGamificationSettingsMethods,
        ...teacherSchoolCalendarSettingsMethods,
        ...teacherSubjectSettingsMethods,
        teacherSettingsSessionGeneration: 0,
        subjectSettingsLoaded: false,
        gamificationSettingsLoaded: false,
        schoolCalendarSettingsLoaded: false,
        subjects: [{ slug: 'account-a' }],
        schoolCalendar: calendarFor('2026'),
        authDisabled: false,
        currentUser: { uid: 'teacher-a', email: 'a@example.test' },
        refreshIcons() {},
        renderSubjectManager() {
            this.renderedSubjects = this.subjects.map(subject => subject.slug);
        },
        updateSubjectSelect() {},
        updateSchoolCalendarUI() {
            this.renderedSchoolYear = this.schoolCalendar.schoolYear;
        },
        invalidateTeacherLibraryCache() {},
        updateFormUI() {},
        ensureAuthenticated: () => true,
        setCloudStatus() {}
    };
}

test('account cleanup invalidates late settings loads and preserves the next account', async () => {
    const exchangeRate = createElement('10');
    elements.set('#global-exchange-rate', exchangeRate);

    const originalGet = settingsRepository.get;
    const originalList = subjectsRepository.list;
    const originalInit = supabaseService.init;
    const accountAGamificationRequest = deferred();
    const accountBGamificationRequest = deferred();
    const accountACalendarRequest = deferred();
    const accountBCalendarRequest = deferred();
    const accountASubjectRequest = deferred();
    const accountBSubjectRequest = deferred();
    const requests = new Map([
        ['gamification', [accountAGamificationRequest, accountBGamificationRequest]],
        ['schoolCalendar', [accountACalendarRequest, accountBCalendarRequest]]
    ]);
    settingsRepository.get = key => requests.get(key).shift().promise;
    const subjectRequests = [accountASubjectRequest, accountBSubjectRequest];
    let subjectRequestCount = 0;
    supabaseService.init = async () => {};
    subjectsRepository.list = () => {
        const request = subjectRequests[subjectRequestCount];
        subjectRequestCount += 1;
        return request.promise;
    };

    try {
        const manager = createManager();
        const accountAGamification = manager.loadGamificationSettings();
        const accountACalendar = manager.loadSchoolCalendarSettings();
        const accountASubjects = manager.loadSubjectSettings();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(subjectRequestCount, 1);

        clearTeacherSettingsSessionState(manager);
        assert.equal(manager.subjectSettingsLoaded, false);
        assert.deepEqual(manager.subjects, []);
        assert.equal(exchangeRate.value, '10');

        manager.currentUser = { uid: 'teacher-b', email: 'b@example.test' };
        const accountBGamification = manager.loadGamificationSettings();
        const accountBCalendar = manager.loadSchoolCalendarSettings();
        const accountBSubjects = manager.loadSubjectSettings();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(subjectRequestCount, 2);

        accountBGamificationRequest.resolve({ exchangeRate: 25 });
        accountBCalendarRequest.resolve(calendarFor('2031'));
        accountBSubjectRequest.resolve([{ slug: 'account-b', name: 'Account B' }]);
        assert.equal(await accountBGamification, true);
        assert.equal(await accountBCalendar, true);
        assert.equal(await accountBSubjects, true);
        assert.equal(exchangeRate.value, 25);
        assert.equal(manager.schoolCalendar.schoolYear, '2031');
        assert.equal(manager.renderedSchoolYear, '2031');
        assert.equal(manager.renderedSubjects.includes('account-b'), true);

        accountAGamificationRequest.resolve({ exchangeRate: 99 });
        accountACalendarRequest.resolve(calendarFor('2027'));
        accountASubjectRequest.resolve([{ slug: 'account-a', name: 'Account A' }]);
        assert.equal(await accountAGamification, false);
        assert.equal(await accountACalendar, false);
        assert.equal(await accountASubjects, false);
        assert.equal(exchangeRate.value, 25);
        assert.equal(manager.schoolCalendar.schoolYear, '2031');
        assert.equal(manager.renderedSchoolYear, '2031');
        assert.equal(manager.renderedSubjects.includes('account-a'), false);
        assert.equal(manager.teacherSettingsSessionGeneration, 1);
    } finally {
        settingsRepository.get = originalGet;
        subjectsRepository.list = originalList;
        supabaseService.init = originalInit;
    }
});

test('a new gamification save cancels the previous success timer before awaiting', async () => {
    const exchangeRate = createElement('20');
    const status = createElement();
    const button = createElement();
    elements.set('#global-exchange-rate', exchangeRate);
    elements.set('#gamification-save-status', status);
    elements.set('#save-gamification-btn', button);

    const originalSave = settingsRepository.save;
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const originalConsoleError = console.error;
    const secondSave = deferred();
    const scheduled = new Map();
    let nextTimerId = 1;
    let saveCount = 0;
    settingsRepository.save = async () => {
        saveCount += 1;
        if (saveCount === 1) return {};
        return secondSave.promise;
    };
    globalThis.setTimeout = callback => {
        const timerId = nextTimerId;
        nextTimerId += 1;
        scheduled.set(timerId, callback);
        return timerId;
    };
    globalThis.clearTimeout = timerId => scheduled.delete(timerId);
    console.error = () => {};

    try {
        const manager = createManager();
        assert.equal(await manager.saveGamificationSettings(), true);
        const firstTimer = manager.gamificationStatusTimer;
        assert.equal(scheduled.has(firstTimer), true);

        const pendingSave = manager.saveGamificationSettings();
        assert.equal(scheduled.has(firstTimer), false);
        assert.equal(status.textContent, 'Saving settings...');

        secondSave.reject(new Error('save failed'));
        assert.equal(await pendingSave, false);
        assert.equal(status.textContent, 'Failed to save settings. Check permissions.');
        assert.equal(button.disabled, false);
    } finally {
        settingsRepository.save = originalSave;
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
        console.error = originalConsoleError;
    }
});

test('a stale calendar save does not start account-derived placement work', async () => {
    const saveRequest = deferred();
    const originalSave = settingsRepository.save;
    settingsRepository.save = () => saveRequest.promise;
    elements.set('#school-calendar-save-status', createElement());
    elements.set('#save-school-calendar-btn', createElement());

    try {
        const manager = createManager();
        let cloudLoads = 0;
        manager.validateClassScheduleRows = () => '';
        manager.readSchoolCalendarFromUI = () => calendarFor('2030');
        manager.validateSchoolCalendar = () => [];
        manager.fetchCloudVocabs = async () => {
            cloudLoads += 1;
            return [];
        };

        const saving = manager.saveSchoolCalendarSettings();
        clearTeacherSettingsSessionState(manager);
        saveRequest.resolve();

        assert.equal(await saving, false);
        assert.equal(cloudLoads, 0);
        assert.equal(elements.get('#save-school-calendar-btn').disabled, false);
    } finally {
        settingsRepository.save = originalSave;
    }
});

test('settings cleanup restores canonical shared controls', () => {
    const selectors = [
        '#new-subject-name', '#new-subject-color', '#global-exchange-rate', '#school-calendar-year',
        '#subjects-manager-list', '#class-schedule-list', '#vocab-subject',
        '#subjects-save-status', '#gamification-save-status', '#school-calendar-save-status',
        '#save-subjects-btn', '#save-gamification-btn', '#save-school-calendar-btn'
    ];
    selectors.forEach(selector => elements.set(selector, createElement('account-a-value')));
    resetTeacherSettingsView();

    assert.equal(elements.get('#new-subject-name').value, '');
    assert.equal(elements.get('#new-subject-color').value, '#16a34a');
    assert.equal(elements.get('#global-exchange-rate').value, '10');
    assert.equal(elements.get('#subjects-save-status').textContent, '');
    assert.equal(elements.get('#save-subjects-btn').disabled, false);
    assert.match(elements.get('#save-school-calendar-btn').innerHTML, /Save Calendar/);
});

test('all auth exit paths clear account-owned settings state', async () => {
    const [authSource, listenersSource] = await Promise.all([
        readFile(new URL('../js/teacherAuth.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/teacherGlobalListeners.js', import.meta.url), 'utf8')
    ]);

    assert.match(authSource, /currentUser\.uid !== user\.uid[\s\S]*clearTeacherSettingsSessionState\?\.\(\)/);
    assert.match(authSource, /else \{[\s\S]*clearTeacherSettingsSessionState\?\.\(\)[\s\S]*currentUser = null/);
    assert.match(listenersSource, /clearTeacherSettingsSessionState\?\.\(\)[\s\S]*currentUser = null/);
});
