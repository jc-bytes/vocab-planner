import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [cardsCss, landingCss, studentCss, teacherCss, studentFeatureCss, teacherQuizCss, indexHtml, studentHtml, teacherHtml] = await Promise.all([
    read('css/cards.css'),
    read('css/landing.css'),
    read('css/student.css'),
    read('css/teacher.css'),
    read('css/student-features.css'),
    read('css/teacherQuiz.css'),
    read('index.html'),
    read('student.html'),
    read('teacher.html')
]);

function count(source, pattern) {
    return [...source.matchAll(pattern)].length;
}

test('every app entry loads one shared card family before page styles', () => {
    for (const [name, html, entryStylesheet] of [
        ['landing', indexHtml, 'css/landing.css'],
        ['student', studentHtml, 'css/student.css'],
        ['teacher', teacherHtml, 'css/teacher.css']
    ]) {
        assert.equal(count(html, /data-shared-cards/g), 1, `${name} must load one card family`);
        assert.ok(
            html.indexOf('css/theme.css') < html.indexOf('css/cards.css')
            && html.indexOf('css/cards.css') < html.indexOf(entryStylesheet),
            `${name} cards must load after theme.css and before ${entryStylesheet}`
        );
    }

    for (const html of [studentHtml, teacherHtml]) {
        assert.ok(html.indexOf('css/forms.css') < html.indexOf('css/cards.css'));
    }
});

test('cards.css owns the reusable card and option-card contracts', () => {
    for (const selector of [
        '.card',
        ':where(.student-site) .card',
        ':where(.student-site, .teacher-site) .card',
        ':where(.student-site, .teacher-site) .app-container > main .card',
        '.option-card',
        '.option-card:hover',
        '.option-card h2',
        '.option-card p',
        '.option-card .option-icon',
        '.option-card .option-icon svg',
        '.card[tabindex]:focus-visible'
    ]) {
        const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(cardsCss, new RegExp(`${escaped}\\s*(?:,|\\{)`), `cards.css is missing ${selector}`);
    }

    assert.doesNotMatch(cardsCss, /!important/);
    assert.doesNotMatch(cardsCss, /var\(--(?:card-bg|border-color|text-main)\)/);
    assert.match(cardsCss, /var\(--color-surface\)/);
    assert.match(cardsCss, /var\(--color-surface-raised\)/);
    assert.match(cardsCss, /var\(--color-border\)/);
    assert.match(cardsCss, /var\(--color-text\)/);
    assert.match(cardsCss, /var\(--color-focus\)/);
});

test('entry styles do not recreate the shared structural card core', () => {
    for (const [name, css] of [
        ['landing.css', landingCss],
        ['student.css', studentCss],
        ['teacher.css', teacherCss]
    ]) {
        assert.doesNotMatch(css, /\.card\s*\{[^}]*background:\s*var\(--card-bg\)[^}]*transition:/s, `${name} must not recreate the card surface`);
        assert.doesNotMatch(css, /\.option-card\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\)/s, `${name} must not recreate the option-card structure`);
        assert.doesNotMatch(css, /\.option-card h2\s*\{[^}]*grid-column:\s*2/s, `${name} must not recreate option-card content geometry`);
    }

    assert.doesNotMatch(studentFeatureCss, /(?:^|\n)\.card\s*\{/);
    assert.match(studentCss, /\.card\s*\{[^}]*border-radius:\s*var\(--radius-panel\)/s);
    assert.match(studentCss, /\.card:hover,/);
    assert.match(teacherQuizCss, /\.question-card\s*\{/);
});
