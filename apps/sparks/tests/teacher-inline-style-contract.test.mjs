import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [teacherHtml, teacherCss, teacherQuizCss] = await Promise.all([
    read('teacher.html'),
    read('css/teacher.css'),
    read('css/teacherQuiz.css')
]);

function quizTemplate() {
    const match = teacherHtml.match(/<template id="teacher-quizzes-view-template">([\s\S]*?)<\/template>/);
    assert.ok(match, 'Missing teacher Quiz Maker template');
    return match[1];
}

test('Quiz Maker template delegates static presentation to its lazy stylesheet', () => {
    const template = quizTemplate();
    assert.doesNotMatch(template, /\sstyle=/, 'Quiz Maker template must not recreate static styles inline');
    for (const className of ['quiz-maker-container', 'quiz-sidebar', 'quiz-tool-heading', 'quiz-border-option', 'quiz-canvas', 'quiz-list', 'quiz-empty-state']) {
        assert.match(template, new RegExp(`class="[^"]*${className}`));
        assert.match(teacherQuizCss, new RegExp(`\\.${className}[^\\{]*\\{`), `Lazy Quiz CSS must own .${className}`);
    }

    for (const declaration of [
        /\.quiz-maker-container\s*\{[^}]*display:\s*flex;[^}]*height:\s*calc\(100vh - 80px\);[^}]*gap:\s*1\.25rem;/s,
        /\.quiz-sidebar\s*\{[^}]*display:\s*flex;[^}]*width:\s*clamp\(380px, 26vw, 500px\);[^}]*flex-direction:\s*column;[^}]*overflow-y:\s*auto;/s,
        /\.quiz-tool-heading\s*\{[^}]*margin-bottom:\s*0\.5rem;[^}]*font-size:\s*0\.9rem;/s,
        /#edit-rubric-btn\s*\{[^}]*font-size:\s*0\.8rem;/s,
        /\.quiz-canvas\s*\{[^}]*flex:\s*1;[^}]*padding:\s*clamp\(1rem, 2vw, 2\.25rem\);[^}]*overflow-y:\s*auto;[^}]*background:\s*rgba\(15, 23, 42, 0\.3\);/s,
        /\.quiz-list\s*\{[^}]*max-width:\s*800px;[^}]*margin:\s*0 auto;/s,
        /\.quiz-empty-state\s*\{[^}]*padding:\s*3rem;[^}]*color:\s*var\(--text-muted\);[^}]*text-align:\s*center;/s
    ]) {
        assert.match(teacherQuizCss, declaration);
    }
});

test('Quiz responsive layout stays with the lazy feature instead of the teacher entry', () => {
    assert.match(teacherQuizCss, /@media \(max-width: 1024px\)\s*\{[\s\S]*?\.quiz-maker-container\s*\{[^}]*flex-direction:\s*column;[^}]*height:\s*auto;[\s\S]*?\.quiz-sidebar\s*\{[^}]*max-height:\s*none;[\s\S]*?\.quiz-canvas\s*\{[^}]*width:\s*100%;[^}]*overflow-x:\s*auto;/);
    assert.doesNotMatch(teacherQuizCss, /@media \(max-width: 1024px\)\s*\{[\s\S]*?\.quiz-sidebar\s*\{[^}]*width:/,
        'The established responsive layout keeps the clamped sidebar width');
    assert.doesNotMatch(teacherCss, /@media \(max-width: 1024px\)[\s\S]*?\.quiz-maker-container\s*\{/);
    assert.doesNotMatch(teacherQuizCss, /!important/);
});
