import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.document = { getElementById: () => ({}), querySelector: () => null,
    querySelectorAll: () => [], addEventListener() {}, readyState: 'loading' };
globalThis.window = { addEventListener() {}, setTimeout, clearTimeout };
const { StudentActivityBrowser } = await import('../js/student/studentActivityBrowserMethods.js');

function fixture(view, automatic) {
    const routes = [], remembered = [];
    const container = { id: 'vocab-list', innerHTML: '', classList: { add() {}, remove() {} } };
    const vocab = { id: 'fixture', name: 'Fixture unit' };
    const sm = {
        parseRoute: () => view ? { view } : null,
        studentVocabularyDrilldown: { trimester: null, month: null },
        studentVocabularyAutoSelect: automatic,
        setRoute: (route, options) => routes.push({ route, options }),
        rememberStudentVocabularyLocation: (...args) => remembered.push(args)
    };
    const activities = { sm, calendar: { getCurrentTrimesterKey: () => 'IIIT' },
        schedule: { filterStudentAvailableVocabulary: items => items,
            buildVocabularyTrimesterGroups: () => new Map([['IIIT', [vocab]]]),
            buildVocabularyMonthGroups: () => new Map([['october', [vocab]]]) }, vocabularyData: {} };
    const browser = new StudentActivityBrowser(activities);
    browser.renderStudentVocabularyViewControls = () => {};
    browser.renderStudentMonthPicker = () => {};
    browser.renderStudentTrimesterPicker = () => {};
    browser.renderStudentAssignmentPicker = () => {};
    browser.getAutomaticStudentVocabularyLocation = () => ({ trimester: 'IIIT', month: 'october' });
    return { browser, sm, routes, remembered, container, vocab };
}

for (const view of ['activity', 'unit', 'arcade', 'sparks', 'menu', null]) {
    for (const automatic of [false, true]) {
        test(`a background vocabulary browser cannot replace ${view || 'initial'} navigation, automatic=${automatic}`, () => {
            const { browser, sm, routes, container, vocab } = fixture(view, automatic);
            browser.renderVocabularyBrowser(container, [vocab]);
            assert.deepEqual(routes, [], 'Only the active Units route may update its URL drilldown');
            assert.equal(sm.studentVocabularyDrilldown.trimester, 'IIIT');
        });
    }
}

test('the active Units route retains trimester and automatic month URL updates', () => {
    for (const automatic of [false, true]) {
        const { browser, routes, container, vocab } = fixture('units', automatic);
        browser.renderVocabularyBrowser(container, [vocab]);
        assert.equal(routes.length, automatic ? 2 : 1);
        assert.deepEqual(routes.at(-1), { route: { view: 'units', trimester: 'IIIT', ...(automatic ? { month: 'october' } : {}) }, options: { replace: true } });
    }
});
