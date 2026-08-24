import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [containersCss, landingCss, studentCss, teacherCss, indexHtml, studentHtml, teacherHtml, studentBrowser, teacherBrowser, quizBrowser, wordHuntView] = await Promise.all([
    read('css/containers.css'),
    read('css/landing.css'),
    read('css/student.css'),
    read('css/teacher.css'),
    read('index.html'),
    read('student.html'),
    read('teacher.html'),
    read('js/student/studentActivityBrowserMethods.js'),
    read('js/teacherVocabularyLibrary/teacherVocabularyBrowserViewMethods.js'),
    read('js/teacherQuizBrowserMethods.js'),
    read('js/teacherWordHuntReview/teacherWordHuntReviewViewMethods.js')
]);

function count(source, pattern) {
    return [...source.matchAll(pattern)].length;
}

test('every app entry loads one shared container family before page styles', () => {
    for (const [name, html, previousStylesheet, entryStylesheet] of [
        ['landing', indexHtml, 'css/cards.css', 'css/landing.css'],
        ['student', studentHtml, 'css/feedback.css', 'css/student.css'],
        ['teacher', teacherHtml, 'css/feedback.css', 'css/teacher.css']
    ]) {
        assert.equal(count(html, /data-shared-containers/g), 1, `${name} must load one container family`);
        assert.ok(
            html.indexOf(previousStylesheet) < html.indexOf('css/containers.css')
            && html.indexOf('css/containers.css') < html.indexOf(entryStylesheet),
            `${name} containers must load after ${previousStylesheet} and before ${entryStylesheet}`
        );
    }
});

test('containers.css owns only stable shell and collection structures', () => {
    for (const selector of [
        '.landing-container',
        '.app-container',
        '.app-container > main',
        '.app-container::before',
        '.app-header',
        '.words-grid',
        '.vocab-groups',
        '.teacher-library-browser',
        '.teacher-library-choice-grid'
    ]) {
        const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(containersCss, new RegExp(`${escaped}(?:[^,{]*,[^{}]*)?\\s*\\{`), `containers.css is missing ${selector}`);
    }

    assert.doesNotMatch(containersCss, /!important|@media|teacher-app-header|student-app-header|sidebar|login-view/);
    assert.doesNotMatch(containersCss, /var\(--(?:card-bg|border-color|text-main|text-muted)\)/);
});

test('entry styles retain responsive refinements without recreating shared bases', () => {
    for (const [name, css] of [
        ['landing.css', landingCss],
        ['student.css', studentCss],
        ['teacher.css', teacherCss]
    ]) {
        assert.doesNotMatch(css, /\.landing-container\s*\{[^}]*grid-template-rows:\s*auto auto auto/s, `${name} must not recreate the landing shell`);
        assert.doesNotMatch(css, /\.app-container\s*\{[^}]*max-width:\s*1200px/s, `${name} must not recreate the app shell`);
        assert.doesNotMatch(css, /\.app-header\s*\{[^}]*justify-content:\s*space-between/s, `${name} must not recreate the app header`);
        assert.doesNotMatch(css, /\.words-grid,[\s\S]*?grid-template-columns:\s*repeat\(auto-fill, minmax\(250px, 1fr\)\)/, `${name} must not recreate collection grids`);
    }

    assert.match(landingCss, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.landing-container\s*\{/);
    assert.match(studentCss, /@media\s*\(max-width:\s*1120px\)/);
    assert.match(studentCss, /@media\s*\(min-width:\s*1121px\)/);
    assert.match(studentCss, /\.app-container:has\(#arcade-view/);
    assert.match(teacherCss, /teacher-sidebar-collapsed/);
    assert.match(teacherCss, /\.teacher-app-header\s*\{/);
});

test('page shells and content-browser producers keep the shared class contract', () => {
    assert.equal(count(indexHtml, /class="landing-container"/g), 1);
    for (const [name, html] of [['student', studentHtml], ['teacher', teacherHtml]]) {
        assert.equal(count(html, /class="app-container(?:\s[^"]*)?"/g), 1, `${name} must have one app shell`);
        assert.match(html, /<header[^>]+class="[^"]*app-header/);
        assert.match(html, /<main[^>]*>/);
    }

    assert.match(studentBrowser, /teacher-library-browser/);
    assert.match(studentBrowser, /teacher-library-choice-grid/);
    assert.match(teacherBrowser, /teacher-library-browser/);
    assert.match(teacherBrowser, /teacher-library-choice-grid/);
    assert.match(quizBrowser, /teacher-library-browser/);
    assert.match(quizBrowser, /teacher-library-choice-grid/);
    assert.match(wordHuntView, /teacher-library-choice-grid/);
});
