import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [dialogsCss, studentCss, teacherCss, studentFeatureCss, teacherQuizCss, indexHtml, studentHtml, teacherHtml, mainJs, fillInBlankJs, sparkReadingJs] = await Promise.all([
    read('css/dialogs.css'),
    read('css/student.css'),
    read('css/teacher.css'),
    read('css/student-features.css'),
    read('css/teacherQuiz.css'),
    read('index.html'),
    read('student.html'),
    read('teacher.html'),
    read('js/main.js'),
    read('js/activities/fillInBlank.js'),
    read('js/activities/sparkReading.js')
]);

function count(source, pattern) {
    return [...source.matchAll(pattern)].length;
}

test('student and teacher load one shared dialog family before page styles', () => {
    for (const [name, html, entryStylesheet] of [
        ['student', studentHtml, 'css/student.css'],
        ['teacher', teacherHtml, 'css/teacher.css']
    ]) {
        assert.equal(count(html, /data-shared-dialogs/g), 1, `${name} must load one dialog family`);
        assert.ok(
            html.indexOf('css/cards.css') < html.indexOf('css/dialogs.css')
            && html.indexOf('css/dialogs.css') < html.indexOf(entryStylesheet),
            `${name} dialogs must load after shared cards and before ${entryStylesheet}`
        );
    }

    assert.doesNotMatch(indexHtml, /css\/dialogs\.css|data-shared-dialogs/);
});

test('dialogs.css owns the shared shell dialog structure', () => {
    for (const selector of [
        '.modal',
        '.modal.hidden',
        '.modal-content',
        '.modal-header',
        '.close-modal',
        '.modal-footer',
        '.close-modal:focus-visible'
    ]) {
        const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(dialogsCss, new RegExp(`${escaped}\\s*\\{`), `dialogs.css is missing ${selector}`);
    }

    assert.doesNotMatch(dialogsCss, /!important/);
    assert.doesNotMatch(dialogsCss, /var\(--(?:text-muted|primary-color|secondary-color)\)/);
    assert.match(dialogsCss, /var\(--color-text-muted\)/);
    assert.match(dialogsCss, /var\(--color-focus\)/);
});

test('page and lazy styles retain refinements without recreating the dialog core', () => {
    for (const [name, css] of [['student.css', studentCss], ['teacher.css', teacherCss]]) {
        assert.doesNotMatch(css, /\.modal\s*\{[^}]*position:\s*fixed/s, `${name} must not recreate the dialog backdrop`);
        assert.doesNotMatch(css, /\.modal-content\s*\{[^}]*width:\s*min\(92vw, 600px\)/s, `${name} must not recreate the dialog panel`);
        assert.doesNotMatch(css, /\.close-modal\s*\{[^}]*min-width:\s*var\(--touch-target\)/s, `${name} must not recreate the close control`);
    }

    assert.match(studentFeatureCss, /\.modal-content\s*\{[^}]*max-width:\s*calc\(100vw - 64px\)\s*!important/s);
    assert.match(teacherCss, /#student-detail-modal \.modal-content\s*\{/);
    assert.doesNotMatch(teacherCss, /\.activity-student-preview-/);
    assert.match(teacherQuizCss, /\.rubric-modal-backdrop\s*\{/);
    assert.match(fillInBlankJs, /modal hidden fib-hint-modal/);
    assert.match(sparkReadingJs, /modal hidden spark-check-modal/);
});

test('shared dialog behavior still owns accessibility and focus lifecycle', () => {
    assert.match(mainJs, /export function setupModal/);
    assert.match(mainJs, /modal\.setAttribute\('aria-modal', 'true'\)/);
    assert.match(mainJs, /event\.key === 'Escape'/);
    assert.match(mainJs, /event\.key !== 'Tab'/);
    assert.match(mainJs, /export function openModal/);
    assert.match(mainJs, /export function closeModal/);
    assert.match(mainJs, /state\.previouslyFocused\.focus/);

    const staticDialogs = [...`${studentHtml}\n${teacherHtml}`.matchAll(/<div[^>]*class="[^"]+"[^>]*>/g)]
        .filter(([tag]) => tag.match(/class="([^"]+)"/)?.[1].split(/\s+/).includes('modal'));
    assert.equal(staticDialogs.length, 7);
    for (const [tag] of staticDialogs) {
        assert.match(tag, /role="dialog"/);
        assert.match(tag, /aria-modal="true"/);
        assert.match(tag, /aria-labelledby="[^"]+"/);
    }
});
