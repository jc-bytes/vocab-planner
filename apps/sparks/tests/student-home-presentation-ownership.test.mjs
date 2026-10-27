import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.document = {
    readyState: 'loading', addEventListener() {}, removeEventListener() {},
    getElementById() { return {}; }, querySelector() { return null; }, querySelectorAll() { return []; }
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.location = { hash: '#/menu' };
const { StudentActivityHome } = await import('../js/student/studentActivityHomeMethods.js');

test('a held Home host import loses ownership on same-hash navigation, while a fresh call still renders', async () => {
    let resolveModule, renders = 0;
    const module = new Promise(resolve => { resolveModule = resolve; });
    const sm = {
        currentUser: { uid: 'student-A' }, authDisabled: false,
        selectedSubjectSlug: 'technology', studentProfile: { grade: '9' },
        progress: { cloud: { cloudGeneration: 1 } },
        routing: { arcadeReadController: new AbortController() }
    };
    const home = new StudentActivityHome({ sm }, { loadHomeRenderer: () => module, loadStyles: async () => {} });
    home.renderGeneration = 1;
    const dashboard = {}, host = { isConnected: true, closest: () => dashboard };
    const old = home.loadAndRenderCurrentSpark(host);

    // Router navigation can leave and return before a deferred module resolves.
    // Hash, account and render generation alone cannot identify the old request.
    sm.routing.arcadeReadController.abort();
    sm.routing.arcadeReadController = new AbortController();
    resolveModule({ renderCurrentHomeSpark() { renders++; return 'fresh Home'; } });
    assert.equal(await old, undefined, 'Obsolete UI work settles without an unhandled cancellation');
    assert.equal(renders, 0);
    assert.equal(location.hash, '#/menu');
    assert.equal(home.renderGeneration, 1);

    assert.equal(await home.loadAndRenderCurrentSpark(host), 'fresh Home');
    assert.equal(renders, 1, 'Cancellation must not poison the successfully loaded presentation');
});
