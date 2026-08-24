import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [typographyCss, landingCss, studentCss, teacherCss, studentDesignCss, indexHtml, studentHtml, teacherHtml] = await Promise.all([
    read('css/typography.css'),
    read('css/landing.css'),
    read('css/student.css'),
    read('css/teacher.css'),
    read('css/student-design-system.css'),
    read('index.html'),
    read('student.html'),
    read('teacher.html')
]);

function count(source, pattern) {
    return [...source.matchAll(pattern)].length;
}

test('every app entry loads one typography authority after page styles', () => {
    for (const [name, html, entryStylesheet] of [
        ['landing', indexHtml, 'css/landing.css'],
        ['student', studentHtml, 'css/student.css'],
        ['teacher', teacherHtml, 'css/teacher.css']
    ]) {
        assert.equal(count(html, /css\/typography\.css/g), 1, `${name} must load typography.css once`);
        assert.ok(html.indexOf(entryStylesheet) < html.indexOf('css/typography.css'), `${name} typography must follow page styles`);
    }
});

test('typography.css alone owns the four delivered Inter faces', () => {
    assert.equal(count(typographyCss, /@font-face/g), 4);
    for (const weight of [400, 500, 600, 700]) {
        assert.match(typographyCss, new RegExp(`font-weight:\\s*${weight};[\\s\\S]*?inter-latin-${weight}-normal\\.woff2`));
    }

    for (const [name, css] of [
        ['landing.css', landingCss],
        ['student.css', studentCss],
        ['teacher.css', teacherCss],
        ['student-design-system.css', studentDesignCss]
    ]) {
        assert.doesNotMatch(css, /@font-face/, `${name} must not recreate Inter delivery`);
    }
    for (const [name, css] of [['landing.css', landingCss], ['student.css', studentCss], ['teacher.css', teacherCss]]) {
        assert.doesNotMatch(css, /(?:^|})body\s*\{[^}]*font-family:\s*['"]Inter['"]/s, `${name} body must use the shared font family`);
    }
});

test('shared semantic roles remain discoverable in the typography authority', () => {
    for (const selector of [
        'body',
        '.primary-nav__item',
        '.breadcrumb',
        '.form-label',
        '.form-feedback',
        '.page-header__title',
        '.card-title',
        '.modal-header > h2',
        '.toast',
        '.data-table'
    ]) {
        const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(typographyCss, new RegExp(`${escaped}(?:[^,{]*,[^{}]*)?\\s*\\{`), `typography.css is missing ${selector}`);
    }

    for (const token of ['--type-body-size', '--type-primary-nav-size', '--type-form-control-size', '--type-page-title-size', '--type-card-title-size']) {
        assert.match(typographyCss, new RegExp(`${token}\\s*:`));
    }
});

test('student design-system remains an explicit scoped override rather than a second font owner', () => {
    assert.match(studentHtml, /css\/typography\.css[\s\S]*css\/student-design-system\.css/);
    assert.match(studentDesignCss, /\.student-site\s*\{/);
    assert.match(studentDesignCss, /--student-type-card-title-size:\s*1\.125rem/);
    assert.match(studentDesignCss, /--student-type-page-title-size:\s*1\.5rem/);
    assert.match(studentDesignCss, /--type-card-title-size:\s*var\(--student-type-card-title-size\)/);
});
