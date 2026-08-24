import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const sharedStylePaths = [
    'css/buttons.css',
    'css/forms.css',
    'css/cards.css',
    'css/dialogs.css',
    'css/navigation.css',
    'css/feedback.css',
    'css/containers.css',
    'css/typography.css'
];

const [teacherQuizCss, ...sharedStyles] = await Promise.all([
    read('css/teacherQuiz.css'),
    ...sharedStylePaths.map(read)
]);

test('shared UI foundations do not require important specificity', () => {
    for (const [index, css] of sharedStyles.entries()) {
        assert.doesNotMatch(css, /!important/, `${sharedStylePaths[index]} must remain specificity-light`);
    }
});

test('Quiz print reset relies on its later cascade instead of important declarations', () => {
    const printBlock = teacherQuizCss.match(/@media print\s*\{([\s\S]*?)\n\}/)?.[1];
    assert.ok(printBlock, 'Missing Quiz print block');
    assert.match(printBlock, /\.document-page\s*\{[^}]*zoom:\s*1;/s);
    assert.doesNotMatch(printBlock, /transform:\s*none|!important/);
});

test('remaining Quiz layout overrides are explicitly bounded until inline styles migrate', () => {
    const importantDeclarations = [...teacherQuizCss.matchAll(/!important/g)].length;
    assert.equal(importantDeclarations, 4);
    assert.match(teacherQuizCss, /\.quiz-maker-container\s*\{[^}]*gap:\s*1\.25rem !important/s);
    assert.match(teacherQuizCss, /\.quiz-sidebar\s*\{[^}]*width:[^;]+!important/s);
    assert.match(teacherQuizCss, /\.quiz-canvas\s*\{[^}]*padding:[^;]+!important[^}]*background:[^;]+!important/s);
});
