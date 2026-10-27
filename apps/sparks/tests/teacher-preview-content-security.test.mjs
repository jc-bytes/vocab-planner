import assert from 'node:assert/strict';
import test from 'node:test';
import { crosswordInteractionMethods } from '../js/activities/crossword/crosswordInteractionMethods.js';

test('Crossword active clues render vocabulary and feedback as literal text', () => {
    const definition = '<img src=x onerror="window.previewInjected=true">';
    const previous = globalThis.document;
    globalThis.document = { createElement: () => ({ setAttribute(name, value) { this[name] = value; } }) };
    try {
        const panel = { children: [], replaceChildren(...nodes) { this.children = nodes; },
            append(...nodes) { this.children.push(...nodes); }, appendChild(node) { this.children.push(node); },
            set innerHTML(_value) { throw new Error('Clue data must never enter an HTML parser.'); } };
        const activity = { container: { querySelector: () => panel },
            getActiveWord: () => ({ number: 4, direction: 'down', definition, word: 'ROBOT' }),
            activeFeedback: { type: 'incorrect', message: '<svg onload="window.previewInjected=true">' } };
        crosswordInteractionMethods.updateActiveClue.call(activity);
        assert.deepEqual(panel.children.map(node => [node.className, node.textContent]), [
            ['cw-active-label', '4 down'], ['cw-active-text', definition], ['cw-active-meta', '5 letters'],
            ['cw-word-feedback incorrect', activity.activeFeedback.message]
        ]);
        assert.equal(panel.children[3].role, 'status');
    } finally {
        if (previous === undefined) delete globalThis.document;
        else globalThis.document = previous;
    }
});
