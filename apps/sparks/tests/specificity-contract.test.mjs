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

const [teacherQuizCss, studentFeatureCss, ...sharedStyles] = await Promise.all([
    read('css/teacherQuiz.css'),
    read('css/student-features.css'),
    ...sharedStylePaths.map(read)
]);

const teacherCss = await read('css/teacher.css');

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

test('teacher dashboard and Word Hunt refinements win through owned selector scope', () => {
    assert.match(teacherCss, /\.data-summary-stat\s*\{[^}]*text-align:\s*left;/s);
    assert.match(teacherCss, /\.data-summary-stat \.teacher-stat-icon\s*\{[^}]*margin-bottom:\s*0;/s);
    assert.match(teacherCss, /\.word-hunt-review-breadcrumb \.word-hunt-review-separator\s*\{[^}]*color:/s);

    for (const selector of [
        '\\.data-summary-stat',
        '\\.data-summary-stat \\.teacher-stat-icon',
        '\\.word-hunt-review-breadcrumb \\.word-hunt-review-separator'
    ]) {
        const block = teacherCss.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1];
        assert.ok(block, `Missing ${selector} rule`);
        assert.doesNotMatch(block, /!important/);
    }
});

test('lazy Flashcards and game-stage foundations do not escalate specificity', () => {
    for (const selector of ['\\.flashcard-controls', '#game-stage:not\\(\\.hidden\\)']) {
        const block = studentFeatureCss.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1];
        assert.ok(block, `Missing ${selector} rule`);
        assert.doesNotMatch(block, /!important/);
    }

    assert.match(studentFeatureCss, /\.flashcard-controls\s*\{[^}]*width:\s*100%;[^}]*max-height:\s*none;/s);
    assert.match(studentFeatureCss, /#game-stage:not\(\.hidden\)\s*\{[^}]*min-width:\s*0;/s);
});
