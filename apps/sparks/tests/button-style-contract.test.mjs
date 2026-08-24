import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [buttonsCss, studentCss, teacherCss, indexHtml, studentHtml, teacherHtml] = await Promise.all([
    read('css/buttons.css'),
    read('css/student.css'),
    read('css/teacher.css'),
    read('index.html'),
    read('student.html'),
    read('teacher.html')
]);

function count(source, pattern) {
    return [...source.matchAll(pattern)].length;
}

test('student and teacher load one shared button core in foundation order', () => {
    for (const [name, html, entryStylesheet] of [
        ['student', studentHtml, 'css/student.css'],
        ['teacher', teacherHtml, 'css/teacher.css']
    ]) {
        assert.equal(count(html, /data-shared-buttons/g), 1, `${name} must load one button core`);
        assert.ok(
            html.indexOf('css/theme.css') < html.indexOf('css/buttons.css')
            && html.indexOf('css/buttons.css') < html.indexOf(entryStylesheet),
            `${name} button core must load between theme.css and ${entryStylesheet}`
        );
    }

    assert.doesNotMatch(indexHtml, /css\/buttons\.css|data-shared-buttons/, 'landing cards do not use the button core');
});

test('the shared button core owns every live structural variant', () => {
    for (const selector of [
        '.btn',
        '.btn:disabled',
        '.btn:disabled:hover',
        '.primary-btn',
        '.primary-btn:hover',
        '.secondary-btn',
        '.secondary-btn:hover',
        '.accent-btn',
        '.danger-btn',
        '.text-btn',
        '.text-btn:hover',
        '.icon-btn',
        '.btn:focus-visible',
        '.btn svg'
    ]) {
        const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(buttonsCss, new RegExp(`${escaped}\\s*\\{`), `buttons.css is missing ${selector}`);
    }

    assert.doesNotMatch(buttonsCss, /!important/);
    assert.doesNotMatch(buttonsCss, /var\(--(?:primary-color|secondary-color|accent-color|text-main|text-muted)\)/);
    for (const token of ['color-brand', 'color-info', 'color-on-brand', 'color-on-accent', 'color-text', 'color-text-muted', 'color-focus']) {
        assert.match(buttonsCss, new RegExp(`var\\(--${token}\\)`), `buttons.css must consume --${token}`);
    }
});

test('page styles retain only their contextual and student-theme refinements', () => {
    for (const [name, css] of [['student.css', studentCss], ['teacher.css', teacherCss]]) {
        assert.doesNotMatch(
            css,
            /(?:^|\n)\.btn\s*\{[^}]*display:\s*inline-flex/s,
            `${name} must not recreate the shared button structure`
        );
        assert.doesNotMatch(css, /\.btn:disabled\s*\{/, `${name} must not recreate disabled behavior`);
    }

    assert.match(studentCss, /\.primary-btn\s*\{[^}]*background:\s*var\(--color-interactive\)/s);
    assert.match(studentCss, /\.primary-btn:hover\s*\{[^}]*background:\s*var\(--color-interactive-hover\)/s);
    assert.match(studentCss, /\.btn:active\s*\{/);
});
