import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [navigationCss, themeCss, studentCss, teacherCss, indexHtml, studentHtml, teacherHtml] = await Promise.all([
    read('css/navigation.css'),
    read('css/theme.css'),
    read('css/student.css'),
    read('css/teacher.css'),
    read('index.html'),
    read('student.html'),
    read('teacher.html')
]);

function count(source, pattern) {
    return [...source.matchAll(pattern)].length;
}

test('student and teacher load one shared navigation family before page styles', () => {
    for (const [name, html, entryStylesheet] of [
        ['student', studentHtml, 'css/student.css'],
        ['teacher', teacherHtml, 'css/teacher.css']
    ]) {
        assert.equal(count(html, /data-shared-navigation/g), 1, `${name} must load one navigation family`);
        assert.ok(
            html.indexOf('css/dialogs.css') < html.indexOf('css/navigation.css')
            && html.indexOf('css/navigation.css') < html.indexOf(entryStylesheet),
            `${name} navigation must load after dialogs and before ${entryStylesheet}`
        );
    }

    assert.doesNotMatch(indexHtml, /css\/navigation\.css|data-shared-navigation/);
});

test('navigation.css owns the common tab and breadcrumb controls', () => {
    for (const selector of [
        '.teacher-library-breadcrumb',
        '.teacher-library-crumb-btn',
        '.teacher-library-crumb-btn:focus-visible',
        '.teacher-tab-shell',
        '.teacher-mobile-menu-toggle',
        '.teacher-tabs',
        '.teacher-tab',
        '.teacher-tab.active',
        '.teacher-tab:focus-visible'
    ]) {
        const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(navigationCss, new RegExp(`${escaped}\\s*\\{`), `navigation.css is missing ${selector}`);
    }

    assert.doesNotMatch(navigationCss, /!important/);
    assert.doesNotMatch(navigationCss, /var\(--(?:text-main|text-muted|border-color|secondary-color)\)/);
    for (const token of ['--color-text', '--color-text-muted', '--color-border', '--color-focus', '--color-link']) {
        assert.match(navigationCss, new RegExp(`var\\(${token}\\)`));
    }
    assert.equal(count(themeCss, /--color-link:/g), 2, 'default and student themes must define the link role');
});

test('page styles retain responsive shell refinements without recreating the common core', () => {
    for (const [name, css] of [['student.css', studentCss], ['teacher.css', teacherCss]]) {
        assert.doesNotMatch(css, /\.teacher-tab-shell\s*\{[^}]*justify-self:\s*center/s, `${name} must not recreate the tab shell core`);
        assert.doesNotMatch(css, /\.teacher-tabs\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/s, `${name} must not recreate the tab list core`);
        assert.doesNotMatch(css, /\.teacher-library-crumb-btn\s*\{[^}]*min-height:\s*var\(--touch-target\)/s, `${name} must not recreate breadcrumb controls`);
    }

    assert.match(studentCss, /@media\s*\(max-width:\s*1120px\)/);
    assert.match(studentCss, /@media\s*\(min-width:\s*1121px\)/);
    assert.match(teacherCss, /@media\s*\(max-width:\s*1180px\)/);
    assert.match(teacherCss, /teacher-sidebar-collapsed/);
    assert.match(teacherCss, /\.teacher-tab-shell\.mobile-menu-open \.teacher-tabs/);
});

test('top-level navigation keeps its accessible tab and mobile-menu contract', () => {
    for (const [name, html, tabCount] of [
        ['student', studentHtml, 4],
        ['teacher', teacherHtml, 7]
    ]) {
        const tabListId = name === 'student' ? 'student-tabs' : 'teacher-tabs';
        const tabList = html.match(new RegExp(`<div id="${tabListId}"[\\s\\S]*?<\\/div>`))?.[0] ?? '';
        assert.match(html, /<nav[^>]+class="[^"]*teacher-tab-shell[^"]*"[^>]+aria-label="[^"]+"/);
        assert.match(tabList, /role="tablist"/);
        assert.equal(count(tabList, /<button[^>]+class="[^"]*\bteacher-tab\b[^"]*"[^>]+role="tab"/g), tabCount);
        assert.equal(count(tabList, /role="tab"/g), tabCount);
        assert.equal(count(tabList, /aria-selected="(?:true|false)"/g), tabCount);
        assert.match(html, /class="[^"]*teacher-mobile-menu-toggle[^"]*"[^>]+aria-expanded="false"[^>]+aria-controls="[^"]+"/,
            `${name} mobile navigation must expose expanded state and controls`);
    }
});
