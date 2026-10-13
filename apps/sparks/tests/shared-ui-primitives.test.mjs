import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const attributes = new WeakMap();
globalThis.document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById() {
        return null;
    },
    querySelectorAll() {
        return [];
    },
    body: {
        appendChild() {}
    },
    createElement(tagName) {
        const element = {
            tagName: tagName.toUpperCase(),
            className: '',
            textContent: '',
            style: {},
            setAttribute(name, value) {
                attributes.get(element).set(name, String(value));
            },
            getAttribute(name) {
                return attributes.get(element).get(name) ?? null;
            }
        };
        attributes.set(element, new Map());
        return element;
    }
};
globalThis.window = {
    addEventListener() {}
};

const { showLoadingState } = await import('../js/ui/loadingState.js');
const { getKeyboardNavigatedTab } = await import('../js/ui/tabNavigation.js');
const { refreshIcons } = await import('../js/main.js');
const read = relativePath => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

function createContainer() {
    return {
        children: [],
        replaceChildren(...children) {
            this.children = children;
        }
    };
}

test('the loading primitive safely replaces a container with an announced status', () => {
    const container = createContainer();
    const state = showLoadingState(container, '<strong>Loading records</strong>', {
        className: 'runtime-status'
    });

    assert.deepEqual(container.children, [state]);
    assert.equal(state.tagName, 'DIV');
    assert.equal(state.className, 'loading-spinner runtime-status');
    assert.equal(state.textContent, '<strong>Loading records</strong>');
    assert.equal(state.getAttribute('role'), 'status');
    assert.equal(state.getAttribute('aria-live'), 'polite');
});

test('the primitive supplies a stable default and does not require a feature class', () => {
    const state = showLoadingState(createContainer(), null);

    assert.equal(state.className, 'loading-spinner');
    assert.equal(state.textContent, 'Loading...');
});

test('the first migrated teacher consumers use the shared loading primitive', async () => {
    const [quizCore, vocabularyData] = await Promise.all([
        read('js/teacherQuizCoreMethods.js'),
        read('js/teacherVocabularyLibrary/teacherVocabularyDataMethods.js')
    ]);

    for (const source of [quizCore, vocabularyData]) {
        assert.match(source, /import \{ showLoadingState \} from/);
        assert.doesNotMatch(source, /innerHTML\s*=\s*'<div class="loading-spinner"/);
    }
    assert.match(quizCore, /showLoadingState\(container, 'Loading vocabulary choices\.\.\.'\)/);
    assert.match(vocabularyData, /showLoadingState\(list, 'Loading library\.\.\.'\)/);
});

test('tab keyboard navigation wraps and supports list endpoints', () => {
    const tabs = [{ id: 'first' }, { id: 'middle' }, { id: 'last' }];

    assert.equal(getKeyboardNavigatedTab(tabs, tabs[0], 'ArrowLeft'), tabs[2]);
    assert.equal(getKeyboardNavigatedTab(tabs, tabs[2], 'ArrowRight'), tabs[0]);
    assert.equal(getKeyboardNavigatedTab(tabs, tabs[1], 'Home'), tabs[0]);
    assert.equal(getKeyboardNavigatedTab(tabs, tabs[1], 'End'), tabs[2]);
});

test('tab keyboard navigation ignores unsupported keys and enables vertical arrows explicitly', () => {
    const tabs = [{ id: 'first' }, { id: 'last' }];

    assert.equal(getKeyboardNavigatedTab(tabs, tabs[0], 'ArrowDown'), null);
    assert.equal(
        getKeyboardNavigatedTab(tabs, tabs[0], 'ArrowDown', { vertical: true }),
        tabs[1]
    );
    assert.equal(getKeyboardNavigatedTab(tabs, {}, 'ArrowRight'), null);
});

test('icon refresh uses one optional Lucide call and normalizes invalid roots', () => {
    const calls = [];
    globalThis.window = {
        lucide: {
            createIcons(options) {
                calls.push(options);
            }
        }
    };
    const root = { querySelectorAll() {} };

    refreshIcons(root);
    refreshIcons(null);

    assert.deepEqual(calls, [{ root }, { root: document }]);
});
