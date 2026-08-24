import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [formsCss, studentCss, teacherCss, studentFeatureCss, teacherQuizCss, indexHtml, studentHtml, teacherHtml, mainJs] = await Promise.all([
    read('css/forms.css'),
    read('css/student.css'),
    read('css/teacher.css'),
    read('css/student-features.css'),
    read('css/teacherQuiz.css'),
    read('index.html'),
    read('student.html'),
    read('teacher.html'),
    read('js/main.js')
]);

function count(source, pattern) {
    return [...source.matchAll(pattern)].length;
}

test('student and teacher load one form-control family in foundation order', () => {
    for (const [name, html, entryStylesheet] of [
        ['student', studentHtml, 'css/student.css'],
        ['teacher', teacherHtml, 'css/teacher.css']
    ]) {
        assert.equal(count(html, /data-shared-form-controls/g), 1, `${name} must load one form-control family`);
        assert.ok(
            html.indexOf('css/theme.css') < html.indexOf('css/forms.css')
            && html.indexOf('css/buttons.css') < html.indexOf('css/forms.css')
            && html.indexOf('css/forms.css') < html.indexOf(entryStylesheet),
            `${name} form controls must load after foundations and before ${entryStylesheet}`
        );
    }

    assert.doesNotMatch(indexHtml, /css\/forms\.css|data-shared-form-controls/);
});

test('forms.css owns the broad controls and shared password behavior', () => {
    for (const selector of [
        '.form-row',
        '.form-row .form-group',
        ':where(.teacher-site) input',
        ':where(.teacher-site) input::placeholder',
        ':where(.teacher-site) input:focus',
        ':where(.teacher-site) input[readonly]',
        ':where(.student-site) input',
        ':where(.student-site) input::placeholder',
        ':where(.student-site) input:focus',
        ':where(.student-site) input[readonly]',
        '.password-field',
        '.password-toggle',
        '.password-toggle:focus-visible'
    ]) {
        const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(formsCss, new RegExp(`${escaped}\\s*(?:,|\\{)`), `forms.css is missing ${selector}`);
    }

    assert.doesNotMatch(formsCss, /!important/);
    assert.doesNotMatch(formsCss, /var\(--(?:primary-color|secondary-color|text-main|text-muted|border-color)\)/);
    for (const token of ['color-text', 'color-text-muted', 'color-focus']) {
        assert.match(formsCss, new RegExp(`var\\(--${token}\\)`));
    }
});

test('entry styles keep refinements without recreating the broad form core', () => {
    for (const [name, css] of [['student.css', studentCss], ['teacher.css', teacherCss]]) {
        assert.doesNotMatch(css, /\.password-field\s*\{/g, `${name} must not recreate the password wrapper`);
        assert.doesNotMatch(css, /\.password-toggle\s*\{/g, `${name} must not recreate the password control`);
        assert.doesNotMatch(
            css,
            /(?:^|\n)input,\s*\n?textarea,\s*\n?select\s*\{[^}]*width:\s*100%/s,
            `${name} must not recreate the broad control structure`
        );
    }

    assert.match(studentCss, /input,\s*\n?textarea,\s*\n?select\s*\{[^}]*border-color:/s);
    assert.match(studentFeatureCss, /\.word-hunt-field textarea\s*\{/);
    assert.match(teacherQuizCss, /\.quiz-section-fields input\s*\{/);
    assert.match(teacherQuizCss, /\.rubric-row-edit input,/);
});

test('all password controls retain their accessible runtime contract', () => {
    const controls = [...`${studentHtml}\n${teacherHtml}`.matchAll(/<button[^>]*class="password-toggle"[^>]*>/g)];
    assert.equal(controls.length, 6);
    for (const [tag] of controls) {
        assert.match(tag, /type="button"/);
        assert.match(tag, /aria-controls="[^"]+"/);
        assert.match(tag, /aria-label="Show password"/);
    }
    assert.match(mainJs, /querySelectorAll\('\.password-toggle'\)/);
    assert.match(mainJs, /setAttribute\('aria-pressed'/);
    assert.match(mainJs, /input\.type = shouldShow \? 'text' : 'password'/);
});
