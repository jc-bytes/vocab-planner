import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [
    feedbackCss,
    studentCss,
    teacherCss,
    studentFeatureCss,
    indexHtml,
    studentHtml,
    teacherHtml,
    studentAuth,
    teacherShell,
    fillInBlank,
    wordSearchView,
    crosswordView
] = await Promise.all([
    read('css/feedback.css'),
    read('css/student.css'),
    read('css/teacher.css'),
    read('css/student-features.css'),
    read('index.html'),
    read('student.html'),
    read('teacher.html'),
    read('js/student/studentAuth.js'),
    read('js/teacherShell.js'),
    read('js/activities/fillInBlank.js'),
    read('js/activities/wordSearch/wordSearchViewMethods.js'),
    read('js/activities/crossword/crosswordViewMethods.js')
]);

function count(source, pattern) {
    return [...source.matchAll(pattern)].length;
}

test('student and teacher load one shared feedback family before page styles', () => {
    for (const [name, html, entryStylesheet] of [
        ['student', studentHtml, 'css/student.css'],
        ['teacher', teacherHtml, 'css/teacher.css']
    ]) {
        assert.equal(count(html, /data-shared-feedback/g), 1, `${name} must load one feedback family`);
        assert.ok(
            html.indexOf('css/navigation.css') < html.indexOf('css/feedback.css')
            && html.indexOf('css/feedback.css') < html.indexOf(entryStylesheet),
            `${name} feedback must load after navigation and before ${entryStylesheet}`
        );
    }

    assert.doesNotMatch(indexHtml, /css\/feedback\.css|data-shared-feedback/);
});

test('feedback.css owns completion presentation and cloud status indicators', () => {
    for (const selector of [
        '.completion-screen',
        '.completion-screen h2',
        '.completion-screen p',
        '.completion-overlay',
        '.completion-overlay .completion-screen',
        '.status-dot',
        '.status-dot[data-state="synced"]',
        '.status-dot[data-state="pending"]',
        '.status-dot[data-state="error"]'
    ]) {
        const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(feedbackCss, new RegExp(`${escaped}\\s*\\{`), `feedback.css is missing ${selector}`);
    }

    assert.doesNotMatch(feedbackCss, /!important/);
    assert.doesNotMatch(feedbackCss, /var\(--(?:text-muted|card-bg|border-color|success-color|danger-color)\)/);
    for (const token of ['--color-text-muted', '--color-surface', '--color-surface-raised', '--color-border', '--color-success', '--color-danger']) {
        assert.match(feedbackCss, new RegExp(`var\\(${token}\\)`));
    }
});

test('entry and lazy styles keep refinements without recreating the shared structure', () => {
    for (const [name, css] of [
        ['student.css', studentCss],
        ['teacher.css', teacherCss],
        ['student-features.css', studentFeatureCss]
    ]) {
        assert.doesNotMatch(css, /\.completion-screen\s*\{[^}]*text-align:\s*center/s, `${name} must not recreate completion structure`);
        assert.doesNotMatch(css, /\.completion-overlay\s*\{[^}]*position:\s*fixed/s, `${name} must not recreate the completion overlay`);
        assert.doesNotMatch(css, /\.status-dot\s*\{[^}]*width:\s*0\.85rem/s, `${name} must not recreate status indicators`);
    }

    assert.match(studentCss, /\.status-dot\[data-state="synced"\]\s*\{[^}]*box-shadow:[^;]*0 0 18px rgba\(16, 185, 129, 0\.42\)/s);
    assert.doesNotMatch(feedbackCss, /animation:\s*(?:fadeIn|scaleIn)/, 'shared feedback must not depend on consumer-owned keyframes');
    assert.match(teacherCss, /\.completion-overlay\s*\{[^}]*animation:\s*fadeIn 0\.3s ease/s);
    assert.match(teacherCss, /\.completion-overlay \.completion-screen\s*\{[^}]*animation:\s*scaleIn 0\.3s ease/s);
    assert.match(teacherCss, /@keyframes fadeIn/);
    assert.match(teacherCss, /@keyframes scaleIn/);
});

test('status indicators retain accessible labels and their state owners', () => {
    assert.match(studentHtml, /id="auth-status"[^>]+class="status-dot"[^>]+title="Syncing"[^>]+aria-label="Syncing"/);
    assert.match(teacherHtml, /id="teacher-cloud-status"[^>]+class="status-dot"[^>]+title="Signed out"[^>]+aria-label="Signed out"[^>]+data-state="offline"/);
    assert.match(studentAuth, /statusEl\.dataset\.state = state/);
    assert.match(studentAuth, /statusEl\.setAttribute\('aria-label', label\)/);
    assert.match(teacherShell, /el\.dataset\.state = dotState/);
    assert.match(teacherShell, /el\.setAttribute\('aria-label', label\)/);
});

test('activity completion producers remain reachable without a shared behavior abstraction', () => {
    assert.match(fillInBlank, /class="completion-screen"/);
    assert.match(wordSearchView, /overlay\.className = 'completion-overlay'/);
    assert.match(wordSearchView, /class="completion-screen"/);
    assert.match(crosswordView, /overlay\.className = 'completion-overlay'/);
    assert.match(crosswordView, /class="completion-screen"/);
});
